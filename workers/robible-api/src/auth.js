// Auth endpoints: register, login, recover (4 vías), me, logout
import {
  hashValue,
  verifyHash,
  makeToken,
  readToken,
  validators,
  nowIso,
  genId,
  saveSession,
  deleteSession,
  requireAuth,
  checkRateLimit,
  getClientIp,
  limitar,
  json,
  error,
  normalizeSecurityAnswer,
  esEmail,
  normalizarEmail,
  enmascararEmail,
  sha256Hex,
  RESET_TOKEN_TTL_MS,
  RESET_MAIL_TTL_MS,
} from './utils.js';
import { enviarCorreo } from './mail.js';
import { correoRecuperacion } from './mail-templates.js';

/**
 * Busca la cuenta por lo que la persona haya escrito: apodo o correo.
 *
 * `columnas` es un literal escrito por nosotros en cada llamada —nunca viene de
 * la petición—, así que se interpola; el identificador va siempre en `.bind()`.
 *
 * El correo se compara normalizado porque se guarda normalizado
 * (`normalizarEmail`), y el apodo en minúsculas porque es como lo guarda
 * `register`. Una de las dos sin normalizar da el mismo síntoma: la cuenta
 * existe y el servidor dice que no.
 */
async function buscarPorIdentificador(db, identificador, columnas) {
  if (esEmail(identificador)) {
    return db.prepare(`SELECT ${columnas} FROM users WHERE email = ?`).bind(normalizarEmail(identificador)).first();
  }
  return db
    .prepare(`SELECT ${columnas} FROM users WHERE nickname = ?`)
    .bind(
      String(identificador ?? '')
        .trim()
        .toLowerCase(),
    )
    .first();
}

/**
 * Lee el identificador del cuerpo aceptando los DOS nombres de campo.
 *
 * No es indecisión: el frontend y el worker se despliegan por separado
 * (CLAUDE.md, trampa 36), así que el bundle anterior seguirá mandando
 * `nickname` durante la ventana entre los dos despliegues. Y el cliente nuevo
 * manda los dos con el mismo valor, con lo que el orden de despliegue deja de
 * importar para algo tan central como el login.
 */
const leerIdentificador = (body) => body?.identifier ?? body?.nickname;

/**
 * La huella de la contraseña que se mete en los tokens de recuperación.
 *
 * Es lo que los hace de UN SOLO USO sin tabla de tokens gastados: al resetear
 * se recalcula contra el hash vivo y, si la contraseña ya cambió, el token deja
 * de valer. Se hashea el hash a propósito — así el token no transporta ni un
 * trozo de lo que hay guardado en la base de datos.
 */
export const huellaDeContrasena = async (passwordHash) => (await sha256Hex(String(passwordHash || ''))).slice(0, 12);

// Claves de las preguntas predefinidas que se usaban antes del schema 8.
//
// Ya NO se puede registrar con ellas: la pregunta la escribe el usuario. Se
// conserva la lista porque las cuentas creadas antes las tienen guardadas en
// `sec_question` y el frontend necesita traducirlas al recuperar la cuenta.
// Para cuentas nuevas, `sec_question` vale siempre 'custom'.
export const LEGACY_SECURITY_QUESTIONS = ['siblings', 'favorite_number', 'bible_start_year', 'pets_count', 'countries_visited'];

// ── REGISTER ────────────────────────────────────────────
export async function register(request, db, env, cors) {
  const rl = await checkRateLimit(db, request, 'register', env);
  if (!rl.ok) return error(rl.error, 429, { ...cors, 'Retry-After': String(rl.retryAfter || 60) });

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }

  const { nickname, password, securityQuestionText, securityAnswer, userType, email, locale } = body || {};

  if (!validators.nickname(nickname)) return error('invalid_nickname', 400, cors);
  if (!validators.password(password)) return error('invalid_password', 400, cors);

  // La pregunta la escribe el usuario. Ya no se acepta elegir de una lista: con
  // cinco opciones fijas, mucha gente terminaba usando la misma pregunta.
  if (!validators.securityQuestionText(securityQuestionText)) {
    return error('invalid_security_question', 400, cors);
  }
  if (!validators.securityAnswer(securityAnswer)) return error('invalid_security_answer', 400, cors);

  // Tipo de cuenta: si no llega, cuenta normal.
  const tipo = userType === undefined || userType === null ? 'user' : userType;
  if (!validators.userType(tipo)) return error('invalid_user_type', 400, cors);

  // El email es opcional de verdad: sólo se valida si viene con algo escrito.
  // Se guarda normalizado porque con él también se entra (ver `login`): quien
  // escriba `Juan@…` al registrarse tiene que poder entrar con `juan@…`.
  const emailLimpio = normalizarEmail(email);
  if (emailLimpio && !validators.email(emailLimpio)) return error('invalid_email', 400, cors);

  const normalized = nickname.trim().toLowerCase();

  // Verificar duplicado
  const existing = await db
    .prepare('SELECT id FROM users WHERE nickname = ?')
    .bind(normalized)
    .first();
  if (existing) return error('nickname_taken', 409, cors);

  // Y el correo tampoco se puede repetir, desde que sirve para entrar: dos
  // cuentas con la misma dirección serían un empate sin forma de resolverlo, y
  // la que se quedara fuera no podría ni entrar ni recuperarse.
  if (emailLimpio) {
    const emailOcupado = await db.prepare('SELECT id FROM users WHERE email = ?').bind(emailLimpio).first();
    if (emailOcupado) return error('email_taken', 409, cors);
  }

  const userId = genId('u');
  const passwordSalt = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  const passwordHash = await hashValue(password, passwordSalt);
  const answerSalt = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  // `normalizeSecurityAnswer` y no `.trim()`: la verificación al recuperar la
  // cuenta usa exactamente la misma función. Si las dos rutas normalizaran
  // distinto, el usuario escribiría la respuesta correcta y no entraría nunca.
  const answerHash = await hashValue(normalizeSecurityAnswer(securityAnswer), answerSalt);

  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO users (id, nickname, password_salt, password_hash, sec_question, sec_question_text, sec_answer_salt, sec_answer_hash, user_type, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      normalized,
      passwordSalt,
      passwordHash,
      'custom',
      securityQuestionText.trim(),
      answerSalt,
      answerHash,
      tipo,
      emailLimpio || null,
      now,
      now,
    )
    .run();

  const token = await makeToken(userId, env.JWT_SECRET);
  await saveSession(db, token, userId, request);

  // Seed de topics default (Mântuire/Îndurare/Vindecare o equivalentes).
  // El locale lo manda el cliente, que sí lo conoce (sale de la versión bíblica
  // activa). Antes se deducía de la inicial de la clave de la pregunta de
  // seguridad — de las cinco posibles solo 'bible_start_year' empieza por 'b',
  // así que el idioma dependía de una elección que nada tenía que ver con él.
  await seedDefaultTopics(db, userId, normalizeLocale(locale), now);

  return json({
    ok: true,
    user: {
      id: userId,
      nickname: normalized,
      userType: tipo,
      email: emailLimpio || null,
      isAdmin: false,
      fullName: null,
      birthDate: null,
      church: null,
      country: null,
      confession: null,
      motto: null,
      plan: 'free',
      createdAt: now,
      updatedAt: now,
    },
    token,
  }, 201, cors);
}

// Locales con categorías por defecto traducidas. Cualquier otro cae a 'ro'.
const SEED_LOCALES = ['ro', 'es'];
const normalizeLocale = (value) =>
  typeof value === 'string' && SEED_LOCALES.includes(value.trim().toLowerCase())
    ? value.trim().toLowerCase()
    : 'ro';

async function seedDefaultTopics(db, userId, locale, now) {
  const defaults = locale === 'es'
    ? [
        { name: 'Salvación', icon: '✝️', color: '#D4A853' },
        { name: 'Misericordia', icon: '🤲', color: '#2E7D9B' },
        { name: 'Sanación', icon: '🩹', color: '#5BA89E' },
      ]
    : [
        { name: 'Mântuire', icon: '✝️', color: '#D4A853' },
        { name: 'Îndurare', icon: '🤲', color: '#2E7D9B' },
        { name: 'Vindecare', icon: '🩹', color: '#5BA89E' },
      ];
  const stmt = db.prepare(
    `INSERT INTO topics (id, user_id, name, icon, color, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
  );
  for (const t of defaults) {
    const id = genId('topic');
    await stmt.bind(id, userId, t.name, t.icon, t.color, now).run();
  }
}

// ── LOGIN ───────────────────────────────────────────────
export async function login(request, db, env, cors) {
  const rl = await checkRateLimit(db, request, 'login', env);
  if (!rl.ok) return error(rl.error, 429, { ...cors, 'Retry-After': String(rl.retryAfter || 60) });

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }

  // Se entra con el apodo o con el correo, en el mismo campo.
  const identificador = leerIdentificador(body);
  const { password } = body || {};
  if (!identificador || !password) return error('missing_credentials', 400, cors);

  const user = await buscarPorIdentificador(
    db,
    identificador,
    `id, nickname, password_salt, password_hash, user_type, email, is_admin,
     is_disabled, full_name, birth_date, church, country, confession, motto, plan,
     created_at, updated_at`,
  );
  // Un correo que no existe da el MISMO error que una contraseña mala, a
  // propósito: si no, este endpoint sirve para averiguar qué direcciones tienen
  // cuenta en RoBible.
  if (!user) return error('invalid_credentials', 401, cors);

  const valid = await verifyHash(password, user.password_salt, user.password_hash);
  if (!valid) return error('invalid_credentials', 401, cors);

  // Una cuenta desactivada no puede entrar aunque la contraseña sea correcta.
  // No se distingue de otros errores de credenciales por descuido: el usuario
  // necesita saber que tiene que contactar al admin, no que ha escrito mal la
  // contraseña.
  if (user.is_disabled) return error('account_disabled', 403, cors);

  const token = await makeToken(user.id, env.JWT_SECRET);
  await saveSession(db, token, user.id, request);

  return json({
    ok: true,
    user: {
      id: user.id,
      nickname: user.nickname,
      userType: user.user_type || 'user',
      email: user.email || null,
      isAdmin: !!user.is_admin,
      fullName: user.full_name || null,
      birthDate: user.birth_date || null,
      church: user.church || null,
      country: user.country || null,
      confession: user.confession || null,
      motto: user.motto || null,
      plan: user.plan || 'free',
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    token,
  }, 200, cors);
}

// ── RECOVER STEP 1: get security question ───────────────
export async function getRecoverQuestion(request, db, _env, cors) {
  const rl = await checkRateLimit(db, request, 'recover', _env);
  if (!rl.ok) return error(rl.error, 429, { ...cors, 'Retry-After': String(rl.retryAfter || 60) });

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const identificador = leerIdentificador(body);
  if (!validators.identifier(identificador)) return error('invalid_identifier', 400, cors);

  const user = await buscarPorIdentificador(db, identificador, 'sec_question, sec_question_text, email');
  if (!user) return error('user_not_found', 404, cors);

  // Devolvemos la clave (frontend la traduce con i18n) o el texto custom.
  //
  // `hasEmail` es lo que decide si la pantalla ofrece el correo automático: sin
  // dirección, ese botón sólo podría prometer un correo que nunca llega. Y
  // `emailHint` va enmascarado para que la persona reconozca cuál de sus
  // direcciones puso sin que esto sirva para leer la de otro.
  return json({
    ok: true,
    securityQuestion: user.sec_question,
    securityQuestionText: user.sec_question_text,
    hasEmail: !!user.email,
    emailHint: user.email ? enmascararEmail(user.email) : null,
  }, 200, cors);
}

// ── RECOVER STEP 2: verify answer → reset token ─────────
export async function verifyRecoverAnswer(request, db, env, cors) {
  const rl = await checkRateLimit(db, request, 'recover', env);
  if (!rl.ok) return error(rl.error, 429, { ...cors, 'Retry-After': String(rl.retryAfter || 60) });

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const identificador = leerIdentificador(body);
  const { answer } = body || {};
  if (!validators.identifier(identificador)) return error('invalid_identifier', 400, cors);
  if (!validators.securityAnswer(answer)) return error('invalid_security_answer', 400, cors);

  const user = await buscarPorIdentificador(
    db,
    identificador,
    'id, sec_answer_salt, sec_answer_hash, password_hash',
  );
  if (!user) return error('user_not_found', 404, cors);

  // Misma normalización que al registrar, por fuerza: lo guardado es un hash.
  // Con las respuestas numéricas de las cuentas antiguas la normalización no
  // cambia nada ("3" sigue siendo "3"), así que sus hashes siguen valiendo.
  const valid = await verifyHash(normalizeSecurityAnswer(answer), user.sec_answer_salt, user.sec_answer_hash);
  if (!valid) return error('invalid_security_answer', 401, cors);

  // El `pv` convierte el token en uno de un solo uso: ver `huellaDeContrasena`.
  // Lo lleva también este camino, no sólo el del correo — hasta ahora el token
  // de la pregunta se podía reutilizar dentro de su ventana de cinco minutos.
  const resetToken = await makeToken(user.id, env.JWT_SECRET, RESET_TOKEN_TTL_MS, {
    pv: await huellaDeContrasena(user.password_hash),
  });
  return json({ ok: true, resetToken }, 200, cors);
}

// ── RECOVER por CORREO: manda un enlace para poner contraseña nueva ─────────
//
// Sustituye al trámite manual: hasta el 17 nov 2026, quien no recordaba su
// respuesta de seguridad escribía al propietario y éste le generaba una
// contraseña a mano contra D1.
//
// Lo que se manda es un ENLACE y no una contraseña nueva. Importa el por qué:
// una contraseña generada aquí tendría que pisar la que hay, y entonces
// cualquiera que conozca tu dirección puede dejarte fuera de tu propia cuenta
// sin saber nada más de ti. Con el enlace, **la contraseña actual sigue
// funcionando** hasta que su dueño elige otra.
export async function recoverByEmail(request, db, env, cors) {
  // Dos límites, y hacen falta los dos: por IP para que nadie vacíe la cuota
  // diaria de envíos, y por cuenta para que nadie use esto para bombardear el
  // buzón de otra persona. Ninguno pasa por D1 — contar en D1 significa
  // escribir, y eso fue el 100 % de las escrituras del día del aviso.
  const porIp = await limitar(env, { binding: 'RATE_LIMITER_MAIL', clave: `mail:ip:${getClientIp(request)}` });
  if (!porIp.ok) return error(porIp.error, 429, { ...cors, 'Retry-After': '60' });

  let body;
  try {
    body = await request.json();
  } catch {
    return error('invalid_json', 400, cors);
  }
  const identificador = leerIdentificador(body);
  if (!validators.identifier(identificador)) return error('invalid_identifier', 400, cors);

  const user = await buscarPorIdentificador(db, identificador, 'id, nickname, email, password_hash, is_disabled');

  // Cuenta que no existe, cuenta sin correo y cuenta desactivada: las tres
  // responden lo mismo que un envío correcto. La respuesta NO puede depender de
  // si la cuenta existe, o este endpoint se convierte en un comprobador de
  // direcciones. La pantalla sólo ofrece el botón cuando `hasEmail` dijo que sí
  // (ver `getRecoverQuestion`), así que nadie se queda esperando un correo que
  // no se envió.
  if (!user || !user.email || user.is_disabled) return json({ ok: true }, 200, cors);

  const porCuenta = await limitar(env, { binding: 'RATE_LIMITER_MAIL', clave: `mail:cuenta:${user.id}` });
  if (!porCuenta.ok) return error(porCuenta.error, 429, { ...cors, 'Retry-After': '60' });

  const token = await makeToken(user.id, env.JWT_SECRET, RESET_MAIL_TTL_MS, {
    pv: await huellaDeContrasena(user.password_hash),
  });
  const base = (env.SITE_URL || 'https://robible.com').replace(/\/+$/, '');
  const url = `${base}/?recuperare=${encodeURIComponent(token)}`;

  const { asunto, html, texto } = correoRecuperacion(body?.locale, { nickname: user.nickname, url });
  const envio = await enviarCorreo(env, { para: user.email, asunto, html, texto });

  // Un fallo de envío sí se cuenta. No depende de la cuenta —la clave que falta
  // o la cuota agotada son nuestras, no suyas—, así que no filtra nada, y
  // callarlo dejaría a la persona esperando delante del buzón.
  if (!envio.ok) return error(envio.motivo || 'mail_failed', 502, cors);

  return json({ ok: true }, 200, cors);
}

// ── RECOVER STEP 3: reset password ─────────────────────
export async function resetPassword(request, db, env, cors) {
  const rl = await checkRateLimit(db, request, 'recover', env);
  if (!rl.ok) return error(rl.error, 429, { ...cors, 'Retry-After': String(rl.retryAfter || 60) });

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { resetToken, newPassword } = body || {};
  if (!resetToken || !newPassword) return error('missing_fields', 400, cors);
  if (!validators.password(newPassword)) return error('invalid_password', 400, cors);

  const payload = await readToken(resetToken, env.JWT_SECRET);
  if (!payload) return error('reset_token_expired', 401, cors);

  // ── Un solo uso ──────────────────────────────────────────────────────────
  // El token lleva la huella de la contraseña que había cuando se emitió, así
  // que hay que leer la de ahora ANTES de escribir la nueva. Si no coinciden,
  // esta contraseña ya se cambió y el enlace está gastado: con el enlace del
  // correo eso es lo que impide que quien lo reenvíe por error —o quien lea el
  // buzón un mes después— vuelva a entrar con él.
  //
  // `pv` se comprueba sólo si viene: un token emitido por la versión anterior
  // no lo tiene y tiene que seguir funcionando durante su ventana.
  const actual = await db.prepare('SELECT id, password_hash FROM users WHERE id = ?').bind(payload.sub).first();
  if (!actual) return error('user_not_found', 404, cors);
  if (payload.pv && payload.pv !== (await huellaDeContrasena(actual.password_hash))) {
    return error('reset_token_used', 401, cors);
  }

  const newSalt = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  const newHash = await hashValue(newPassword, newSalt);

  const now = nowIso();
  const result = await db
    .prepare(
      'UPDATE users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?',
    )
    .bind(newSalt, newHash, now, payload.sub)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return error('user_not_found', 404, cors);
  }

  // Generar nueva sesión automáticamente
  const token = await makeToken(payload.sub, env.JWT_SECRET);
  await saveSession(db, token, payload.sub, request);

  const user = await db
    .prepare(
      `SELECT id, nickname, user_type, email, is_admin, full_name, birth_date, church,
              country, confession, motto, plan, created_at, updated_at
       FROM users WHERE id = ?`,
    )
    .bind(payload.sub)
    .first();

  return json({
    ok: true,
    user: {
      id: user.id,
      nickname: user.nickname,
      userType: user.user_type || 'user',
      email: user.email || null,
      isAdmin: !!user.is_admin,
      fullName: user.full_name || null,
      birthDate: user.birth_date || null,
      church: user.church || null,
      country: user.country || null,
      confession: user.confession || null,
      motto: user.motto || null,
      plan: user.plan || 'free',
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    token,
  }, 200, cors);
}

// ── ME (current user) ──────────────────────────────────
export async function me(request, db, env, cors) {
  const auth = await requireAuth(request, db, env);
  if (!auth.user) return error(auth.error, 401, cors);
  return json({ ok: true, user: auth.user }, 200, cors);
}

// ── LOGOUT ──────────────────────────────────────────────
export async function logout(request, db, env, cors) {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match) {
    await deleteSession(db, match[1].trim());
  }
  return json({ ok: true }, 200, cors);
}

// ── CHANGE PASSWORD (autenticado) ──────────────────────
export async function changePassword(request, db, env, cors) {
  const auth = await requireAuth(request, db, env);
  if (!auth.user) return error(auth.error, 401, cors);

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { currentPassword, newPassword } = body || {};
  if (!currentPassword || !validators.password(newPassword)) {
    return error('invalid_password', 400, cors);
  }

  const user = await db
    .prepare('SELECT password_salt, password_hash FROM users WHERE id = ?')
    .bind(auth.user.id)
    .first();
  const valid = await verifyHash(currentPassword, user.password_salt, user.password_hash);
  if (!valid) return error('invalid_current_password', 401, cors);

  const newSalt = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  const newHash = await hashValue(newPassword, newSalt);
  await db
    .prepare('UPDATE users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(newSalt, newHash, nowIso(), auth.user.id)
    .run();

  return json({ ok: true }, 200, cors);
}

// ── ACTUALIZAR PERFIL ───────────────────────────────────
//
// Cambia el tipo de cuenta, el email o la pregunta de seguridad. Todo opcional:
// se toca sólo lo que venga en el cuerpo.
//
// Cambiar de tipo NO borra nada. Un predicador que pase a usuario normal
// conserva sus predicaciones; simplemente deja de ver el menú. Así volver atrás
// no cuesta nada y nadie pierde trabajo por probar.
export async function updateProfile(request, db, env, cors) {
  const auth = await requireAuth(request, db, env);
  if (!auth.user) return error(auth.error, 401, cors);

  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { userType, nickname, email, currentPassword, securityQuestionText, securityAnswer, fullName, birthDate, church, country, confession, motto } = body || {};

  const campos = [];
  const valores = [];

  if (userType !== undefined) {
    if (!validators.userType(userType)) return error('invalid_user_type', 400, cors);
    campos.push('user_type = ?');
    valores.push(userType);
  }

  // ── Nombre de usuario (17 nov 2026) ────────────────────
  //
  // Se puede cambiar siempre que no lo tenga otro. No lleva contraseña actual
  // porque no abre ninguna puerta: no sirve para recuperar la cuenta y cambiarlo
  // no deja a nadie fuera.
  //
  // Lo que sí arrastra, y está bien así: la firma de una predicación publicada
  // sale de un `JOIN users` (ver `paraElPublico` en sermons.js), así que se
  // actualiza sola; el `public_slug` no contiene el apodo, así que ningún
  // enlace repartido se rompe; y las sesiones cuelgan del id, así que nadie
  // pierde la suya al renombrarse.
  if (nickname !== undefined) {
    if (!validators.nickname(nickname)) return error('invalid_nickname', 400, cors);
    const normalizado = nickname.trim().toLowerCase();
    // En minúsculas, como lo guarda `register`. No se introduce una segunda
    // forma "para mostrar": serían dos versiones del mismo dato y la firma
    // pública y el login acabarían discrepando.
    if (normalizado !== auth.user.nickname) {
      const ocupado = await db
        .prepare('SELECT id FROM users WHERE nickname = ? AND id != ?')
        .bind(normalizado, auth.user.id)
        .first();
      if (ocupado) return error('nickname_taken', 409, cors);
      campos.push('nickname = ?');
      valores.push(normalizado);
    }
  }

  if (email !== undefined) {
    // Mandar cadena vacía o null es la forma de quitarlo.
    const limpio = normalizarEmail(email);
    if (limpio && !validators.email(limpio)) return error('invalid_email', 400, cors);
    const anterior = auth.user.email || '';
    // Sólo se pide contraseña cuando el correo CAMBIA de verdad. Guardar el
    // formulario sin tocarlo —al editar el apodo, por ejemplo— no tiene por qué
    // exigir nada.
    if (limpio !== anterior) {
      // ── Por qué aquí sí se pide la contraseña actual ────────────────────
      // El correo es el canal con el que se recupera la cuenta: quien se siente
      // delante de una sesión abierta —un móvil desbloqueado, el ordenador de
      // la iglesia— podría ponerse el suyo y quedarse con la cuenta para
      // siempre, sin saber la contraseña. Es la misma razón por la que
      // `changePassword` pide la actual.
      if (!currentPassword) return error('invalid_current_password', 401, cors);
      const credenciales = await db
        .prepare('SELECT password_salt, password_hash FROM users WHERE id = ?')
        .bind(auth.user.id)
        .first();
      const valida = await verifyHash(currentPassword, credenciales.password_salt, credenciales.password_hash);
      if (!valida) return error('invalid_current_password', 401, cors);

      if (limpio) {
        const ocupado = await db
          .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
          .bind(limpio, auth.user.id)
          .first();
        if (ocupado) return error('email_taken', 409, cors);
      }
      campos.push('email = ?');
      valores.push(limpio || null);
    }
  }

  // ── Perfil opcional (schema_version 13) ────────────────
  // Los cinco son independientes entre sí y de todo lo demás: se tocan sólo
  // los que vengan en el body, igual que el email de arriba.
  const camposTexto = {
    fullName: { columna: 'full_name', codigo: 'invalid_full_name' },
    church: { columna: 'church', codigo: 'invalid_church' },
    country: { columna: 'country', codigo: 'invalid_country' },
    confession: { columna: 'confession', codigo: 'invalid_confession' },
    // Lema personal (schema_version 14). Entra por la misma puerta que los
    // otros cuatro: opcional, independiente y con '' como "quítamelo".
    motto: { columna: 'motto', codigo: 'invalid_motto' },
  };
  for (const [clave, { columna, codigo }] of Object.entries(camposTexto)) {
    const valor = { fullName, church, country, confession, motto }[clave];
    if (valor === undefined) continue;
    if (!validators[clave](valor)) return error(codigo, 400, cors);
    campos.push(`${columna} = ?`);
    valores.push(valor.trim() || null);
  }
  if (birthDate !== undefined) {
    if (!validators.birthDate(birthDate)) return error('invalid_birth_date', 400, cors);
    campos.push('birth_date = ?');
    valores.push(birthDate.trim() || null);
  }

  // La pregunta y la respuesta se cambian juntas o no se cambian: dejar una
  // pregunta nueva con la respuesta vieja deja al usuario sin poder recuperar
  // la cuenta, y encima sin enterarse hasta que la necesite.
  if (securityQuestionText !== undefined || securityAnswer !== undefined) {
    if (!validators.securityQuestionText(securityQuestionText)) {
      return error('invalid_security_question', 400, cors);
    }
    if (!validators.securityAnswer(securityAnswer)) {
      return error('invalid_security_answer', 400, cors);
    }
    const salt = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    const hash = await hashValue(normalizeSecurityAnswer(securityAnswer), salt);
    campos.push('sec_question = ?', 'sec_question_text = ?', 'sec_answer_salt = ?', 'sec_answer_hash = ?');
    valores.push('custom', securityQuestionText.trim(), salt, hash);
  }

  if (!campos.length) return error('missing_fields', 400, cors);

  const now = nowIso();
  campos.push('updated_at = ?');
  valores.push(now, auth.user.id);

  // El `try` es por las dos columnas únicas (`nickname` y, desde el schema 17,
  // `email`): las comprobaciones de arriba cubren el caso normal, pero dos
  // peticiones simultáneas pueden colarse entre el SELECT y el UPDATE y
  // entonces quien lo caza es la base de datos. Sin esto, el usuario recibiría
  // un 500 sin explicación en vez de «ese nombre ya está ocupado».
  try {
    await db
      .prepare(`UPDATE users SET ${campos.join(', ')} WHERE id = ?`)
      .bind(...valores)
      .run();
  } catch (e) {
    const mensaje = String(e?.message || '');
    if (/UNIQUE|constraint/i.test(mensaje)) {
      return error(/email/i.test(mensaje) ? 'email_taken' : 'nickname_taken', 409, cors);
    }
    throw e;
  }

  const actualizado = await db
    .prepare(
      `SELECT id, nickname, user_type, email, is_admin, full_name, birth_date, church,
              country, confession, motto, plan, created_at, updated_at
       FROM users WHERE id = ?`,
    )
    .bind(auth.user.id)
    .first();

  // La respuesta de seguridad nunca vuelve en claro, ni siquiera al dueño:
  // lo que se guarda es un hash y no hay forma de reconstruirla.
  return json({
    ok: true,
    user: {
      id: actualizado.id,
      nickname: actualizado.nickname,
      userType: actualizado.user_type || 'user',
      email: actualizado.email || null,
      isAdmin: !!actualizado.is_admin,
      fullName: actualizado.full_name || null,
      birthDate: actualizado.birth_date || null,
      church: actualizado.church || null,
      country: actualizado.country || null,
      confession: actualizado.confession || null,
      motto: actualizado.motto || null,
      plan: actualizado.plan || 'free',
      createdAt: actualizado.created_at,
      updatedAt: actualizado.updated_at,
    },
  }, 200, cors);
}
