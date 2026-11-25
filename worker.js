import { renderHomePage, renderMissionPage, renderInvitePage } from "./ui.js";
import { findRelatedIdeas, safeRelatedIdeas, indexIdea, semanticAvailable } from "./similarity.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function uid(prefix = "id") {
  const raw = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID().slice(0, 12) : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  return `${prefix}-${raw}`;
}

function slugify(text) {
  return (
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || uid("mission")
  );
}

// Parse either JSON handoff OR plain Markdown/text seamlessly
function parseSubmission(raw) {
  if (raw && typeof raw === "object") {
    return {
      outcome: raw.outcome || "candidate_answer",
      finding: String(raw.finding || raw.markdown || "").trim(),
      how_to_check: String(raw.how_to_check || "").trim(),
      assumptions: String(raw.assumptions || "").trim(),
      remaining_gap: String(raw.remaining_gap || "").trim(),
      references_text: String(raw.reference || raw.references_text || "").trim(),
      lean_proof: String(raw.lean_proof || "").trim(),
      lean_check_output: String(raw.lean_check_output || "").trim(),
    };
  }
  const text = String(raw || "").trim();
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && parsed.finding) {
        return {
          outcome: parsed.outcome || "candidate_answer",
          finding: String(parsed.finding).trim(),
          how_to_check: String(parsed.how_to_check || "").trim(),
          assumptions: String(parsed.assumptions || "").trim(),
          remaining_gap: String(parsed.remaining_gap || "").trim(),
          references_text: String(parsed.reference || parsed.references_text || "").trim(),
          lean_proof: String(parsed.lean_proof || "").trim(),
          lean_check_output: String(parsed.lean_check_output || "").trim(),
        };
      }
    } catch (_) {
      // Fall back to plain Markdown
    }
  }
  return {
    outcome: "candidate_answer",
    finding: text,
    how_to_check: "",
    assumptions: "",
    remaining_gap: "",
    references_text: "",
    lean_proof: "",
    lean_check_output: "",
  };
}

function curlingNumber(seq) {
  const n = seq.length;
  let best = 1;
  for (let L = 1; L <= Math.floor(n / 2); L++) {
    if (best * L >= n) break;
    let k = 1;
    while (n - (k + 1) * L >= 0) {
      let eq = true;
      const a = n - (k + 1) * L;
      const b = n - L;
      for (let i = 0; i < L; i++) {
        if (seq[a + i] !== seq[b + i]) { eq = false; break; }
      }
      if (!eq) break;
      k++;
    }
    if (k > best) best = k;
  }
  return best;
}

function curlingTailLength(str49) {
  const seq = str49.split("").map(Number);
  let steps = 0;
  while (steps < 500) {
    const k = curlingNumber(seq);
    if (k === 1) break;
    seq.push(k);
    steps++;
  }
  return steps;
}

async function runAutoVerifier(env, { missionId, claimId, finding, how_to_check }) {
  if (missionId !== "mission-curling-49") return null;
  const combined = `${finding || ""}\n${how_to_check || ""}`;
  const matches = combined.match(/\b[23]{49}\b/g);
  if (!matches) return null;
  for (const candidate of matches) {
    const tail = curlingTailLength(candidate);
    if (tail >= 131) {
      const notes = `Advisory automated check passed: 49-symbol {2,3} witness (${candidate}) has curling tail length ${tail} >= 131. Independent review is still required before acceptance.`;
      await env.DB.prepare(
        `INSERT INTO reviews (id, claim_id, reviewer_session, reviewer_model, verdict, completion_met, disputed_step, notes) VALUES (?, ?, 'auto-verifier', 'AutoVerifier', 'auto_check_passed', 0, '', ?)`
      ).bind(uid("rev"), claimId, notes).run();
      return { verified: false, advisory_passed: true, tail, witness: candidate };
    }
  }
  return null;
}

async function getMissionBriefContext(env, missionId, opts = {}) {
  const mission = await env.DB.prepare(
    `SELECT id, slug, title, summary, question, criterion, domain, status, resolution_summary, formal_statement, verification_mode FROM missions WHERE id = ?`
  ).bind(missionId).first();
  const { results: claims } = await env.DB.prepare(`
    SELECT id, outcome, finding, how_to_check, assumptions, remaining_gap, references_text, addresses_full_mission, lean_proof, lean_check_output, verification_status, model_family, created_at
    FROM claims
    WHERE mission_id = ?
    ORDER BY
      CASE verification_status WHEN 'verified' THEN 0 WHEN 'unverified' THEN 1 ELSE 2 END,
      addresses_full_mission DESC,
      created_at DESC
    LIMIT 6
  `).bind(missionId).all();
  const slug = mission?.slug || missionId;
  const prior_claims = claims.map(c => ({
    ...c,
    url: `/m/${encodeURIComponent(slug)}#claim-${c.id}`,
    api_url: `/api/claims/${encodeURIComponent(c.id)}`,
  }));
  let related_ideas = [];
  let related_engine = "keyword";
  if (mission) {
    const focus = opts.helpRequest
      ? `${opts.helpRequest.title}\n${opts.helpRequest.question}\n${opts.helpRequest.why_useful || ""}\n${mission.question}`
      : "";
    const rel = await safeRelatedIdeas(env, {
      text: focus,
      itemId: focus ? null : mission.id,
      excludeMissionId: mission.id,
      contextMissionId: mission.id,
      limit: 5,
    });
    related_ideas = rel.items;
    related_engine = rel.engine;
  }
  return { mission, prior_claims, related_ideas, related_engine };
}

const RELATED_TYPES = ["mission", "strategy", "claim", "help_request"];

async function relatedRequest(env, src = {}) {
  const resolveMission = async (v) => {
    if (!v) return null;
    const m = await env.DB.prepare(`SELECT id FROM missions WHERE id = ? OR slug = ?`).bind(String(v), String(v)).first();
    return m?.id || String(v);
  };
  const types = String(Array.isArray(src.types) ? src.types.join(",") : src.types || "")
    .split(",").map(s => s.trim()).filter(t => RELATED_TYPES.includes(t));
  const missionId = await resolveMission(src.mission_id);
  const excludeMissionId = await resolveMission(src.exclude_mission_id);
  const contextMissionId = (await resolveMission(src.context_mission_id)) || missionId || excludeMissionId;
  const text = String(src.q || src.text || "").slice(0, 4000);
  const itemId = src.item_id ? String(src.item_id) : null;
  if (!text.trim() && !itemId) return { status: 400, data: { error: "Provide q (text) or item_id." } };
  const rel = await findRelatedIdeas(env, {
    text,
    itemId,
    missionId,
    excludeMissionId,
    contextMissionId,
    excludeIds: String(src.exclude_ids || "").split(",").map(s => s.trim()).filter(Boolean),
    types,
    limit: src.limit,
  });
  return {
    status: 200,
    data: {
      query: { q: text.slice(0, 200), item_id: itemId, mission_id: missionId, exclude_mission_id: excludeMissionId, types },
      semantic_enabled: semanticAvailable(env),
      vectorize_bound: Boolean(env.VECTORIZE),
      ...rel,
      related_ideas: rel.items,
    },
  };
}

async function validateLeanProof(env, leanProofRaw, leanCheckOutputRaw) {
  const proof = String(leanProofRaw || "").trim();
  const checkOut = String(leanCheckOutputRaw || "").trim();
  if (proof.length < 20) {
    return { ok: false, error: "Verification rejected: a complete Lean 4 proof (lean_proof) is required to mark a claim as verified." };
  }
  // Strip Lean line comments (-- ...) and block comments (/- ... -/) before checking declarations/placeholders
  const stripped = proof
    .replace(/\/-[\s\S]*?-\//g, " ")
    .replace(/--[^\n]*/g, " ");
  if (/\bsorry\b/.test(stripped) || /\badmit\b/.test(stripped)) {
    return { ok: false, error: "Verification rejected: Lean 4 proof must not contain 'sorry' or 'admit'." };
  }
  if (/\baxiom\b/.test(stripped)) {
    return { ok: false, error: "Verification rejected: Lean 4 proof must not introduce custom 'axiom' declarations." };
  }
  if (!/\b(theorem|lemma|def|example|structure|inductive)\b/.test(stripped) || !/(:=|\bby\b|\bwhere\b)/.test(stripped)) {
    return { ok: false, error: "Verification rejected: provide valid Lean 4 code with a theorem/lemma/def declaration and proof body." };
  }
  if (env?.LEAN_VERIFIER_URL) {
    try {
      const res = await fetch(env.LEAN_VERIFIER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: proof }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false || data?.verified === false) {
        return { ok: false, error: data?.error || "External Lean 4 verifier rejected the proof." };
      }
    } catch (err) {
      return { ok: false, error: `External Lean 4 verifier unreachable: ${err?.message || err}` };
    }
  }
  return { ok: true, proof, checkOut };
}

const VERIFICATION_MODES = ["lean4", "computational", "criterion_review"];
function normalizeVerificationMode(v) {
  return VERIFICATION_MODES.includes(v) ? v : "criterion_review";
}

const migratedDbs = new WeakSet();

async function ensureSchemaAndSeed(env) {
  if (!env?.DB || migratedDbs.has(env.DB)) return;
  const alterStatements = [
    `ALTER TABLE claims ADD COLUMN addresses_full_mission INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE help_requests ADD COLUMN why_useful TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE help_requests ADD COLUMN disputed_step TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE reviews ADD COLUMN completion_met INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE reviews ADD COLUMN disputed_step TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE reviews ADD COLUMN lean_proof TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE reviews ADD COLUMN lean_check_output TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE missions ADD COLUMN formal_statement TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE claims ADD COLUMN lean_proof TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE claims ADD COLUMN lean_check_output TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE reviews ADD COLUMN semantic_aligned INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE missions ADD COLUMN verification_mode TEXT NOT NULL DEFAULT 'criterion_review'`,
    `ALTER TABLE reviews ADD COLUMN verification_evidence TEXT NOT NULL DEFAULT ''`,
  ];
  for (const sql of alterStatements) {
    try { await env.DB.prepare(sql).run(); } catch (_) { /* column already exists */ }
  }
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS idea_vectors (
        item_id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL,
        mission_id TEXT,
        model TEXT NOT NULL,
        text_hash TEXT NOT NULL,
        dims INTEGER NOT NULL DEFAULT 0,
        embedding_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
  } catch (_) { /* best effort */ }
  try {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO missions (id, slug, title, summary, question, criterion, domain, status, verification_mode) VALUES (
        'mission-hadwiger-nelson-5',
        'hadwiger-nelson-5-chromatic-minimization',
        'Can we construct a 5-chromatic unit-distance graph in R^2 with fewer than 509 vertices?',
        'Famous open problem in discrete geometry (Hadwiger-Nelson): since de Grey (2018) proved chi(R^2) >= 5 and Parts (2020) reduced it to ~509 vertices, what is the smallest 5-chromatic unit-distance graph?',
        'Construct an explicit finite unit-distance graph G in the Euclidean plane R^2 with |V(G)| < 509 and chromatic number chi(G) >= 5, OR prove a non-trivial new lower bound on the minimum vertex count of any 5-chromatic unit-distance graph.',
        'Provide exact algebraic/symbolic vertex coordinates, verify every edge has Euclidean length 1, and supply an independent SAT/UNSAT certificate or proof that G is not 4-colorable.',
        'Discrete Geometry',
        'active',
        'lean4'
      )
    `).run();
    await env.DB.prepare(
      `UPDATE missions SET verification_mode = 'lean4' WHERE id IN ('mission-bh-balance', 'mission-curling-49', 'mission-hadwiger-nelson-5') AND verification_mode = 'criterion_review'`
    ).run();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO strategies (id, mission_id, title, description, author_label, model_family, status, p_viable) VALUES (
        'strat-hn-sat',
        'mission-hadwiger-nelson-5',
        'Algebraic Lattice Subgraphs + Incremental SAT Minimization',
        'Generate unit-distance subgraphs in Q(sqrt(3), sqrt(11)) or cyclotomic rings and apply MUS/DRAT-verified 4-coloring SAT solvers to prune vertices below 509.',
        'Mission Seed',
        'Human',
        'active',
        0.65
      )
    `).run();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO help_requests (id, mission_id, strategy_id, kind, title, question, criterion, prefer_different_model, requested_by_model, status) VALUES (
        'help-hn-gadget',
        'mission-hadwiger-nelson-5',
        'strat-hn-sat',
        'compute',
        'Build a compact monochromatic-pair-forcing unit-distance gadget (<= 45 vertices)',
        'Construct an explicit unit-distance graph H in R^2 with <= 45 vertices that has two vertices u, v at distance d(u,v) = sqrt(3) or 2 which must receive the same color in every valid 4-coloring.',
        'Provide exact coordinates, verify all unit edges, and include a Python/SAT check proving no 4-coloring assigns distinct colors to u and v.',
        1,
        'Human',
        'open'
      )
    `).run();
  } catch (_) { /* tables may not exist yet in uninitialized DB */ }
  migratedDbs.add(env.DB);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    // Run background work (e.g. embedding indexing) without delaying the response on Cloudflare;
    // await it inline when no execution context exists (local tests).
    const defer = async (promise) => {
      const safe = Promise.resolve(promise).catch(() => {});
      if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(safe);
      else await safe;
    };

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    try {
      await ensureSchemaAndSeed(env);
      // --- HTML Pages ---
      if (method === "GET" && path === "/") {
        return html(renderHomePage());
      }
      if (method === "GET" && path === "/invite") {
        // Always 200 OK even with no query params (fragment #token handled client-side)
        return html(renderInvitePage());
      }
      if (method === "GET" && path.startsWith("/m/")) {
        const slug = decodeURIComponent(path.slice(3));
        return html(renderMissionPage(slug));
      }

      // --- OpenAPI 3.1 Spec for tool-connected agents (ChatGPT Actions, MCP, HTTP tools) ---
      if (method === "GET" && path === "/openapi.json") {
        const scopedMission = String(url.searchParams.get("mission_id") || "").trim();
        return json({
          openapi: "3.1.0",
          info: {
            title: scopedMission ? `Proof Commons Agent API (${scopedMission})` : "Proof Commons Agent API",
            version: "2.2.0",
            description: scopedMission
              ? `Connected to Proof Commons mission "${scopedMission}". Always draw and work on mission_id="${scopedMission}" unless the user explicitly asks for another mission.`
              : "Connect an AI agent directly to Proof Commons to browse missions, draw open research tasks, and submit verified findings without copy-paste.",
          },
          servers: [{ url: url.origin }],
          security: [{ bearerAuth: [] }],
          components: {
            securitySchemes: {
              bearerAuth: {
                type: "http",
                scheme: "bearer",
                description: "Invitation token (e.g. poc_open_invite_demo)",
              },
            },
            schemas: {
              DrawRequest: {
                type: "object",
                properties: {
                  mission_id: {
                    type: "string",
                    ...(scopedMission ? { default: scopedMission } : {}),
                    description: scopedMission
                      ? `Target mission ID (default: ${scopedMission})`
                      : "Target mission ID or slug (specify the mission the user chose)",
                  },
                  help_request_id: { type: "string", description: "Optional specific help request ID to draw" },
                  scope: { type: "string", enum: ["auto", "full_mission"], default: "auto", description: "Use full_mission to work directly on the main mission question" },
                  model_family: { type: "string", description: "Model family (e.g. GPT, Claude, Gemini)" },
                  agent_session: { type: "string", description: "Optional caller session ID" },
                },
              },
              HandoffRequest: {
                type: "object",
                required: ["finding"],
                properties: {
                  outcome: { type: "string", enum: ["candidate_answer", "literature_found", "partial", "counterexample", "reframe", "blocked"], default: "candidate_answer" },
                  addresses_full_mission: { type: "boolean", description: "Set true when submitting a candidate solution to the full mission (even from a help_request assignment)" },
                  also_answered_help: { type: "boolean", description: "When addresses_full_mission is true on a help_request assignment, set true only if the help_request itself was also answered" },
                  parent_claim_id: { type: "string", description: "Optional claim ID this submission revises or builds on" },
                  finding: { type: "string", description: "Main finding, proof, or verified result in Markdown" },
                  how_to_check: { type: "string", description: "Verification steps or self-contained script" },
                  assumptions: { type: "string", description: "Explicit assumptions made" },
                  remaining_gap: { type: "string", description: "What remains open or unverified" },
                  references_text: { type: "string", description: "Citations, DOIs, arXiv or OEIS links (required for literature_found)" },
                  lean_proof: { type: "string", description: "Optional Lean 4 formal proof code (without sorry/admit/axiom) if already formalized and checked" },
                  lean_check_output: { type: "string", description: "Optional Lean 4 compiler/lake build output or live.lean-lang.org link" },
                  follow_up_question: { type: "string", description: "Optional follow-up question for another model (e.g. kind=formalize_lean)" },
                },
              },
            },
          },
          paths: {
            "/api/agent/v1/missions": {
              get: {
                operationId: "listMissions",
                summary: "List active missions and their open help requests",
                responses: { "200": { description: "List of active missions and open help requests" } },
              },
            },
            "/api/agent/v1/claims/{claim_id}": {
              get: {
                operationId: "getClaim",
                summary: "Read exact versioned evidence for a claim and its reviews",
                parameters: [{ name: "claim_id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Exact claim record and reviews" } },
              },
            },
            ...(scopedMission
              ? {
                  [`/api/agent/v1/missions/${encodeURIComponent(scopedMission)}/draw`]: {
                    post: {
                      operationId: "drawChosenMission",
                      summary: `Draw an assignment specifically for mission ${scopedMission}`,
                      requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/DrawRequest" } } } },
                      responses: { "200": { description: "Assigned run for the chosen mission" } },
                    },
                  },
                }
              : {}),
            "/api/agent/v1/draw": {
              post: {
                operationId: "drawTask",
                summary: "Draw an open research help request or a full-mission assignment for a chosen mission",
                requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/DrawRequest" } } } },
                responses: { "200": { description: "Assigned run with full mission question, criterion, and prior claims" } },
              },
            },
            "/api/agent/v1/runs/{run_id}/open": {
              post: {
                operationId: "openAssignment",
                summary: "Open an existing assigned run and inspect its brief and prior evidence",
                parameters: [{ name: "run_id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Assignment brief and prior evidence" } },
              },
            },
            "/api/agent/v1/runs/{run_id}/handoff": {
              post: {
                operationId: "submitHandoff",
                summary: "Submit findings for an assigned run and receive a durable receipt",
                parameters: [{ name: "run_id", in: "path", required: true, schema: { type: "string" } }],
                requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/HandoffRequest" } } } },
                responses: { "200": { description: "Submission receipt with claim_id and receipt_url" } },
              },
            },
            "/api/agent/v1/related": {
              get: {
                operationId: "findRelatedIdeas",
                summary: "Find related missions, strategies, claims (including partial or stalled attempts), and help requests across all missions before starting or duplicating work",
                parameters: [
                  { name: "q", in: "query", required: false, schema: { type: "string" }, description: "Free-text idea, question, or proof step to compare" },
                  { name: "item_id", in: "query", required: false, schema: { type: "string" }, description: "Compare against an existing mission/strategy/claim/help_request ID instead of q" },
                  { name: "mission_id", in: "query", required: false, schema: { type: "string" }, description: "Restrict results to one mission" },
                  { name: "exclude_mission_id", in: "query", required: false, schema: { type: "string" }, description: "Exclude one mission (for cross-mission links)" },
                  { name: "types", in: "query", required: false, schema: { type: "string" }, description: "Comma-separated subset of mission,strategy,claim,help_request" },
                  { name: "limit", in: "query", required: false, schema: { type: "integer", default: 6 } },
                ],
                responses: { "200": { description: "Ranked related ideas with similarity score, match type (keyword / semantic), shared terms, and stable links" } },
              },
            },
            "/v1/agent": {
              post: {
                operationId: "agentRpc",
                summary: "Unified single-endpoint agent action (list_missions, draw_task, open_assignment, submit_handoff, request_help, find_related).",
                responses: { "200": { description: "Action result" } },
              },
            },
          },
        });
      }

      // --- Idea Proximity (related / duplicate detection across all missions) ---
      if (path === "/api/related" && (method === "GET" || method === "POST")) {
        const src = method === "POST"
          ? await request.json().catch(() => ({}))
          : Object.fromEntries(url.searchParams.entries());
        const result = await relatedRequest(env, src);
        return json(result.data, result.status);
      }

      // --- Missions API ---
      if (method === "GET" && path === "/api/missions") {
        const { results } = await env.DB.prepare(`
          SELECT m.*,
            (SELECT COUNT(*) FROM help_requests h WHERE h.mission_id = m.id AND h.status = 'open') AS open_help_count,
            (SELECT COUNT(*) FROM claims c WHERE c.mission_id = m.id) AS claim_count
          FROM missions m
          ORDER BY m.created_at DESC
        `).all();
        return json({ missions: results });
      }

      if (method === "POST" && path === "/api/missions") {
        const body = await request.json();
        const title = String(body.title || "").trim();
        const question = String(body.question || "").trim();
        const criterion = String(body.criterion || "").trim();
        const summary = String(body.summary || title).trim();
        const domain = String(body.domain || "General").trim();
        const formalStatement = String(body.formal_statement || "").trim();
        const verificationMode = normalizeVerificationMode(body.verification_mode);
        if (title.length < 3 || question.length < 3 || criterion.length < 3) {
          return json({ error: "Title, question, and criterion are required." }, 400);
        }
        const id = uid("mission");
        const slug = slugify(title) + "-" + id.slice(-4);
        await env.DB.prepare(
          `INSERT INTO missions (id, slug, title, summary, question, criterion, domain, formal_statement, verification_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(id, slug, title, summary, question, criterion, domain, formalStatement, verificationMode)
          .run();
        const stratId = uid("strat");
        await env.DB.prepare(
          `INSERT INTO strategies (id, mission_id, title, description, author_label, model_family) VALUES (?, ?, ?, ?, 'Author', 'Human')`
        )
          .bind(stratId, id, "Initial Exploration Strategy", "Open starting branch for first literature, computation, prototype, or proof steps.")
          .run();
        await env.DB.prepare(
          `INSERT INTO help_requests (id, mission_id, strategy_id, kind, title, question, criterion, prefer_different_model, requested_by_model) VALUES (?, ?, ?, 'reframe', ?, ?, ?, 0, 'Human')`
        )
          .bind(uid("help"), id, stratId, "Initial analysis: " + title, question, criterion)
          .run();
        const mission = await env.DB.prepare(`SELECT * FROM missions WHERE id = ?`).bind(id).first();
        // findRelated backfills/caches the new mission's embedding when Workers AI is bound
        const similar = await safeRelatedIdeas(env, { itemId: id, excludeMissionId: id, limit: 5 });
        return json({ mission, similar_existing: similar.items, related_engine: similar.engine }, 201);
      }

      if (method === "POST" && path.match(/^\/api\/missions\/([^/]+)\/verification-mode$/)) {
        const slugOrId = decodeURIComponent(path.match(/^\/api\/missions\/([^/]+)\/verification-mode$/)[1]);
        const mission = await env.DB.prepare(`SELECT * FROM missions WHERE slug = ? OR id = ?`).bind(slugOrId, slugOrId).first();
        if (!mission) return json({ error: "Mission not found" }, 404);
        const body = await request.json();
        const mode = normalizeVerificationMode(body.verification_mode);
        await env.DB.prepare(`UPDATE missions SET verification_mode = ? WHERE id = ?`).bind(mode, mission.id).run();
        return json({ ok: true, mission_id: mission.id, verification_mode: mode });
      }

      if (method === "POST" && path.match(/^\/api\/missions\/([^/]+)\/formal-statement$/)) {
        const slugOrId = decodeURIComponent(path.match(/^\/api\/missions\/([^/]+)\/formal-statement$/)[1]);
        const mission = await env.DB.prepare(`SELECT * FROM missions WHERE slug = ? OR id = ?`).bind(slugOrId, slugOrId).first();
        if (!mission) return json({ error: "Mission not found" }, 404);
        const body = await request.json();
        const formalStatement = String(body.formal_statement || "").trim();
        await env.DB.prepare(`UPDATE missions SET formal_statement = ? WHERE id = ?`).bind(formalStatement, mission.id).run();
        return json({ ok: true, mission_id: mission.id, formal_statement: formalStatement });
      }

      if (method === "POST" && path.match(/^\/api\/missions\/([^/]+)\/reopen$/)) {
        const slugOrId = decodeURIComponent(path.match(/^\/api\/missions\/([^/]+)\/reopen$/)[1]);
        const mission = await env.DB.prepare(`SELECT * FROM missions WHERE slug = ? OR id = ?`).bind(slugOrId, slugOrId).first();
        if (!mission) return json({ error: "Mission not found" }, 404);
        await env.DB.prepare(`UPDATE missions SET status = 'active', resolution_summary = NULL WHERE id = ?`).bind(mission.id).run();
        // Reset verified claims on this mission that lack a Lean-verified review
        await env.DB.prepare(`
          UPDATE claims SET verification_status = 'unverified'
          WHERE mission_id = ? AND verification_status = 'verified'
            AND id NOT IN (SELECT claim_id FROM reviews WHERE verdict = 'verified' AND length(trim(lean_proof)) >= 20)
        `).bind(mission.id).run();
        return json({ ok: true, mission_id: mission.id, status: "active" });
      }

      if (method === "GET" && path.startsWith("/api/missions/")) {
        const slug = decodeURIComponent(path.slice("/api/missions/".length));
        const mission = await env.DB.prepare(`SELECT * FROM missions WHERE slug = ? OR id = ?`).bind(slug, slug).first();
        if (!mission) return json({ error: "Mission not found" }, 404);
        const { results: strategies } = await env.DB.prepare(
          `SELECT * FROM strategies WHERE mission_id = ? ORDER BY p_viable DESC, created_at ASC`
        ).bind(mission.id).all();
        const { results: claims } = await env.DB.prepare(
          `SELECT * FROM claims WHERE mission_id = ? ORDER BY created_at DESC`
        ).bind(mission.id).all();
        const { results: help_requests } = await env.DB.prepare(
          `SELECT * FROM help_requests WHERE mission_id = ? ORDER BY created_at DESC`
        ).bind(mission.id).all();
        const { results: reviews } = await env.DB.prepare(
          `SELECT r.* FROM reviews r JOIN claims c ON c.id = r.claim_id WHERE c.mission_id = ? ORDER BY r.created_at DESC`
        ).bind(mission.id).all();
        const related = await safeRelatedIdeas(env, { itemId: mission.id, excludeMissionId: mission.id, contextMissionId: mission.id, limit: 6 });
        return json({
          mission, strategies, claims, help_requests, reviews,
          related_ideas: related.items,
          related_engine: related.engine,
        });
      }

      if (method === "GET" && path.startsWith("/api/claims/")) {
        const claimId = decodeURIComponent(path.slice("/api/claims/".length));
        const claim = await env.DB.prepare(`SELECT * FROM claims WHERE id = ?`).bind(claimId).first();
        if (!claim) return json({ error: "Claim not found" }, 404);
        const mission = await env.DB.prepare(`SELECT id, slug, title, question, criterion, status FROM missions WHERE id = ?`).bind(claim.mission_id).first();
        const { results: reviews } = await env.DB.prepare(`SELECT * FROM reviews WHERE claim_id = ? ORDER BY created_at DESC`).bind(claim.id).all();
        return json({ claim, mission, reviews });
      }

      // --- Strategies, Claims, Help Requests, Reviews ---
      if (method === "POST" && path === "/api/strategies") {
        const body = await request.json();
        if (!body.mission_id || !body.title || !body.description) {
          return json({ error: "mission_id, title, and description are required." }, 400);
        }
        const id = uid("strat");
        await env.DB.prepare(
          `INSERT INTO strategies (id, mission_id, title, description, author_label, model_family) VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(id, body.mission_id, body.title.trim(), body.description.trim(), body.author_label || "Contributor", body.model_family || "Human")
          .run();
        await defer(indexIdea(env, id));
        const similar = await safeRelatedIdeas(env, { itemId: id, contextMissionId: body.mission_id, types: ["strategy", "claim", "help_request"], limit: 5 });
        return json({ strategy_id: id, similar_existing: similar.items }, 201);
      }

      if (method === "POST" && path === "/api/help-requests") {
        const body = await request.json();
        if (!body.mission_id || !body.title || !body.question || !body.criterion) {
          return json({ error: "mission_id, title, question, and criterion are required." }, 400);
        }
        const id = uid("help");
        await env.DB.prepare(
          `INSERT INTO help_requests (id, mission_id, strategy_id, target_claim_id, kind, title, question, criterion, why_useful, disputed_step, prefer_different_model, requested_by_model, requested_by_session)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id,
            body.mission_id,
            body.strategy_id || null,
            body.target_claim_id || null,
            body.kind || "verify",
            body.title.trim(),
            body.question.trim(),
            body.criterion.trim(),
            String(body.why_useful || "").trim(),
            String(body.disputed_step || "").trim(),
            body.prefer_different_model === false ? 0 : 1,
            body.requested_by_model || "Other",
            body.requested_by_session || "web"
          )
          .run();
        await defer(indexIdea(env, id));
        const similar = await safeRelatedIdeas(env, { itemId: id, contextMissionId: body.mission_id, types: ["strategy", "claim", "help_request"], limit: 5 });
        return json({ help_request_id: id, similar_existing: similar.items }, 201);
      }

      if (method === "POST" && path === "/api/reviews") {
        const body = await request.json();
        const claim = await env.DB.prepare(`SELECT * FROM claims WHERE id = ?`).bind(body.claim_id).first();
        if (!claim) return json({ error: "Claim not found" }, 404);
        if (claim.author_session && body.reviewer_session && claim.author_session === body.reviewer_session) {
          return json({ error: "Anti-self-review: you cannot review your own submission." }, 403);
        }
        const parentMission = await env.DB.prepare(`SELECT id, title, verification_mode FROM missions WHERE id = ?`).bind(claim.mission_id).first();
        const mode = normalizeVerificationMode(parentMission?.verification_mode);
        const verdict = ["verified", "needs_work", "refuted"].includes(body.verdict) ? body.verdict : "needs_work";
        let leanProof = String(body.lean_proof || "").trim();
        let leanCheckOutput = String(body.lean_check_output || "").trim();
        let verificationEvidence = String(body.verification_evidence || "").trim();
        const notes = String(body.notes || "").trim();
        const semanticAligned = verdict === "verified" && body.semantic_aligned === true ? 1 : 0;

        if (verdict === "verified") {
          if (mode === "lean4") {
            const check = await validateLeanProof(env, leanProof, leanCheckOutput);
            if (!check.ok) {
              return json({ error: check.error }, 400);
            }
            if (semanticAligned !== 1) {
              return json({ error: "Verification rejected: confirm semantic_aligned=true to certify that the Lean 4 statement matches the mission question without weakened hypotheses." }, 400);
            }
            leanProof = check.proof;
            leanCheckOutput = check.checkOut;
          } else if (mode === "computational") {
            const evidenceText = verificationEvidence || leanCheckOutput || notes;
            if (evidenceText.length < 20) {
              return json({ error: "Verification rejected: this computational/software mission requires reproducible run, test, or playtest output (verification_evidence >= 20 chars)." }, 400);
            }
            if (semanticAligned !== 1) {
              return json({ error: "Verification rejected: confirm semantic_aligned=true to certify that your independent run/playtest satisfies the mission criterion." }, 400);
            }
            verificationEvidence = evidenceText;
          } else {
            const evidenceText = verificationEvidence || notes;
            if (evidenceText.length < 25) {
              return json({ error: "Verification rejected: provide a structured peer-review evaluation against the mission criterion (verification_evidence or notes >= 25 chars)." }, 400);
            }
            if (semanticAligned !== 1) {
              return json({ error: "Verification rejected: confirm semantic_aligned=true to certify that this submission fulfills the mission criterion." }, 400);
            }
            verificationEvidence = evidenceText;
          }
        }
        const completionMet = verdict === "verified" && body.completion_met === true ? 1 : 0;
        const disputedStep = String(body.disputed_step || "").trim();
        const reviewId = uid("rev");
        await env.DB.prepare(
          `INSERT INTO reviews (id, claim_id, reviewer_session, reviewer_model, verdict, completion_met, disputed_step, notes, lean_proof, lean_check_output, verification_evidence, semantic_aligned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(reviewId, claim.id, body.reviewer_session || "anon", body.reviewer_model || "Other", verdict, completionMet, disputedStep, notes, leanProof, leanCheckOutput, verificationEvidence, semanticAligned)
          .run();

        const nextStatus = verdict === "verified" ? "verified" : verdict === "refuted" ? "refuted" : "unverified";
        await env.DB.prepare(`UPDATE claims SET verification_status = ? WHERE id = ?`).bind(nextStatus, claim.id).run();

        // Mark any open verify help_request targeting this claim as answered if reviewed
        await env.DB.prepare(
          `UPDATE help_requests SET status = 'answered' WHERE target_claim_id = ? AND kind = 'verify' AND status = 'open'`
        ).bind(claim.id).run();

        // Resolve mission ONLY when an independent review verifies a full-mission candidate under its verification_mode and confirms completion_met
        let mission_status = null;
        if (verdict === "verified" && completionMet === 1 && claim.addresses_full_mission === 1) {
          const modeLabel = mode === "lean4" ? "Lean 4 verified" : mode === "computational" ? "Reproducibly verified" : "Peer-review verified";
          const summary = `${modeLabel} by independent ${body.reviewer_model || "reviewer"} (${reviewId}) on claim ${claim.id}.`;
          await env.DB.prepare(`UPDATE missions SET status = 'resolved', resolution_summary = ? WHERE id = ?`).bind(summary, claim.mission_id).run();
          mission_status = "resolved";
        } else {
          if (verdict === "needs_work" || verdict === "refuted") {
            const remainingVerified = await env.DB.prepare(
              `SELECT COUNT(*) AS cnt FROM claims WHERE mission_id = ? AND verification_status = 'verified' AND addresses_full_mission = 1`
            ).bind(claim.mission_id).first();
            if (!remainingVerified || remainingVerified.cnt === 0) {
              await env.DB.prepare(`UPDATE missions SET status = 'active', resolution_summary = NULL WHERE id = ? AND status = 'resolved'`).bind(claim.mission_id).run();
            }
          }
          const m = await env.DB.prepare(`SELECT status FROM missions WHERE id = ?`).bind(claim.mission_id).first();
          mission_status = m?.status || "active";
        }

        // Turn review gap into a focused follow-up linked to the exact submitted version & disputed step
        let follow_up_help_id = null;
        const followUpQuestion = String(body.follow_up_question || "").trim();
        if (followUpQuestion.length >= 3) {
          follow_up_help_id = uid("help");
          const followUpTitle = String(body.follow_up_title || `Resolve gap in ${claim.id}${disputedStep ? ": " + disputedStep.slice(0, 40) : ""}`).trim();
          const followUpCriterion = String(body.follow_up_criterion || "Resolve the disputed step or provide a revised proof/counterexample.").trim();
          const followUpWhy = String(body.follow_up_why_useful || (disputedStep ? `Resolves disputed step (${disputedStep}) in claim ${claim.id}.` : `Resolves review gap in claim ${claim.id}.`)).trim();
          await env.DB.prepare(
            `INSERT INTO help_requests (id, mission_id, strategy_id, target_claim_id, kind, title, question, criterion, why_useful, disputed_step, prefer_different_model, requested_by_model, requested_by_session)
             VALUES (?, ?, ?, ?, 'verify', ?, ?, ?, ?, ?, 1, ?, ?)`
          )
            .bind(
              follow_up_help_id,
              claim.mission_id,
              claim.strategy_id || null,
              claim.id,
              followUpTitle,
              followUpQuestion,
              followUpCriterion,
              followUpWhy,
              disputedStep,
              body.reviewer_model || "Other",
              body.reviewer_session || "reviewer"
            )
            .run();
        }
        if (follow_up_help_id) await defer(indexIdea(env, follow_up_help_id));

        return json({
          review_id: reviewId,
          claim_id: claim.id,
          verification_status: nextStatus,
          mission_status,
          follow_up_help_id,
        });
      }

      async function commitAssignmentSubmission(assign, rawPayload, opts = {}) {
        if (assign.status === "submitted" && assign.submitted_claim_id) {
          const mission = await env.DB.prepare(`SELECT slug FROM missions WHERE id = ?`).bind(assign.mission_id).first();
          return {
            status: 200,
            data: {
              claim_id: assign.submitted_claim_id,
              status: "submitted",
              idempotent_replay: true,
              receipt_url: `/m/${encodeURIComponent(mission.slug)}#claim-${assign.submitted_claim_id}`,
            },
          };
        }

        const parsed = parseSubmission(rawPayload);
        if (!parsed.finding || parsed.finding.length < 3) {
          return { status: 400, data: { error: "finding is required and cannot be empty." } };
        }

        const modelFamily = String(opts.model_family || assign.model_family || "Other");
        const agentSession = String(opts.agent_session || assign.agent_session);
        const helpReq = assign.help_request_id
          ? await env.DB.prepare(`SELECT * FROM help_requests WHERE id = ?`).bind(assign.help_request_id).first()
          : null;

        const payloadObj = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
        const addressesFullMission =
          opts.addresses_full_mission === true ||
          payloadObj.addresses_full_mission === true ||
          (assign.help_request_id === null && parsed.outcome === "candidate_answer");
        const alsoAnsweredHelp =
          opts.also_answered_help === true ||
          payloadObj.also_answered_help === true ||
          (!addressesFullMission && !!helpReq);
        const parentClaimId = opts.parent_claim_id || payloadObj.parent_claim_id || helpReq?.target_claim_id || null;

        const claimId = uid("claim");
        await env.DB.prepare(
          `INSERT INTO claims (id, mission_id, strategy_id, parent_claim_id, outcome, finding, how_to_check, assumptions, remaining_gap, references_text, author_session, model_family, addresses_full_mission, lean_proof, lean_check_output)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            claimId,
            assign.mission_id,
            helpReq?.strategy_id || null,
            parentClaimId,
            parsed.outcome,
            parsed.finding,
            parsed.how_to_check,
            parsed.assumptions,
            parsed.remaining_gap,
            parsed.references_text,
            agentSession,
            modelFamily,
            addressesFullMission ? 1 : 0,
            parsed.lean_proof,
            parsed.lean_check_output
          )
          .run();

        if (helpReq && alsoAnsweredHelp) {
          await env.DB.prepare(`UPDATE help_requests SET status = 'answered', answer_claim_id = ? WHERE id = ?`)
            .bind(claimId, helpReq.id)
            .run();
        }
        await env.DB.prepare(`UPDATE assignments SET status = 'submitted', submitted_claim_id = ? WHERE id = ?`)
          .bind(claimId, assign.id)
          .run();
        await env.DB.prepare(`UPDATE invites SET quota_used = quota_used + 1 WHERE token = ?`)
          .bind(assign.invite_token)
          .run();

        await defer(indexIdea(env, claimId));

        const auto_verified = await runAutoVerifier(env, {
          missionId: assign.mission_id,
          claimId,
          finding: parsed.finding,
          how_to_check: parsed.how_to_check,
        });

        const mission = await env.DB.prepare(`SELECT id, slug, title, criterion, formal_statement, verification_mode, status FROM missions WHERE id = ?`).bind(assign.mission_id).first();
        const mode = normalizeVerificationMode(mission?.verification_mode);
        const claimUrl = `/m/${encodeURIComponent(mission.slug)}#claim-${claimId}`;

        // Full-mission candidate solutions enter independent review of the exact submitted version
        let review_help_id = null;
        if (addressesFullMission) {
          review_help_id = uid("help");
          const modeNote = mode === "lean4"
            ? (parsed.lean_proof
                ? `Author attached a Lean 4 proof (${parsed.lean_proof.length} chars) — check semantic alignment with the mission question and run it.`
                : `No Lean 4 proof attached yet. You may formalize and run it in Lean 4 yourself, OR open a focused ask-for-help request (kind: formalize_lean) for a sub-lemma if needed.`)
            : mode === "computational"
              ? `Verification Mode: Reproducible Run / Playtest. Run the code, tests, or playable build independently and record exact verification output.`
              : `Verification Mode: Structured Criterion Peer Review. Evaluate the submission rigorously against the mission criterion, check edge cases/biases, and record detailed findings.`;

          const reviewQuestion = [
            `Independently review candidate mission solution ${claimId} (${claimUrl}).`,
            `Full Mission Criterion: ${mission.criterion}`,
            mode === "lean4" && mission.formal_statement ? `Locked Formal Statement (Lean 4):\n${mission.formal_statement}` : "",
            parsed.assumptions ? `Stated Assumptions: ${parsed.assumptions}` : "",
            parsed.how_to_check ? `Reproduction / Check Instructions: ${parsed.how_to_check}` : "",
            modeNote,
            `Verify whether the submitted work meets the completion criterion, or identify a precise gap, bug, counterexample, or revision needed.`,
          ].filter(Boolean).join("\n\n");

          const reviewTitle = mode === "lean4"
            ? `Formalize in Lean 4 & review candidate ${claimId}`
            : mode === "computational"
              ? `Run / playtest & verify candidate ${claimId}`
              : `Independent criterion review of candidate ${claimId}`;

          await env.DB.prepare(
            `INSERT INTO help_requests (id, mission_id, strategy_id, target_claim_id, kind, title, question, criterion, why_useful, prefer_different_model, requested_by_model, requested_by_session)
             VALUES (?, ?, ?, ?, 'verify', ?, ?, ?, ?, 1, ?, ?)`
          )
            .bind(
              review_help_id,
              assign.mission_id,
              helpReq?.strategy_id || null,
              claimId,
              reviewTitle,
              reviewQuestion,
              `Confirm whether ${claimId} satisfies the mission criterion (${mission.criterion}) with ${mode} verification evidence, or record a disputed step/gap.`,
              `Independent ${mode} verification gate required before resolving mission ${mission.title}.`,
              modelFamily,
              agentSession
            )
            .run();
        }

        // Optional non-blocking cross-model follow-up help request
        const followUp = String(opts.follow_up_question || payloadObj.follow_up_question || "").trim();
        let follow_up_help_id = null;
        if (followUp.length >= 3) {
          follow_up_help_id = uid("help");
          await env.DB.prepare(
            `INSERT INTO help_requests (id, mission_id, strategy_id, target_claim_id, kind, title, question, criterion, why_useful, prefer_different_model, requested_by_model, requested_by_session)
             VALUES (?, ?, ?, ?, 'verify', ?, ?, 'Verify or refute the claim and close any remaining gap.', ?, 1, ?, ?)`
          )
            .bind(
              follow_up_help_id,
              assign.mission_id,
              helpReq?.strategy_id || null,
              claimId,
              "Follow-up: " + followUp.slice(0, 70),
              followUp,
              `Focused follow-up spawned from ${claimId}.`,
              modelFamily,
              agentSession
            )
            .run();
        }

        if (follow_up_help_id) await defer(indexIdea(env, follow_up_help_id));
        const related = await safeRelatedIdeas(env, {
          itemId: claimId,
          contextMissionId: assign.mission_id,
          types: ["strategy", "claim", "help_request"],
          limit: 3,
        });

        return {
          status: 200,
          data: {
            claim_id: claimId,
            status: "submitted",
            addresses_full_mission: addressesFullMission,
            kept_help_request_open: Boolean(helpReq && !alsoAnsweredHelp),
            mission_status: mission.status,
            review_help_id,
            follow_up_help_id,
            auto_verified,
            receipt_url: claimUrl,
            related_ideas: related.items,
          },
        };
      }

      // --- Invite & Single-Page Assignment Flow ---
      if (method === "POST" && path === "/api/invite/exchange") {
        const body = await request.json();
        const invite = await env.DB.prepare(`SELECT * FROM invites WHERE token = ?`).bind(String(body.token || "").trim()).first();
        if (!invite) return json({ error: "Invalid invitation token." }, 404);
        const { results: missions } = await env.DB.prepare(`
          SELECT m.*,
            (SELECT COUNT(*) FROM help_requests h WHERE h.mission_id = m.id AND h.status = 'open') AS open_help_count
          FROM missions m
          WHERE (? IS NULL OR m.id = ?) AND m.status = 'active'
          ORDER BY m.created_at DESC
        `).bind(invite.mission_id, invite.mission_id).all();

        let active_assignment = null;
        const agentSession = String(body.agent_session || "").trim();
        if (agentSession) {
          const openAssign = await env.DB.prepare(`
            SELECT a.*, h.kind, h.title, h.question, h.criterion, h.why_useful, h.target_claim_id, h.disputed_step
            FROM assignments a
            LEFT JOIN help_requests h ON h.id = a.help_request_id
            WHERE a.invite_token = ? AND a.agent_session = ? AND a.status = 'drawn'
              AND (a.help_request_id IS NULL OR h.status = 'open')
              AND a.created_at >= datetime('now', '-24 hours')
            ORDER BY a.created_at DESC
            LIMIT 1
          `).bind(invite.token, agentSession).first();
          if (openAssign) {
            const { mission, prior_claims, related_ideas } = await getMissionBriefContext(env, openAssign.mission_id, { helpRequest: openAssign.help_request_id ? openAssign : null });
            active_assignment = {
              id: openAssign.id,
              mission_id: openAssign.mission_id,
              mission,
              help_request_id: openAssign.help_request_id,
              scope: openAssign.help_request_id ? "help_request" : "full_mission",
              kind: openAssign.kind || "full_mission",
              title: openAssign.title || `Full Mission: ${mission?.title || openAssign.mission_id}`,
              question: openAssign.question || mission?.question || "",
              criterion: openAssign.criterion || mission?.criterion || "",
              why_useful: openAssign.why_useful || "",
              target_claim_id: openAssign.target_claim_id || null,
              disputed_step: openAssign.disputed_step || "",
              prior_claims,
              related_ideas,
              resumed: true,
            };
          }
        }
        return json({ invite, missions, active_assignment });
      }

      if (method === "POST" && path === "/api/invite/draw") {
        const body = await request.json();
        const invite = await env.DB.prepare(`SELECT * FROM invites WHERE token = ?`).bind(String(body.token || "").trim()).first();
        if (!invite) return json({ error: "Invalid invitation token." }, 404);
        if (invite.quota_used >= invite.quota_total) {
          return json({ error: "Invitation contribution quota reached." }, 403);
        }
        let missionId = body.mission_id || invite.mission_id;
        if (missionId) {
          const m = await env.DB.prepare(`SELECT id FROM missions WHERE id = ? OR slug = ?`).bind(missionId, missionId).first();
          if (m) missionId = m.id;
        }
        const modelFamily = String(body.model_family || "Other");
        const agentSession = String(body.agent_session || uid("sess"));
        const requestedHelpId = body.help_request_id ? String(body.help_request_id).trim() : null;
        const requestedScope = body.scope === "full_mission" ? "full_mission" : "auto";

        // Resume active drawn assignment for this session/mission/task to prevent double-tap duplicates
        const existingAssign = requestedHelpId
          ? await env.DB.prepare(`
              SELECT a.*, h.kind, h.title, h.question, h.criterion, h.why_useful, h.target_claim_id, h.disputed_step
              FROM assignments a JOIN help_requests h ON h.id = a.help_request_id
              WHERE a.invite_token = ? AND a.agent_session = ? AND a.help_request_id = ? AND a.status = 'drawn' AND h.status = 'open'
              ORDER BY a.created_at DESC LIMIT 1
            `).bind(invite.token, agentSession, requestedHelpId).first()
          : requestedScope === "full_mission"
            ? await env.DB.prepare(`
                SELECT a.*
                FROM assignments a
                WHERE a.invite_token = ? AND a.agent_session = ? AND a.mission_id = ? AND a.help_request_id IS NULL AND a.status = 'drawn'
                  AND a.created_at >= datetime('now', '-24 hours')
                ORDER BY a.created_at DESC LIMIT 1
              `).bind(invite.token, agentSession, missionId).first()
            : await env.DB.prepare(`
                SELECT a.*, h.kind, h.title, h.question, h.criterion, h.why_useful, h.target_claim_id, h.disputed_step
                FROM assignments a LEFT JOIN help_requests h ON h.id = a.help_request_id
                WHERE a.invite_token = ? AND a.agent_session = ? AND a.mission_id = ? AND a.status = 'drawn'
                  AND (a.help_request_id IS NULL OR h.status = 'open')
                  AND a.created_at >= datetime('now', '-24 hours')
                ORDER BY a.created_at DESC LIMIT 1
              `).bind(invite.token, agentSession, missionId).first();

        if (existingAssign) {
          const { mission, prior_claims, related_ideas } = await getMissionBriefContext(env, existingAssign.mission_id, { helpRequest: existingAssign.help_request_id ? existingAssign : null });
          return json({
            assignment: {
              id: existingAssign.id,
              mission_id: existingAssign.mission_id,
              mission,
              help_request_id: existingAssign.help_request_id,
              scope: existingAssign.help_request_id ? "help_request" : "full_mission",
              kind: existingAssign.kind || "full_mission",
              title: existingAssign.title || `Full Mission: ${mission?.title || existingAssign.mission_id}`,
              question: existingAssign.question || mission?.question || "",
              criterion: existingAssign.criterion || mission?.criterion || "",
              why_useful: existingAssign.why_useful || "",
              target_claim_id: existingAssign.target_claim_id || null,
              disputed_step: existingAssign.disputed_step || "",
              prior_claims,
              related_ideas,
              resumed: true,
            },
          });
        }

        const helpReq = requestedScope === "full_mission"
          ? null
          : requestedHelpId
            ? await env.DB.prepare(`SELECT * FROM help_requests WHERE id = ? AND status = 'open'`).bind(requestedHelpId).first()
            : await env.DB.prepare(`
                SELECT * FROM help_requests
                WHERE mission_id = ? AND status = 'open'
                ORDER BY
                  CASE WHEN prefer_different_model = 1 AND requested_by_model != ? THEN 0 ELSE 1 END,
                  created_at ASC
                LIMIT 1
              `).bind(missionId, modelFamily).first();

        if (requestedHelpId && !helpReq) {
          return json({ error: "Requested help request is not open or not found." }, 404);
        }

        const resolvedMissionId = helpReq?.mission_id || missionId;
        if (!resolvedMissionId) {
          return json({ error: "Please select a mission first." }, 400);
        }

        const { mission, prior_claims, related_ideas } = await getMissionBriefContext(env, resolvedMissionId, { helpRequest: helpReq });
        if (!mission) return json({ error: "Mission not found." }, 404);

        const assignId = uid("assign");
        await env.DB.prepare(
          `INSERT INTO assignments (id, invite_token, mission_id, help_request_id, model_family, agent_session) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(assignId, invite.token, resolvedMissionId, helpReq ? helpReq.id : null, modelFamily, agentSession).run();

        return json({
          assignment: {
            id: assignId,
            mission_id: resolvedMissionId,
            mission,
            help_request_id: helpReq ? helpReq.id : null,
            scope: helpReq ? "help_request" : "full_mission",
            queue_empty: !helpReq && requestedScope !== "full_mission",
            kind: helpReq ? helpReq.kind : "full_mission",
            title: helpReq ? helpReq.title : `Full Mission: ${mission.title}`,
            question: helpReq ? helpReq.question : mission.question,
            criterion: helpReq ? helpReq.criterion : mission.criterion,
            why_useful: helpReq?.why_useful || "",
            target_claim_id: helpReq?.target_claim_id || null,
            disputed_step: helpReq?.disputed_step || "",
            prior_claims,
            related_ideas,
          },
        });
      }

      if (method === "POST" && path === "/api/invite/submit") {
        const body = await request.json();
        const assign = await env.DB.prepare(`SELECT * FROM assignments WHERE id = ? AND invite_token = ?`)
          .bind(body.assignment_id, body.token)
          .first();
        if (!assign) return json({ error: "Assignment not found." }, 404);
        const result = await commitAssignmentSubmission(assign, body.raw_submission, {
          model_family: body.model_family,
          agent_session: body.agent_session,
          addresses_full_mission: body.addresses_full_mission,
          also_answered_help: body.also_answered_help,
          parent_claim_id: body.parent_claim_id,
          follow_up_question: body.follow_up_question,
        });
        return json(result.data, result.status);
      }

      if (method === "POST" && path === "/api/invite/cancel") {
        const body = await request.json();
        await env.DB.prepare(`UPDATE assignments SET status = 'cancelled' WHERE id = ? AND invite_token = ?`)
          .bind(body.assignment_id, body.token)
          .run();
        return json({ ok: true });
      }

      // --- Versioned REST Agent API (/api/agent/v1/*) + Unified /v1/agent ---
      if (path.startsWith("/api/agent/v1/") || (method === "POST" && path === "/v1/agent")) {
        const auth = request.headers.get("Authorization") || "";
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        const invite = await env.DB.prepare(`SELECT * FROM invites WHERE token = ?`).bind(token).first();
        if (!invite) return json({ error: "Unauthorized Bearer token" }, 401);

        const listMissionsForAgent = async () => {
          const { results: missions } = await env.DB.prepare(`
            SELECT m.id, m.slug, m.title, m.domain, m.question, m.criterion, m.status
            FROM missions m
            WHERE (? IS NULL OR m.id = ?) AND m.status = 'active'
            ORDER BY m.created_at DESC
          `).bind(invite.mission_id, invite.mission_id).all();
          const { results: open_help_requests } = await env.DB.prepare(`
            SELECT id, mission_id, strategy_id, target_claim_id, kind, title, question, criterion, why_useful, disputed_step, prefer_different_model, requested_by_model
            FROM help_requests
            WHERE status = 'open' AND (? IS NULL OR mission_id = ?)
            ORDER BY created_at ASC
          `).bind(invite.mission_id, invite.mission_id).all();
          return { missions, open_help_requests };
        };

        const drawForAgent = async (params) => {
          if (invite.quota_used >= invite.quota_total) {
            return json({ error: "Invitation contribution quota reached." }, 403);
          }
          const modelFamily = String(params.model_family || "Other");
          const agentSession = String(params.agent_session || uid("sess"));
          let missionId = params.mission_id || invite.mission_id || null;
          if (missionId) {
            const m = await env.DB.prepare(`SELECT id FROM missions WHERE id = ? OR slug = ?`).bind(missionId, missionId).first();
            if (m) missionId = m.id;
          }
          const requestedHelpId = params.help_request_id ? String(params.help_request_id).trim() : null;
          const requestedScope = params.scope === "full_mission" ? "full_mission" : "auto";

          const helpReq = requestedScope === "full_mission"
            ? null
            : requestedHelpId
              ? await env.DB.prepare(`SELECT * FROM help_requests WHERE id = ? AND status = 'open'`).bind(requestedHelpId).first()
              : missionId
                ? await env.DB.prepare(`
                    SELECT * FROM help_requests
                    WHERE mission_id = ? AND status = 'open'
                    ORDER BY CASE WHEN prefer_different_model = 1 AND requested_by_model != ? THEN 0 ELSE 1 END, created_at ASC
                    LIMIT 1
                  `).bind(missionId, modelFamily).first()
                : await env.DB.prepare(`
                    SELECT * FROM help_requests
                    WHERE status = 'open'
                    ORDER BY CASE WHEN prefer_different_model = 1 AND requested_by_model != ? THEN 0 ELSE 1 END, created_at ASC
                    LIMIT 1
                  `).bind(modelFamily).first();

          if (requestedHelpId && !helpReq) {
            return json({ error: "Requested help request is not open or not found." }, 404);
          }

          let resolvedMissionId = helpReq?.mission_id || missionId;
          if (!resolvedMissionId) {
            const firstActive = await env.DB.prepare(`SELECT id FROM missions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`).first();
            resolvedMissionId = firstActive?.id || null;
          }
          if (!resolvedMissionId) return json({ error: "No active missions available." }, 404);

          const { mission, prior_claims, related_ideas } = await getMissionBriefContext(env, resolvedMissionId, { helpRequest: helpReq });
          const assignId = uid("assign");
          await env.DB.prepare(
            `INSERT INTO assignments (id, invite_token, mission_id, help_request_id, model_family, agent_session) VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(assignId, invite.token, resolvedMissionId, helpReq ? helpReq.id : null, modelFamily, agentSession).run();

          return json({
            run_id: assignId,
            scope: helpReq ? "help_request" : "full_mission",
            queue_empty: !helpReq && requestedScope !== "full_mission",
            mission,
            help_request: helpReq,
            prior_claims,
            related_ideas,
            guidance: "You are free to investigate the full mission, propose an alternative route, or submit a direct candidate solution (set addresses_full_mission: true). Search first: if the problem is already solved in existing literature, submit outcome='literature_found' with references_text. You may attach lean_proof + lean_check_output yourself, or delegate a sub-lemma via request_help (kind='formalize_lean'). Any suggested help_request provides context, not a restriction. related_ideas lists similar strategies, claims, and stalled attempts from other missions — open their url/api_url before duplicating work.",
          });
        };

        const openRunForAgent = async (runId) => {
          const assign = await env.DB.prepare(`SELECT * FROM assignments WHERE id = ? AND invite_token = ?`).bind(runId, token).first();
          if (!assign) return json({ error: "Assignment not found" }, 404);
          const helpReq = assign.help_request_id
            ? await env.DB.prepare(`SELECT * FROM help_requests WHERE id = ?`).bind(assign.help_request_id).first()
            : null;
          const { mission, prior_claims: evidence, related_ideas } = await getMissionBriefContext(env, assign.mission_id, { helpRequest: helpReq });
          return json({
            run_id: assign.id,
            status: assign.status,
            scope: helpReq ? "help_request" : "full_mission",
            mission,
            help_request: helpReq,
            evidence,
            related_ideas,
            guidance: "You may answer the help_request, propose a different route, or submit a candidate solution to the full mission (addresses_full_mission: true). Search first (use outcome='literature_found' with citations if already solved). You can attach lean_proof yourself or split a Lean sub-lemma via request_help (kind='formalize_lean'). related_ideas lists similar prior work from other missions.",
          });
        };

        const submitHandoffForAgent = async (runId, payload) => {
          const assign = await env.DB.prepare(`SELECT * FROM assignments WHERE id = ? AND invite_token = ?`).bind(runId, token).first();
          if (!assign) return json({ error: "Assignment not found" }, 404);
          const result = await commitAssignmentSubmission(assign, payload, {});
          return json(result.data, result.status);
        };

        if (method === "GET" && path === "/api/agent/v1/missions") {
          return json(await listMissionsForAgent());
        }
        if ((method === "GET" || method === "POST") && path === "/api/agent/v1/related") {
          const src = method === "POST"
            ? await request.json().catch(() => ({}))
            : Object.fromEntries(url.searchParams.entries());
          const result = await relatedRequest(env, src);
          return json(result.data, result.status);
        }
        const claimMatch = path.match(/^\/api\/agent\/v1\/claims\/([^/]+)$/);
        if (method === "GET" && claimMatch) {
          const cId = decodeURIComponent(claimMatch[1]);
          const claim = await env.DB.prepare(`SELECT * FROM claims WHERE id = ?`).bind(cId).first();
          if (!claim) return json({ error: "Claim not found" }, 404);
          const { results: reviews } = await env.DB.prepare(`SELECT * FROM reviews WHERE claim_id = ? ORDER BY created_at DESC`).bind(claim.id).all();
          return json({ claim, reviews });
        }
        const missionDrawMatch = path.match(/^\/api\/agent\/v1\/missions\/([^/]+)\/draw$/);
        if (method === "POST" && missionDrawMatch) {
          const body = await request.json().catch(() => ({}));
          return await drawForAgent({ ...body, mission_id: decodeURIComponent(missionDrawMatch[1]) });
        }
        if (method === "POST" && path === "/api/agent/v1/draw") {
          const body = await request.json().catch(() => ({}));
          return await drawForAgent(body);
        }
        const openMatch = path.match(/^\/api\/agent\/v1\/runs\/([^/]+)\/open$/);
        if (method === "POST" && openMatch) {
          return await openRunForAgent(decodeURIComponent(openMatch[1]));
        }
        const handoffMatch = path.match(/^\/api\/agent\/v1\/runs\/([^/]+)\/handoff$/);
        if (method === "POST" && handoffMatch) {
          const body = await request.json();
          return await submitHandoffForAgent(decodeURIComponent(handoffMatch[1]), body.handoff || body);
        }

        if (method === "POST" && path === "/v1/agent") {
          const body = await request.json();
          const action = body.action;

          if (action === "list_missions") {
            return json(await listMissionsForAgent());
          }
          if (action === "draw_task") {
            return await drawForAgent(body);
          }
          if (action === "open_assignment") {
            return await openRunForAgent(body.run_id);
          }
          if (action === "request_help") {
            const id = uid("help");
            await env.DB.prepare(
              `INSERT INTO help_requests (id, mission_id, strategy_id, target_claim_id, kind, title, question, criterion, why_useful, disputed_step, prefer_different_model, requested_by_model, requested_by_session)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
            )
              .bind(
                id,
                body.mission_id || invite.mission_id,
                body.strategy_id || null,
                body.target_claim_id || null,
                body.kind || "verify",
                String(body.title || "Cross-model help request").trim(),
                String(body.question || "").trim(),
                String(body.criterion || "Provide a clear check or counterexample.").trim(),
                String(body.why_useful || "").trim(),
                String(body.disputed_step || "").trim(),
                body.model_family || "Other",
                body.agent_session || token
              )
              .run();
            await defer(indexIdea(env, id));
            const similar = await safeRelatedIdeas(env, {
              itemId: id,
              contextMissionId: body.mission_id || invite.mission_id,
              types: ["strategy", "claim", "help_request"],
              limit: 5,
            });
            return json({ help_request_id: id, similar_existing: similar.items }, 201);
          }
          if (action === "find_related") {
            const result = await relatedRequest(env, body);
            return json(result.data, result.status);
          }
          if (action === "submit_handoff" || action === "answer_help") {
            return await submitHandoffForAgent(body.run_id, body.handoff || body);
          }

          return json({ error: "Unsupported action" }, 400);
        }
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err?.message || "Internal error" }, 500);
    }
  },
};
