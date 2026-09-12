// Panel de administración: usuarios, predicaciones y analíticas.
//
// El rol de admin vive en la columna `is_admin` de `users` (ver schema.sql) y
// se comprueba una sola vez, en `requireAdminMw` (index.js), antes de llegar
// aquí. Ninguna función de este archivo vuelve a mirar el nickname de quien
// pide: en ningún sitio hay un `if (nickname === 'dbindea')` ni parecido — es
// deliberado, para que el rol se pueda conceder o quitar desde el propio
// panel sin tocar una línea de código.

import { nowIso, hashValue, json, error } from './utils.js';
import { getViewStats } from './analytics.js';

const PAGE_SIZE = 20;

const paraElAdmin = (u) => ({
  id: u.id,
  nickname: u.nickname,
  email: u.email || null,
  userType: u.user_type || 'user',
  isAdmin: !!u.is_admin,
  isDisabled: !!u.is_disabled,
  createdAt: u.created_at,
});

/** GET /api/admin/stats */
export async function getStats(db, cors) {
  const semanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [usuarios, nuevos, desactivados, sermonesTotal, sermonesPublicos, temasTotal, temasPublicos, vistas] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS total FROM users').first(),
    db.prepare('SELECT COUNT(*) AS total FROM users WHERE created_at >= ?').bind(semanaAtras).first(),
    db.prepare('SELECT COUNT(*) AS total FROM users WHERE is_disabled = 1').first(),
    db.prepare('SELECT COUNT(*) AS total FROM sermons').first(),
    db.prepare('SELECT COUNT(*) AS total FROM sermons WHERE is_public = 1').first(),
    db.prepare('SELECT COUNT(*) AS total FROM topics').first(),
    db.prepare('SELECT COUNT(*) AS total FROM topics WHERE is_public = 1').first(),
    getViewStats(db),
  ]);

  return json({
    ok: true,
    stats: {
      totalUsers: usuarios?.total || 0,
      newUsersThisWeek: nuevos?.total || 0,
      disabledUsers: desactivados?.total || 0,
      totalSermons: sermonesTotal?.total || 0,
      publicSermons: sermonesPublicos?.total || 0,
      totalTopics: temasTotal?.total || 0,
      publicTopics: temasPublicos?.total || 0,
      ...vistas,
    },
  }, 200, cors);
}

// ── Usuarios ────────────────────────────────────────────

/** GET /api/admin/users?q=&page= — por nickname o email. */
export async function searchUsers(request, db, cors) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const like = `%${q}%`;
  const where = q ? 'WHERE nickname LIKE ? OR email LIKE ?' : '';
  const params = q ? [like, like] : [];

  const rows = await db
    .prepare(
      `SELECT id, nickname, email, user_type, is_admin, is_disabled, created_at
       FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(...params, PAGE_SIZE, offset)
    .all();

  return json({ ok: true, users: (rows.results || []).map(paraElAdmin), page }, 200, cors);
}

/**
 * PATCH /api/admin/users/:id — `{ disabled?, isAdmin? }`.
 *
 * Tres guardas, todas para que un admin no se deje fuera del panel por
 * accidente ni pueda sacar a otro admin por la puerta de atrás:
 *  - no puede desactivarse ni quitarse el rol a sí mismo
 *  - no puede desactivar a otro admin (hay que quitarle el rol primero, una
 *    acción distinta y más visible)
 */
export async function patchUser(request, db, adminId, targetId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { disabled, isAdmin } = body || {};
  if (disabled === undefined && isAdmin === undefined) return error('missing_fields', 400, cors);
  if (disabled !== undefined && typeof disabled !== 'boolean') return error('invalid_disabled', 400, cors);
  if (isAdmin !== undefined && typeof isAdmin !== 'boolean') return error('invalid_is_admin', 400, cors);

  if (targetId === adminId && (disabled === true || isAdmin === false)) {
    return error('cannot_modify_self', 400, cors);
  }

  const target = await db.prepare('SELECT id, is_admin FROM users WHERE id = ?').bind(targetId).first();
  if (!target) return error('user_not_found', 404, cors);
  if (disabled === true && target.is_admin) return error('cannot_disable_admin', 400, cors);

  const campos = [];
  const valores = [];
  if (disabled !== undefined) { campos.push('is_disabled = ?'); valores.push(disabled ? 1 : 0); }
  if (isAdmin !== undefined) { campos.push('is_admin = ?'); valores.push(isAdmin ? 1 : 0); }
  campos.push('updated_at = ?');
  valores.push(nowIso(), targetId);

  await db.prepare(`UPDATE users SET ${campos.join(', ')} WHERE id = ?`).bind(...valores).run();

  // Al desactivar se saca ya: borra las sesiones vivas, no sólo bloquea el
  // próximo intento de entrar.
  if (disabled === true) {
    await db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(targetId).run();
  }

  const actualizado = await db
    .prepare('SELECT id, nickname, email, user_type, is_admin, is_disabled, created_at FROM users WHERE id = ?')
    .bind(targetId)
    .first();
  return json({ ok: true, user: paraElAdmin(actualizado) }, 200, cors);
}

/** DELETE /api/admin/users/:id — las FK `ON DELETE CASCADE` se llevan sus temas/sermones/etc. */
export async function deleteUserAdmin(db, adminId, targetId, cors) {
  if (targetId === adminId) return error('cannot_delete_self', 400, cors);
  const result = await db.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();
  if (!result.meta || result.meta.changes === 0) return error('user_not_found', 404, cors);
  return json({ ok: true }, 200, cors);
}

const ALFABETO_CONTRASENA = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Sin 0/O ni 1/l/I: se transcribe a mano por el mismo canal que ya se usa hoy para recuperar cuentas. */
const generarContrasenaAleatoria = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => ALFABETO_CONTRASENA[b % ALFABETO_CONTRASENA.length]).join('');
};

/**
 * POST /api/admin/users/:id/reset-password
 *
 * No hay envío de correo implementado (ver README del worker): la contraseña
 * nueva vuelve **una sola vez** en la respuesta, para que el admin la copie y
 * se la pase a quien la necesite. No se puede recuperar después — ni siquiera
 * el admin que la generó.
 */
export async function resetUserPasswordAdmin(db, targetId, cors) {
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first();
  if (!user) return error('user_not_found', 404, cors);

  const nueva = generarContrasenaAleatoria();
  const salt = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  const hash = await hashValue(nueva, salt);

  await db
    .prepare('UPDATE users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(salt, hash, nowIso(), targetId)
    .run();
  // Una contraseña reseteada por el admin casi siempre significa que alguien
  // perdió el control de la cuenta: cualquier sesión viva de antes se cierra.
  await db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(targetId).run();

  return json({ ok: true, newPassword: nueva }, 200, cors);
}

// ── Predicaciones ───────────────────────────────────────

/** GET /api/admin/sermons?q=&page= — por título o nickname del autor. */
export async function searchSermonsAdmin(request, db, cors) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const like = `%${q}%`;
  const where = q ? 'WHERE s.title LIKE ? OR u.nickname LIKE ?' : '';
  const params = q ? [like, like] : [];

  const rows = await db
    .prepare(
      `SELECT s.id, s.title, s.is_public, s.public_slug, s.status, s.created_at, u.nickname AS author
       FROM sermons s JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.updated_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(...params, PAGE_SIZE, offset)
    .all();

  return json({
    ok: true,
    sermons: (rows.results || []).map((r) => ({
      id: r.id,
      title: r.title || null,
      author: r.author,
      isPublic: !!r.is_public,
      publicSlug: r.public_slug || null,
      status: r.status,
      createdAt: r.created_at,
    })),
    page,
  }, 200, cors);
}

/**
 * PATCH /api/admin/sermons/:id — sólo para despublicar de oficio.
 *
 * A propósito no acepta `isPublic: true`: publicar es una decisión del propio
 * predicador sobre su texto, y el admin sólo tiene que poder **restringir**
 * visibilidad, no concederla en nombre de otro.
 */
export async function patchSermonAdmin(request, db, sermonId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  if (body?.isPublic !== false) return error('invalid_is_public', 400, cors);

  const result = await db
    .prepare('UPDATE sermons SET is_public = 0, updated_at = ? WHERE id = ?')
    .bind(nowIso(), sermonId)
    .run();
  if (!result.meta || result.meta.changes === 0) return error('sermon_not_found', 404, cors);
  return json({ ok: true }, 200, cors);
}

/** DELETE /api/admin/sermons/:id — de cualquier autor. */
export async function deleteSermonAdmin(db, sermonId, cors) {
  const result = await db.prepare('DELETE FROM sermons WHERE id = ?').bind(sermonId).run();
  if (!result.meta || result.meta.changes === 0) return error('sermon_not_found', 404, cors);
  return json({ ok: true }, 200, cors);
}
