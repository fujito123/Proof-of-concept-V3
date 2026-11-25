// Proof Commons — Idea Proximity Engine
//
// Stage 1 (always available, zero extra bindings):
//   TF-IDF cosine similarity over unigrams + bigrams of every mission, strategy,
//   claim (including partial / stalled attempts) and help request stored in D1.
//
// Stage 2 (optional, enabled automatically when bindings exist):
//   - env.AI         → Workers AI text embeddings (@cf/baai/bge-base-en-v1.5, 768 dims)
//   - env.VECTORIZE  → Vectorize index for nearest-neighbour queries at scale
//   Embeddings are cached in the D1 table `idea_vectors` (keyed by item_id + text hash),
//   so they are computed once per text version. When VECTORIZE is not bound, semantic
//   neighbours are computed by brute-force cosine over the cached vectors in D1.
//   Any AI / Vectorize failure silently falls back to Stage 1.

export const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
const MAX_EMBED_CHARS = 1500;
const BACKFILL_BATCH = 48;
const SEMANTIC_FLOOR = 0.45; // cosine below this is treated as "unrelated" for bge-style models
const SEMANTIC_WEIGHT = 0.7;
const MIN_KEYWORD_SCORE = 0.07;
const MIN_BLENDED_SCORE = 0.18;

const STOPWORDS = new Set(
  (
    "a an the and or but if then else of to in on at by for with from into onto over under about above below " +
    "is are was were be been being am do does did done have has had having can could should would may might must will shall " +
    "this that these those it its itself we our you your they their them he she his her i me my not no nor so than too very " +
    "what which who whom whose when where why how all any both each few more most other some such only own same just also " +
    "there here up down out off again further once via per using use used within without between through during before after " +
    "e g eg ie etc vs one two new provide find determine whether exact explicit"
  ).split(/\s+/)
);

const queryEmbeddingCache = new Map();

function stem(w) {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 6 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 5 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es") && /(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) return w.slice(0, -1);
  return w;
}

export function tokenize(text) {
  const words = String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(w => w.length >= 2 && !STOPWORDS.has(w))
    .map(stem);
  const tokens = [...words];
  for (let i = 0; i + 1 < words.length; i++) tokens.push(words[i] + " " + words[i + 1]);
  return tokens;
}

function termFreq(tokens) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0") + ":" + str.length;
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function clip(s, n) {
  const str = String(s || "").replace(/\s+/g, " ").trim();
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

// ---------------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------------

export async function loadIdeaCorpus(env) {
  const { results: missions } = await env.DB.prepare(
    `SELECT id, slug, title, summary, question, criterion, domain, status FROM missions`
  ).all();
  const missionById = new Map(missions.map(m => [m.id, m]));
  const { results: strategies } = await env.DB.prepare(
    `SELECT id, mission_id, title, description, status, p_viable, model_family FROM strategies`
  ).all();
  const { results: claims } = await env.DB.prepare(
    `SELECT id, mission_id, outcome, finding, assumptions, remaining_gap, verification_status, addresses_full_mission, model_family, created_at FROM claims`
  ).all();
  const { results: helps } = await env.DB.prepare(
    `SELECT id, mission_id, kind, title, question, why_useful, disputed_step, status, target_claim_id FROM help_requests
     WHERE title NOT LIKE 'Review full-mission candidate%'`
  ).all();

  const docs = [];
  const base = (missionId) => {
    const m = missionById.get(missionId) || {};
    return { mission_id: missionId, mission_slug: m.slug || missionId, mission_title: m.title || "" };
  };
  for (const m of missions) {
    docs.push({
      ...base(m.id),
      item_id: m.id,
      item_type: "mission",
      title: m.title,
      status: m.status,
      text: `${m.title}\n${m.summary}\n${m.question}\n${m.criterion}\n${m.domain}`,
      snippet: clip(m.question, 220),
      url: `/m/${encodeURIComponent(m.slug)}`,
      api_url: `/api/missions/${encodeURIComponent(m.slug)}`,
    });
  }
  for (const s of strategies) {
    const b = base(s.mission_id);
    docs.push({
      ...b,
      item_id: s.id,
      item_type: "strategy",
      title: s.title,
      status: s.status,
      text: `${s.title}\n${s.description}`,
      snippet: clip(s.description, 220),
      url: `/m/${encodeURIComponent(b.mission_slug)}#strategy-${s.id}`,
      api_url: `/api/missions/${encodeURIComponent(b.mission_slug)}`,
    });
  }
  for (const c of claims) {
    const b = base(c.mission_id);
    docs.push({
      ...b,
      item_id: c.id,
      item_type: "claim",
      title: clip(c.finding, 90),
      status: c.verification_status,
      outcome: c.outcome,
      addresses_full_mission: c.addresses_full_mission ? 1 : 0,
      remaining_gap: clip(c.remaining_gap, 200),
      prior_attempt: ["partial", "blocked", "counterexample"].includes(c.outcome) || c.verification_status !== "verified",
      text: `${c.finding}\n${c.assumptions}\n${c.remaining_gap}`,
      snippet: clip(c.finding, 220),
      url: `/m/${encodeURIComponent(b.mission_slug)}#claim-${c.id}`,
      api_url: `/api/claims/${encodeURIComponent(c.id)}`,
    });
  }
  for (const h of helps) {
    const b = base(h.mission_id);
    docs.push({
      ...b,
      item_id: h.id,
      item_type: "help_request",
      title: h.title,
      status: h.status,
      kind: h.kind,
      text: `${h.title}\n${h.question}\n${h.why_useful}\n${h.disputed_step}`,
      snippet: clip(h.question, 220),
      url: `/m/${encodeURIComponent(b.mission_slug)}#help-${h.id}`,
      api_url: `/api/missions/${encodeURIComponent(b.mission_slug)}`,
    });
  }
  return docs;
}

function embedText(doc) {
  return `${doc.item_type}: ${doc.text}`.slice(0, MAX_EMBED_CHARS);
}

// ---------------------------------------------------------------------------
// Stage 1 — TF-IDF lexical similarity
// ---------------------------------------------------------------------------

function buildLexicalIndex(docs) {
  const df = new Map();
  const docTf = new Map();
  for (const d of docs) {
    const tf = termFreq(tokenize(d.text));
    docTf.set(d.item_id, tf);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = docs.length || 1;
  const idf = (t) => Math.log(1 + N / (1 + (df.get(t) || 0)));
  const weigh = (tf) => {
    const vec = new Map();
    let norm = 0;
    for (const [t, f] of tf) {
      const w = (1 + Math.log(f)) * idf(t) * (t.includes(" ") ? 1.5 : 1);
      vec.set(t, w);
      norm += w * w;
    }
    return { vec, norm: Math.sqrt(norm) };
  };
  const docVecs = new Map();
  for (const [id, tf] of docTf) docVecs.set(id, weigh(tf));
  return {
    query(text) {
      return weigh(termFreq(tokenize(text)));
    },
    score(q, itemId) {
      const d = docVecs.get(itemId);
      if (!d || !q.norm || !d.norm) return { score: 0, shared: [] };
      let dot = 0;
      const shared = [];
      const [small, large] = q.vec.size < d.vec.size ? [q.vec, d.vec] : [d.vec, q.vec];
      for (const [t, w] of small) {
        const o = large.get(t);
        if (o) {
          dot += w * o;
          shared.push([t, w * o]);
        }
      }
      shared.sort((a, b) => b[1] - a[1]);
      return { score: dot / (q.norm * d.norm), shared: shared.slice(0, 5).map(s => s[0]) };
    },
  };
}

// ---------------------------------------------------------------------------
// Stage 2 — semantic embeddings (Workers AI + optional Vectorize)
// ---------------------------------------------------------------------------

export function semanticAvailable(env) {
  return Boolean(env?.AI && typeof env.AI.run === "function");
}

async function embedTexts(env, texts) {
  const out = await env.AI.run(EMBEDDING_MODEL, { text: texts });
  const data = out?.data;
  if (!Array.isArray(data) || data.length !== texts.length) throw new Error("Unexpected embedding response");
  return data.map(v => Array.from(v, x => Math.round(x * 1e5) / 1e5));
}

async function storeVectors(env, rows) {
  for (const r of rows) {
    await env.DB.prepare(
      `INSERT INTO idea_vectors (item_id, item_type, mission_id, model, text_hash, dims, embedding_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(item_id) DO UPDATE SET item_type = excluded.item_type, mission_id = excluded.mission_id, model = excluded.model,
         text_hash = excluded.text_hash, dims = excluded.dims, embedding_json = excluded.embedding_json, updated_at = excluded.updated_at`
    ).bind(r.item_id, r.item_type, r.mission_id || null, EMBEDDING_MODEL, r.text_hash, r.values.length, JSON.stringify(r.values)).run();
  }
  if (env.VECTORIZE && typeof env.VECTORIZE.upsert === "function" && rows.length) {
    try {
      await env.VECTORIZE.upsert(
        rows.map(r => ({ id: r.item_id, values: r.values, metadata: { item_type: r.item_type, mission_id: r.mission_id || "" } }))
      );
    } catch (_) { /* Vectorize optional — D1 cache remains authoritative */ }
  }
}

// Embeds (up to BACKFILL_BATCH) docs whose cached vector is missing or stale.
// Returns a Map item_id -> vector for docs whose vectors were loaded (only when needed for brute-force).
async function ensureVectors(env, docs, { loadValues }) {
  const { results: cached } = await env.DB.prepare(
    loadValues
      ? `SELECT item_id, text_hash, embedding_json FROM idea_vectors WHERE model = ?`
      : `SELECT item_id, text_hash FROM idea_vectors WHERE model = ?`
  ).bind(EMBEDDING_MODEL).all();
  const cache = new Map(cached.map(r => [r.item_id, r]));
  const vectors = new Map();
  const stale = [];
  for (const d of docs) {
    const text = embedText(d);
    const hash = fnv1a(text);
    const row = cache.get(d.item_id);
    if (row && row.text_hash === hash) {
      if (loadValues && row.embedding_json) {
        try { vectors.set(d.item_id, JSON.parse(row.embedding_json)); } catch (_) {}
      }
    } else {
      stale.push({ doc: d, text, hash });
    }
  }
  const batch = stale.slice(0, BACKFILL_BATCH);
  if (batch.length) {
    const values = await embedTexts(env, batch.map(b => b.text));
    const rows = batch.map((b, i) => ({
      item_id: b.doc.item_id,
      item_type: b.doc.item_type,
      mission_id: b.doc.mission_id,
      text_hash: b.hash,
      values: values[i],
    }));
    await storeVectors(env, rows);
    for (const r of rows) vectors.set(r.item_id, r.values);
  }
  return { vectors, pending: Math.max(0, stale.length - batch.length) };
}

async function getQueryVector(env, text, queryItemId, vectors) {
  if (queryItemId && vectors.has(queryItemId)) return vectors.get(queryItemId);
  if (queryItemId) {
    const row = await env.DB.prepare(`SELECT embedding_json FROM idea_vectors WHERE item_id = ? AND model = ?`)
      .bind(queryItemId, EMBEDDING_MODEL).first();
    if (row?.embedding_json) {
      try { return JSON.parse(row.embedding_json); } catch (_) {}
    }
  }
  const key = fnv1a(text.slice(0, MAX_EMBED_CHARS));
  if (queryEmbeddingCache.has(key)) return queryEmbeddingCache.get(key);
  const [vec] = await embedTexts(env, [text.slice(0, MAX_EMBED_CHARS)]);
  if (queryEmbeddingCache.size > 200) queryEmbeddingCache.clear();
  queryEmbeddingCache.set(key, vec);
  return vec;
}

// Index or refresh one item right after it is created (no-op without env.AI).
export async function indexIdea(env, itemId) {
  if (!semanticAvailable(env) || !itemId) return { indexed: false };
  try {
    const docs = await loadIdeaCorpus(env);
    const doc = docs.find(d => d.item_id === itemId);
    if (!doc) return { indexed: false };
    await ensureVectors(env, [doc], { loadValues: false });
    return { indexed: true };
  } catch (_) {
    return { indexed: false };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find ideas related to `text` (or to an existing item via `itemId`).
 * Options: missionId (restrict), excludeMissionId, excludeIds, types[], limit.
 */
export async function findRelatedIdeas(env, opts = {}) {
  const limit = Math.max(1, Math.min(25, Number(opts.limit) || 6));
  const types = Array.isArray(opts.types) && opts.types.length ? new Set(opts.types) : null;
  const excludeIds = new Set((opts.excludeIds || []).filter(Boolean));
  const docs = await loadIdeaCorpus(env);

  let text = String(opts.text || "").trim();
  const queryItemId = opts.itemId || null;
  if (queryItemId) {
    excludeIds.add(queryItemId);
    if (!text) text = docs.find(d => d.item_id === queryItemId)?.text || "";
  }
  if (!text) return { engine: "keyword", items: [] };

  const candidates = docs.filter(d =>
    !excludeIds.has(d.item_id) &&
    (!types || types.has(d.item_type)) &&
    (!opts.missionId || d.mission_id === opts.missionId) &&
    (!opts.excludeMissionId || d.mission_id !== opts.excludeMissionId)
  );

  const lex = buildLexicalIndex(docs);
  const q = lex.query(text);

  let engine = "keyword";
  let semantic = null; // Map item_id -> cosine
  let semantic_error = null;
  let pending_embeddings = 0;
  let usedVectorize = false;
  if (semanticAvailable(env)) {
    try {
      const hasVectorize = Boolean(env.VECTORIZE && typeof env.VECTORIZE.query === "function");
      const { vectors, pending } = await ensureVectors(env, docs, { loadValues: !hasVectorize });
      pending_embeddings = pending;
      const qVec = await getQueryVector(env, text, queryItemId, vectors);
      semantic = new Map();
      if (hasVectorize) {
        try {
          const res = await env.VECTORIZE.query(qVec, { topK: Math.min(50, limit * 8), returnMetadata: "none" });
          for (const m of res?.matches || []) semantic.set(m.id, m.score);
          usedVectorize = semantic.size > 0;
        } catch (_) { /* fall through to D1 cosine */ }
        if (!usedVectorize) {
          const loaded = await ensureVectors(env, docs, { loadValues: true });
          for (const [id, v] of loaded.vectors) semantic.set(id, cosine(qVec, v));
        }
      } else {
        for (const [id, v] of vectors) semantic.set(id, cosine(qVec, v));
      }
      engine = "semantic+keyword";
    } catch (err) {
      semantic = null;
      semantic_error = String(err?.message || err).slice(0, 160);
    }
  }

  const scored = [];
  for (const d of candidates) {
    const { score: lexScore, shared } = lex.score(q, d.item_id);
    let score = lexScore;
    let match = "keyword";
    let semScore = null;
    if (semantic) {
      const raw = semantic.get(d.item_id);
      if (typeof raw === "number") {
        semScore = Math.max(0, Math.min(1, (raw - SEMANTIC_FLOOR) / (1 - SEMANTIC_FLOOR)));
        score = SEMANTIC_WEIGHT * semScore + (1 - SEMANTIC_WEIGHT) * Math.min(1, lexScore * 2);
        match = semScore >= 0.25 && lexScore >= MIN_KEYWORD_SCORE ? "semantic+keyword" : semScore >= 0.25 ? "semantic" : "keyword";
      }
    }
    const threshold = semScore === null ? MIN_KEYWORD_SCORE : MIN_BLENDED_SCORE;
    if (score < threshold) continue;
    const sharedTerms = shared.filter(t => !t.includes(" ")).slice(0, 4);
    const why = [
      semScore !== null && semScore >= 0.25 ? `Semantically similar (${Math.round(semScore * 100)}%)` : "",
      sharedTerms.length ? `Shared terms: ${sharedTerms.join(", ")}` : "",
    ].filter(Boolean).join(" · ");
    scored.push({
      item_id: d.item_id,
      item_type: d.item_type,
      mission_id: d.mission_id,
      mission_slug: d.mission_slug,
      mission_title: d.mission_title,
      same_mission: Boolean(opts.contextMissionId && d.mission_id === opts.contextMissionId),
      title: d.title,
      snippet: d.snippet,
      status: d.status,
      outcome: d.outcome,
      kind: d.kind,
      addresses_full_mission: d.addresses_full_mission,
      remaining_gap: d.remaining_gap,
      prior_attempt: d.prior_attempt || false,
      score: Math.round(score * 1000) / 1000,
      score_pct: Math.round(Math.min(1, score) * 100),
      keyword_score: Math.round(lexScore * 1000) / 1000,
      semantic_score: semScore === null ? null : Math.round(semScore * 1000) / 1000,
      match,
      shared_terms: sharedTerms,
      why: why || "Related wording",
      url: d.url,
      api_url: d.api_url,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return {
    engine,
    model: engine === "keyword" ? null : EMBEDDING_MODEL,
    vectorize: usedVectorize,
    pending_embeddings,
    ...(semantic_error ? { semantic_error } : {}),
    items: scored.slice(0, limit),
  };
}

// Same as findRelatedIdeas but never throws (for embedding in other responses).
export async function safeRelatedIdeas(env, opts) {
  try {
    return await findRelatedIdeas(env, opts);
  } catch (err) {
    return { engine: "unavailable", error: String(err?.message || err).slice(0, 160), items: [] };
  }
}
