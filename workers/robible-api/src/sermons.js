// Endpoints del módulo «Predicile mele».
//
// Van en su propio archivo y no en data.js porque aquél ya reúne topics,
// favoritos, notas, subrayados y búsquedas, y esto es un dominio aparte con su
// propio ciclo de vida (borrador → preparada → predicada).
//
// **Nota deliberada sobre permisos**: aquí NO se comprueba que el usuario sea
// `preacher`. El tipo de cuenta decide qué menús se ven, no de quién son los
// datos. Si alguien vuelve a `user`, sus predicaciones siguen siendo suyas y
// accesibles; bloquear el acceso las escondería sin borrarlas, que es la peor
// de las dos opciones. La especificación es explícita: cambiar de tipo no debe
// perder información.

import { validators, nowIso, genId, genPublicSlug, json, error } from './utils.js';

const normalizeRow = (r) => ({
  id: r.id,
  title: r.title || null,
  book: r.book,
  chapter: r.chapter,
  verseStart: r.verse_start,
  verseEnd: r.verse_end,
  version: r.version || null,
  type: r.type,
  status: r.status,
  series: r.series || null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  preparedAt: r.prepared_at || null,
  preachedAt: r.preached_at || null,
  isPublic: !!r.is_public,
  publicSlug: r.public_slug || null,
  publishedAt: r.published_at || null,
});

/**
 * GET /api/sermons — cabeceras para la pantalla de lista.
 *
 * No devuelve `content_json` ni `outline_json` a propósito: son el grueso de
 * los datos y la lista sólo pinta título, pasaje, tipo, estado y fecha. Con
 * veinte predicaciones preparadas, la diferencia entre mandar todo y mandar
 * esto son megabytes en cada carga de pantalla.
 */
export async function listSermons(db, userId) {
  const rows = await db
    .prepare(
      `SELECT id, title, book, chapter, verse_start, verse_end, version,
              type, status, series, created_at, updated_at, prepared_at, preached_at,
              is_public, public_slug, published_at
       FROM sermons WHERE user_id = ? ORDER BY updated_at DESC`,
    )
    .bind(userId)
    .all();
  return { sermons: (rows.results || []).map(normalizeRow) };
}

/** GET /api/sermons/:id — la predicación entera, con preparación y schiță. */
export async function getSermon(db, userId, sermonId) {
  const r = await db
    .prepare('SELECT * FROM sermons WHERE id = ? AND user_id = ?')
    .bind(sermonId, userId)
    .first();
  if (!r) return null;
  return { ...normalizeRow(r), content: r.content_json || null, outline: r.outline_json || null };
}

export async function getSermonResponse(db, userId, sermonId, cors) {
  const sermon = await getSermon(db, userId, sermonId);
  if (!sermon) return error('sermon_not_found', 404, cors);
  return json({ ok: true, sermon }, 200, cors);
}

// POST /api/sermons
export async function createSermon(request, db, userId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { title, book, chapter, verseStart, verseEnd, version, type, series } = body || {};

  // El pasaje es obligatorio: una predicación expositiva sin texto no tiene por
  // dónde empezar, y el flujo entero se apoya en la perícopa.
  if (!validators.verseRef({ book, chapter, verse: verseStart })) {
    return error('invalid_verse_ref', 400, cors);
  }
  const fin = verseEnd === undefined || verseEnd === null ? verseStart : verseEnd;
  if (!Number.isInteger(fin) || fin < verseStart) return error('invalid_verse_range', 400, cors);

  const tipo = type || 'expositive';
  if (!validators.sermonType(tipo)) return error('invalid_sermon_type', 400, cors);
  if (title !== undefined && title !== null && !validators.sermonTitle(title)) {
    return error('invalid_sermon_title', 400, cors);
  }
  if (series !== undefined && series !== null && !validators.sermonSeries(series)) {
    return error('invalid_sermon_series', 400, cors);
  }
  if (version !== undefined && version !== null && !validators.bibleVersion(version)) {
    return error('invalid_bible_version', 400, cors);
  }

  const id = genId('sermon');
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO sermons (id, user_id, title, book, chapter, verse_start, verse_end,
                            version, type, status, series, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    )
    .bind(id, userId, title?.trim() || null, book, chapter, verseStart, fin,
      version || null, tipo, series?.trim() || null, now, now)
    .run();

  return json({
    ok: true,
    sermon: {
      id,
      title: title?.trim() || null,
      book, chapter, verseStart, verseEnd: fin,
      version: version || null,
      type: tipo,
      status: 'draft',
      series: series?.trim() || null,
      createdAt: now, updatedAt: now, preparedAt: null, preachedAt: null,
      content: null, outline: null,
    },
  }, 201, cors);
}

/**
 * PATCH /api/sermons/:id — actualización parcial.
 *
 * Es el endpoint del guardado automático, así que llega a menudo y con trozos
 * pequeños: sólo se tocan los campos presentes en el cuerpo.
 */
export async function updateSermon(request, db, userId, sermonId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }

  const existing = await db
    .prepare('SELECT id, title, is_public, public_slug FROM sermons WHERE id = ? AND user_id = ?')
    .bind(sermonId, userId)
    .first();
  if (!existing) return error('sermon_not_found', 404, cors);

  const campos = [];
  const valores = [];
  const b = body || {};
  const asignar = (columna, valor) => { campos.push(`${columna} = ?`); valores.push(valor); };

  if (b.title !== undefined) {
    if (b.title !== null && !validators.sermonTitle(b.title)) return error('invalid_sermon_title', 400, cors);
    asignar('title', b.title?.trim() || null);
  }
  if (b.series !== undefined) {
    if (b.series !== null && !validators.sermonSeries(b.series)) return error('invalid_sermon_series', 400, cors);
    asignar('series', b.series?.trim() || null);
  }
  if (b.type !== undefined) {
    if (!validators.sermonType(b.type)) return error('invalid_sermon_type', 400, cors);
    asignar('type', b.type);
  }
  if (b.content !== undefined) {
    if (!validators.sermonContent(b.content)) return error('sermon_content_too_large', 400, cors);
    asignar('content_json', b.content);
  }
  if (b.outline !== undefined) {
    if (!validators.sermonOutline(b.outline)) return error('sermon_content_too_large', 400, cors);
    asignar('outline_json', b.outline);
  }

  // El pasaje se puede corregir mientras se prepara.
  if (b.book !== undefined || b.chapter !== undefined || b.verseStart !== undefined || b.verseEnd !== undefined) {
    if (!validators.verseRef({ book: b.book, chapter: b.chapter, verse: b.verseStart })) {
      return error('invalid_verse_ref', 400, cors);
    }
    const fin = b.verseEnd ?? b.verseStart;
    if (!Number.isInteger(fin) || fin < b.verseStart) return error('invalid_verse_range', 400, cors);
    asignar('book', b.book);
    asignar('chapter', b.chapter);
    asignar('verse_start', b.verseStart);
    asignar('verse_end', fin);
  }

  const now = nowIso();
  if (b.status !== undefined) {
    if (!validators.sermonStatus(b.status)) return error('invalid_sermon_status', 400, cors);
    asignar('status', b.status);
    // Las fechas se derivan del estado y no las manda el cliente: así nadie
    // puede afirmar que predicó algo el año pasado.
    if (b.status === 'ready') asignar('prepared_at', now);
    if (b.status === 'preached') asignar('preached_at', now);
  }

  // ── Publicar / despublicar ──────────────────────────────────────────────
  //
  // Misma mecánica que los temas: el slug se genera **una sola vez** y se
  // conserva al despublicar. Si el predicador quita la predicación de internet
  // y luego se arrepiente, el enlace que ya repartió por WhatsApp sigue
  // valiendo; generar uno nuevo rompería todos los que están por ahí fuera.
  if (b.isPublic !== undefined) {
    if (typeof b.isPublic !== 'boolean') return error('invalid_is_public', 400, cors);

    let slug = existing.public_slug;
    if (b.isPublic && !slug) {
      for (let intento = 0; intento < 5 && !slug; intento += 1) {
        const candidato = genPublicSlug(existing.title || 'predica');
        const chocado = await db
          .prepare('SELECT id FROM sermons WHERE public_slug = ?')
          .bind(candidato)
          .first();
        if (!chocado) slug = candidato;
      }
      if (!slug) return error('slug_generation_failed', 500, cors);
    }

    asignar('is_public', b.isPublic ? 1 : 0);
    asignar('public_slug', slug || null);
    // La fecha de publicación se pone la primera vez y no se toca después: es
    // la que ordena el listado público y la que ve un buscador.
    if (b.isPublic && !existing.is_public) asignar('published_at', nowIso());
  }

  if (!campos.length) return error('missing_fields', 400, cors);

  asignar('updated_at', now);
  valores.push(sermonId, userId);

  await db
    .prepare(`UPDATE sermons SET ${campos.join(', ')} WHERE id = ? AND user_id = ?`)
    .bind(...valores)
    .run();

  return json({ ok: true, sermon: await getSermon(db, userId, sermonId) }, 200, cors);
}

// DELETE /api/sermons/:id
export async function removeSermon(db, userId, sermonId, cors) {
  const result = await db
    .prepare('DELETE FROM sermons WHERE id = ? AND user_id = ?')
    .bind(sermonId, userId)
    .run();
  if (!result.meta || result.meta.changes === 0) return error('sermon_not_found', 404, cors);
  return json({ ok: true }, 200, cors);
}

// ── Predicaciones públicas (sin auth) ─────────────────────────────────────
//
// De una predicación publicada salen el título, el pasaje, la schiță y el
// desarrollo, y **nada del usuario**: ni id, ni nickname, ni fechas de la
// cuenta. Compartir una predicación no debe permitir averiguar quién la
// escribió ni cuántas tiene.
//
// Lo que se publica es la predicación **en limpio**, no el cuaderno de
// preparación: fuera observación, contexto y notas de estudio. Son apuntes
// personales, a menudo con dudas del propio predicador, y no lo que quiso
// compartir.

/** Lo que ve un lector cualquiera. */
const paraElPublico = (r) => {
  let contenido = null;
  try { contenido = r.content_json ? JSON.parse(r.content_json) : null; } catch { contenido = null; }

  const puntos = (contenido?.structure || []).map((punto) => {
    const d = contenido?.development?.[punto.id] || {};
    return {
      title: punto.title || '',
      subpoints: (punto.subpoints || []).map((s) => s.title || '').filter(Boolean),
      explain: d.explain || '',
      illustrate: d.illustrate || '',
      apply: d.apply || '',
      refs: [...(punto.refs || []), ...(d.refs || [])]
        .filter((x) => x?.label)
        .map((x) => ({ label: x.label, text: x.text || '' })),
    };
  });

  return {
    slug: r.public_slug,
    title: r.title || '',
    book: r.book,
    chapter: r.chapter,
    verseStart: r.verse_start,
    verseEnd: r.verse_end,
    version: r.version || null,
    type: r.type,
    publishedAt: r.published_at || null,
    idea: contenido?.idea?.central || '',
    intro: contenido?.intro || '',
    conclusion: contenido?.conclusion || '',
    points: puntos,
  };
};

// GET /api/public/sermons/:slug
export async function getPublicSermon(db, slug, cors) {
  if (!validators.publicSlug(slug)) return error('sermon_not_found', 404, cors);

  const r = await db
    .prepare(
      `SELECT public_slug, title, book, chapter, verse_start, verse_end, version,
              type, published_at, content_json
       FROM sermons WHERE public_slug = ? AND is_public = 1`,
    )
    .bind(slug)
    .first();
  // Una despublicada responde 404 igual que una inexistente: no interesa
  // confirmar que el slug existió.
  if (!r) return error('sermon_not_found', 404, cors);

  return json({ ok: true, sermon: paraElPublico(r) }, 200, cors);
}

/**
 * GET /api/public/sermons — las últimas publicadas.
 *
 * Alimenta la sección de la landing y el sitemap. Sólo devuelve cabeceras: la
 * lista no necesita el desarrollo entero y mandarlo serían megabytes por
 * visita a la portada.
 *
 * Se excluyen las que no tienen ni un punto: una predicación publicada vacía
 * sería una página en blanco, justo el contenido fino que no conviene indexar.
 */
export async function listPublicSermons(db, cors, limite = 60) {
  const rows = await db
    .prepare(
      `SELECT public_slug, title, book, chapter, verse_start, verse_end, version,
              type, published_at, content_json
       FROM sermons
       WHERE is_public = 1 AND public_slug IS NOT NULL
       ORDER BY published_at DESC
       LIMIT ?`,
    )
    .bind(Math.min(Math.max(1, limite), 200))
    .all();

  const sermons = (rows.results || [])
    .map((r) => {
      const s = paraElPublico(r);
      return {
        slug: s.slug,
        title: s.title,
        book: s.book,
        chapter: s.chapter,
        verseStart: s.verseStart,
        verseEnd: s.verseEnd,
        version: s.version,
        type: s.type,
        publishedAt: s.publishedAt,
        idea: s.idea,
        points: s.points.length,
      };
    })
    .filter((s) => s.points > 0 && s.title);

  return json({ ok: true, sermons }, 200, cors);
}
