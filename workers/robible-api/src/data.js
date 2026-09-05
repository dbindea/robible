// Data endpoints: topics + verse_refs + favorites + notes + highlights + searches + export
import {
  validators,
  nowIso,
  genId,
  genShortId,
  json,
  error,
} from './utils.js';

// ── TOPICS ──────────────────────────────────────────────

// GET /api/topics — listar todos los topics del user con sus verse_refs
export async function listTopics(db, userId) {
  const topics = await db
    .prepare(
      `SELECT id, name, icon, color, is_default, created_at
       FROM topics WHERE user_id = ? ORDER BY created_at ASC`,
    )
    .bind(userId)
    .all();

  const verseRefsRows = await db
    .prepare(
      `SELECT id, topic_id, book, chapter, verse, added_at
       FROM verse_refs WHERE user_id = ? ORDER BY added_at ASC`,
    )
    .bind(userId)
    .all();

  // Agrupar verse_refs por topic_id
  const verseRefs = {};
  for (const ref of verseRefsRows.results || []) {
    if (!verseRefs[ref.topic_id]) verseRefs[ref.topic_id] = [];
    verseRefs[ref.topic_id].push({
      id: ref.id,
      book: ref.book,
      chapter: ref.chapter,
      verse: ref.verse,
      addedAt: ref.add_at || ref.added_at,
    });
  }

  return {
    topics: (topics.results || []).map((t) => ({
      id: t.id,
      name: t.name,
      icon: t.icon,
      color: t.color,
      isDefault: !!t.is_default,
      createdAt: t.created_at,
    })),
    verseRefs,
  };
}

// POST /api/topics
export async function createTopic(request, db, userId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { name, icon = '📌', color = '#2E7D9B' } = body || {};
  if (!validators.topicName(name)) return error('invalid_name', 400, cors);
  if (!validators.icon(icon)) return error('invalid_icon', 400, cors);
  if (!validators.color(color)) return error('invalid_color', 400, cors);

  // Comprobar duplicado
  const dup = await db
    .prepare('SELECT id FROM topics WHERE user_id = ? AND name = ?')
    .bind(userId, name.trim())
    .first();
  if (dup) return error('topic_name_taken', 409, cors);

  const id = genShortId('topic', name);
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO topics (id, user_id, name, icon, color, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
    )
    .bind(id, userId, name.trim(), icon, color, now)
    .run();

  return json({
    ok: true,
    topic: { id, name: name.trim(), icon, color, isDefault: false, createdAt: now },
  }, 201, cors);
}

// PATCH /api/topics/:id
export async function updateTopic(request, db, userId, topicId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { name, icon, color } = body || {};

  const existing = await db
    .prepare('SELECT id, name, icon, color, is_default FROM topics WHERE id = ? AND user_id = ?')
    .bind(topicId, userId)
    .first();
  if (!existing) return error('topic_not_found', 404, cors);

  const newName = name !== undefined ? (validators.topicName(name) ? name.trim() : null) : existing.name;
  if (newName === null) return error('invalid_name', 400, cors);
  const newIcon = icon !== undefined ? (validators.icon(icon) ? icon : null) : existing.icon;
  if (newIcon === null) return error('invalid_icon', 400, cors);
  const newColor = color !== undefined ? (validators.color(color) ? color : null) : existing.color;
  if (newColor === null) return error('invalid_color', 400, cors);

  await db
    .prepare(
      `UPDATE topics SET name = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?`,
    )
    .bind(newName, newIcon, newColor, topicId, userId)
    .run();

  return json({
    ok: true,
    topic: {
      id: topicId,
      name: newName,
      icon: newIcon,
      color: newColor,
      isDefault: !!existing.is_default,
      createdAt: existing.created_at || null,
    },
  }, 200, cors);
}

// DELETE /api/topics/:id
export async function deleteTopic(db, userId, topicId, cors) {
  const existing = await db
    .prepare('SELECT is_default FROM topics WHERE id = ? AND user_id = ?')
    .bind(topicId, userId)
    .first();
  if (!existing) return error('topic_not_found', 404, cors);
  if (existing.is_default) return error('cannot_delete_default', 403, cors);

  await db
    .prepare('DELETE FROM topics WHERE id = ? AND user_id = ?')
    .bind(topicId, userId)
    .run();
  return json({ ok: true }, 200, cors);
}

// ── VERSE REFS ──────────────────────────────────────────

// POST /api/topics/:id/verses
export async function addVerseRef(request, db, userId, topicId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { book, chapter, verse } = body || {};
  if (!validators.verseRef({ book, chapter, verse })) {
    return error('invalid_verse_ref', 400, cors);
  }

  // Verificar que el topic pertenece al user
  const topic = await db
    .prepare('SELECT id FROM topics WHERE id = ? AND user_id = ?')
    .bind(topicId, userId)
    .first();
  if (!topic) return error('topic_not_found', 404, cors);

  // Comprobar duplicado
  const dup = await db
    .prepare(
      'SELECT id FROM verse_refs WHERE topic_id = ? AND book = ? AND chapter = ? AND verse = ?',
    )
    .bind(topicId, book, chapter, verse)
    .first();
  if (dup) return error('verse_already_in_topic', 409, cors);

  const id = genId('vref');
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO verse_refs (id, user_id, topic_id, book, chapter, verse, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, topicId, book, chapter, verse, now)
    .run();

  return json({
    ok: true,
    verseRef: { id, book, chapter, verse, addedAt: now },
  }, 201, cors);
}

// DELETE /api/topics/:id/verses (body: { book, chapter, verse })
export async function removeVerseRef(request, db, userId, topicId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { book, chapter, verse } = body || {};
  if (!validators.verseRef({ book, chapter, verse })) {
    return error('invalid_verse_ref', 400, cors);
  }

  const result = await db
    .prepare(
      `DELETE FROM verse_refs WHERE topic_id = ? AND user_id = ? AND book = ? AND chapter = ? AND verse = ?`,
    )
    .bind(topicId, userId, book, chapter, verse)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return error('verse_not_found', 404, cors);
  }
  return json({ ok: true }, 200, cors);
}

// ── FAVORITES ───────────────────────────────────────────

// GET /api/favorites
export async function listFavorites(db, userId) {
  const rows = await db
    .prepare(
      `SELECT id, book, chapter, verse, added_at
       FROM favorites WHERE user_id = ? ORDER BY added_at DESC`,
    )
    .bind(userId)
    .all();
  return {
    favorites: (rows.results || []).map((r) => ({
      id: r.id,
      book: r.book,
      chapter: r.chapter,
      verse: r.verse,
      addedAt: r.added_at,
    })),
  };
}

// POST /api/favorites
export async function addFavorite(request, db, userId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { book, chapter, verse } = body || {};
  if (!validators.verseRef({ book, chapter, verse })) {
    return error('invalid_verse_ref', 400, cors);
  }

  const dup = await db
    .prepare(
      'SELECT id FROM favorites WHERE user_id = ? AND book = ? AND chapter = ? AND verse = ?',
    )
    .bind(userId, book, chapter, verse)
    .first();
  if (dup) return error('favorite_already_exists', 409, cors);

  const id = genId('fav');
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO favorites (id, user_id, book, chapter, verse, added_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, book, chapter, verse, now)
    .run();

  return json({
    ok: true,
    favorite: { id, book, chapter, verse, addedAt: now },
  }, 201, cors);
}

// DELETE /api/favorites (body: { book, chapter, verse })
export async function removeFavorite(request, db, userId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { book, chapter, verse } = body || {};
  if (!validators.verseRef({ book, chapter, verse })) {
    return error('invalid_verse_ref', 400, cors);
  }

  const result = await db
    .prepare(
      `DELETE FROM favorites WHERE user_id = ? AND book = ? AND chapter = ? AND verse = ?`,
    )
    .bind(userId, book, chapter, verse)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return error('favorite_not_found', 404, cors);
  }
  return json({ ok: true }, 200, cors);
}

// ── NOTES ────────────────────────────────────────────────

// GET /api/notes
export async function listNotes(db, userId) {
  const rows = await db
    .prepare(
      `SELECT id, book, chapter, verse, text, color, created_at, updated_at
       FROM notes WHERE user_id = ? ORDER BY book ASC, chapter ASC, verse ASC`,
    )
    .bind(userId)
    .all();
  return {
    notes: (rows.results || []).map((r) => ({
      id: r.id,
      book: r.book,
      chapter: r.chapter,
      verse: r.verse,
      text: r.text,
      color: r.color,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

// POST /api/notes — upsert (sobrescribe si ya existe nota en ese versículo)
export async function upsertNote(request, db, userId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { book, chapter, verse, text, color } = body || {};

  if (!validators.verseRef({ book, chapter, verse })) {
    return error('invalid_verse_ref', 400, cors);
  }
  if (!validators.noteText(text)) {
    return error('invalid_note_text', 400, cors);
  }
  if (color !== undefined && color !== null && !validators.color(color)) {
    return error('invalid_color', 400, cors);
  }

  const now = nowIso();
  const id = genId('note');

  // Upsert: INSERT OR REPLACE sobre la constraint UNIQUE(user_id, book, chapter, verse)
  await db
    .prepare(
      `INSERT INTO notes (id, user_id, book, chapter, verse, text, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, book, chapter, verse) DO UPDATE SET
         text = excluded.text,
         color = excluded.color,
         updated_at = excluded.updated_at`,
    )
    .bind(id, userId, book, chapter, verse, text.trim(), color || null, now, now)
    .run();

  return json({
    ok: true,
    note: { id, book, chapter, verse, text: text.trim(), color: color || null, createdAt: now, updatedAt: now },
  }, 201, cors);
}

// DELETE /api/notes (body: { book, chapter, verse })
export async function removeNote(request, db, userId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { book, chapter, verse } = body || {};
  if (!validators.verseRef({ book, chapter, verse })) {
    return error('invalid_verse_ref', 400, cors);
  }

  const result = await db
    .prepare(
      `DELETE FROM notes WHERE user_id = ? AND book = ? AND chapter = ? AND verse = ?`,
    )
    .bind(userId, book, chapter, verse)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return error('note_not_found', 404, cors);
  }
  return json({ ok: true }, 200, cors);
}

// ── HIGHLIGHTS (subrayados de color) ─────────────────────

// GET /api/highlights
export async function listHighlights(db, userId) {
  const rows = await db
    .prepare(
      `SELECT id, book, chapter, verse, color, created_at, updated_at
       FROM highlights WHERE user_id = ? ORDER BY book ASC, chapter ASC, verse ASC`,
    )
    .bind(userId)
    .all();
  return {
    highlights: (rows.results || []).map((r) => ({
      id: r.id,
      book: r.book,
      chapter: r.chapter,
      verse: r.verse,
      color: r.color,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

// POST /api/highlights — upsert (repintar un versículo no crea una fila nueva)
export async function upsertHighlight(request, db, userId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { book, chapter, verse, color } = body || {};

  if (!validators.verseRef({ book, chapter, verse })) {
    return error('invalid_verse_ref', 400, cors);
  }
  if (!validators.color(color)) {
    return error('invalid_color', 400, cors);
  }

  const now = nowIso();
  const id = genId('hl');

  await db
    .prepare(
      `INSERT INTO highlights (id, user_id, book, chapter, verse, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, book, chapter, verse) DO UPDATE SET
         color = excluded.color,
         updated_at = excluded.updated_at`,
    )
    .bind(id, userId, book, chapter, verse, color, now, now)
    .run();

  // Se relee la fila en vez de devolver `id` y `now` a secas: cuando el upsert
  // cae en el ON CONFLICT, la fila conserva su id y su created_at originales, y
  // devolver los recién generados dejaba al cliente con un id que no existe en
  // la base de datos.
  const row = await db
    .prepare(
      `SELECT id, created_at, updated_at FROM highlights
       WHERE user_id = ? AND book = ? AND chapter = ? AND verse = ?`,
    )
    .bind(userId, book, chapter, verse)
    .first();

  return json({
    ok: true,
    highlight: {
      id: row?.id || id,
      book,
      chapter,
      verse,
      color,
      createdAt: row?.created_at || now,
      updatedAt: row?.updated_at || now,
    },
  }, 201, cors);
}

// DELETE /api/highlights (body: { book, chapter, verse })
export async function removeHighlight(request, db, userId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { book, chapter, verse } = body || {};
  if (!validators.verseRef({ book, chapter, verse })) {
    return error('invalid_verse_ref', 400, cors);
  }

  const result = await db
    .prepare(
      `DELETE FROM highlights WHERE user_id = ? AND book = ? AND chapter = ? AND verse = ?`,
    )
    .bind(userId, book, chapter, verse)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return error('highlight_not_found', 404, cors);
  }
  return json({ ok: true }, 200, cors);
}

// ── SEARCHES (Phase 3.4 — historial persistente multi-device) ───

// GET /api/searches
export async function listSearches(db, userId) {
  const rows = await db
    .prepare(
      `SELECT id, search_text, search_type, testament, book_json, chapter_json, last_used_at, created_at
       FROM user_searches WHERE user_id = ? ORDER BY last_used_at DESC LIMIT 25`,
    )
    .bind(userId)
    .all();
  return {
    searches: (rows.results || []).map((r) => ({
      id: r.id,
      searchText: r.search_text,
      searchType: r.search_type,
      testament: r.testament,
      books: r.book_json ? JSON.parse(r.book_json) : null,
      chapters: r.chapter_json ? JSON.parse(r.chapter_json) : null,
      lastUsedAt: r.last_used_at,
      createdAt: r.created_at,
    })),
  };
}

// POST /api/searches — upsert (mueve búsqueda existente a top)
export async function upsertSearch(request, db, userId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { searchText, searchType = 'match', testament = 'all', books, chapters } = body || {};

  if (typeof searchText !== 'string' || searchText.trim().length < 1 || searchText.trim().length > 200) {
    return error('invalid_search_text', 400, cors);
  }
  const validTypes = ['match', 'every', 'some', 'reference'];
  if (!validTypes.includes(searchType)) return error('invalid_search_type', 400, cors);
  const validTestaments = ['all', 'ot', 'nt'];
  if (!validTestaments.includes(testament)) return error('invalid_testament', 400, cors);

  const now = nowIso();
  const id = genId('search');
  const normalizedText = searchText.trim();

  // Upsert by user+text
  await db
    .prepare(
      `INSERT INTO user_searches (id, user_id, search_text, search_type, testament, book_json, chapter_json, last_used_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, search_text) DO UPDATE SET
         search_type = excluded.search_type,
         testament = excluded.testament,
         book_json = excluded.book_json,
         chapter_json = excluded.chapter_json,
         last_used_at = excluded.last_used_at`,
    )
    .bind(
      id, userId, normalizedText, searchType, testament,
      books ? JSON.stringify(books) : null,
      chapters ? JSON.stringify(chapters) : null,
      now, now,
    )
    .run();

  // Obtener el id real (puede ser el existente tras ON CONFLICT)
  const row = await db
    .prepare('SELECT id, last_used_at, created_at FROM user_searches WHERE user_id = ? AND search_text = ?')
    .bind(userId, normalizedText)
    .first();

  return json({
    ok: true,
    search: {
      id: row.id,
      searchText: normalizedText,
      searchType,
      testament,
      books: books || null,
      chapters: chapters || null,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
    },
  }, 201, cors);
}

// DELETE /api/searches (body: { id })
export async function removeSearch(request, db, userId, cors) {
  let body;
  try { body = await request.json(); } catch { return error('invalid_json', 400, cors); }
  const { id } = body || {};
  if (typeof id !== 'string' || !id.startsWith('search_')) {
    return error('invalid_id', 400, cors);
  }

  const result = await db
    .prepare(`DELETE FROM user_searches WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return error('search_not_found', 404, cors);
  }
  return json({ ok: true }, 200, cors);
}

// ── EXPORT (todo del usuario para sync) ──────────────────
export async function exportUserData(db, userId) {
  const topics = await listTopics(db, userId);
  const favorites = await listFavorites(db, userId);
  const notes = await listNotes(db, userId);
  const highlights = await listHighlights(db, userId);
  const searches = await listSearches(db, userId);
  return {
    ok: true,
    data: {
      topics: topics.topics,
      verseRefs: topics.verseRefs,
      favorites: favorites.favorites,
      notes: notes.notes,
      highlights: highlights.highlights,
      searches: searches.searches,
      exportedAt: nowIso(),
    },
  };
}

// ── HEALTH ──────────────────────────────────────────────
export async function health(db) {
  let dbOk = false;
  try {
    await db.prepare('SELECT 1 AS ok').first();
    dbOk = true;
  } catch {}
  return {
    ok: true,
    service: 'robible-api',
    version: '1.0.0',
    db: dbOk ? 'ok' : 'down',
    timestamp: nowIso(),
  };
}
