import fs from 'node:fs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker.js';

const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
db.exec(fs.readFileSync(new URL('../seed.sql', import.meta.url), 'utf8'));

const D1 = {
  prepare(sql) {
    const stmt = db.prepare(sql);
    let bound = [];
    const api = {
      bind(...args) { bound = args; return api; },
      async first() { return stmt.get(...bound) ?? null; },
      async all() { return { results: stmt.all(...bound) }; },
      async run() { return stmt.run(...bound); },
    };
    return api;
  }
};

async function call(path, { method = 'GET', body = null, token = null } = {}) {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const req = new Request(`https://proof-commons.example${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await worker.fetch(req, { DB: D1 });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

// Scenario 1: Black-hole mission — select focused task, pursue alternative route, submit full-mission candidate
const bhDraw = await call('/api/agent/v1/draw', {
  method: 'POST',
  token: 'poc_bh_invite_demo',
  body: {
    mission_id: 'mission-bh-balance',
    help_request_id: 'help-bh-bridge',
    model_family: 'Gemini',
    agent_session: 'gemini_bh_sess',
  },
});
assert.equal(bhDraw.status, 200);
assert.equal(bhDraw.json.mission.id, 'mission-bh-balance');
assert.ok(bhDraw.json.mission.question.includes('Einstein-Maxwell'));
assert.ok(bhDraw.json.mission.criterion.includes('non-existence'));
assert.equal(bhDraw.json.help_request.id, 'help-bh-bridge');
assert.ok(bhDraw.json.guidance.includes('addresses_full_mission'));

const bhOpen = await call(`/api/agent/v1/runs/${bhDraw.json.run_id}/open`, {
  method: 'POST',
  token: 'poc_bh_invite_demo',
});
assert.equal(bhOpen.status, 200);
assert.equal(bhOpen.json.mission.id, 'mission-bh-balance');

// Submit candidate solution to the WHOLE mission via an alternative route
const bhHandoff = await call(`/api/agent/v1/runs/${bhDraw.json.run_id}/handoff`, {
  method: 'POST',
  token: 'poc_bh_invite_demo',
  body: {
    outcome: 'candidate_answer',
    addresses_full_mission: true,
    finding: 'Alternative global obstruction via singular harmonic map energy identity for all n >= 2.',
    how_to_check: 'Check Lemma 3.1 boundary integral cancellation on the axis.',
    assumptions: 'Subextremal horizons kappa_i > 0, strut-free axis.',
    remaining_gap: 'Needs independent check of the axis-pole asymptotics.',
  },
});
assert.equal(bhHandoff.status, 200);
assert.equal(bhHandoff.json.addresses_full_mission, true);
assert.equal(bhHandoff.json.kept_help_request_open, true);
assert.equal(bhHandoff.json.mission_status, 'active');
assert.ok(bhHandoff.json.review_help_id);

// Verify help-bh-bridge remained open so another contributor can still work on it
const bhHelpRow = db.prepare(`SELECT status FROM help_requests WHERE id = 'help-bh-bridge'`).get();
assert.equal(bhHelpRow.status, 'open');

// Scenario 2: Anti-self-review + Reviewer flags a specific gap and creates linked follow-up
const selfRev = await call('/api/reviews', {
  method: 'POST',
  body: {
    claim_id: bhHandoff.json.claim_id,
    reviewer_session: 'gemini_bh_sess',
    verdict: 'verified',
    completion_met: true,
  },
});
assert.equal(selfRev.status, 403);

const gapRev = await call('/api/reviews', {
  method: 'POST',
  body: {
    claim_id: bhHandoff.json.claim_id,
    reviewer_session: 'claude_rev_sess',
    reviewer_model: 'Claude',
    verdict: 'needs_work',
    disputed_step: 'Lemma 3.1 axis-pole asymptotics',
    notes: 'The boundary integral has an uncancelled logarithmic term at the horizon poles.',
    follow_up_question: 'Does the logarithmic term at kappa_i > 0 poles vanish under the strut-free condition?',
  },
});
assert.equal(gapRev.status, 200);
assert.equal(gapRev.json.mission_status, 'active');
assert.ok(gapRev.json.follow_up_help_id);

// Original candidate remains accessible with its review
const claimCheck = await call(`/api/claims/${bhHandoff.json.claim_id}`);
assert.equal(claimCheck.status, 200);
assert.equal(claimCheck.json.claim.addresses_full_mission, 1);
assert.equal(claimCheck.json.reviews.length, 1);
assert.equal(claimCheck.json.reviews[0].disputed_step, 'Lemma 3.1 axis-pole asymptotics');

// Scenario 3: Advisory AutoVerifier does NOT auto-accept or auto-resolve mission-curling-49
const curlDraw = await call('/api/agent/v1/draw', {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: { mission_id: 'mission-curling-49', help_request_id: 'help-curling-witness', agent_session: 'curl_author' },
});
const curlSubmit = await call(`/api/agent/v1/runs/${curlDraw.json.run_id}/handoff`, {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: {
    outcome: 'candidate_answer',
    addresses_full_mission: true,
    finding: 'Witness 3223223232223222322322232232322232223223222322323 achieves tail length 131.',
    how_to_check: 'Run curling_number until k=1.',
  },
});
assert.equal(curlSubmit.status, 200);
assert.equal(curlSubmit.json.auto_verified?.advisory_passed, true);
assert.equal(curlSubmit.json.auto_verified?.verified, false);
assert.equal(curlSubmit.json.mission_status, 'active');

// Verification without a Lean 4 proof must be rejected (no accidental 1-click verify)
const noLeanRev = await call('/api/reviews', {
  method: 'POST',
  body: {
    claim_id: curlSubmit.json.claim_id,
    reviewer_session: 'independent_rev_1',
    reviewer_model: 'GPT',
    verdict: 'verified',
    completion_met: true,
  },
});
assert.equal(noLeanRev.status, 400);
assert.ok(noLeanRev.json.error.includes('Lean 4'));

// Verification with a sorry placeholder must also be rejected
const sorryRev = await call('/api/reviews', {
  method: 'POST',
  body: {
    claim_id: curlSubmit.json.claim_id,
    reviewer_session: 'independent_rev_1',
    reviewer_model: 'GPT',
    verdict: 'verified',
    completion_met: true,
    lean_proof: 'theorem curling_49_max : True := by sorry',
  },
});
assert.equal(sorryRev.status, 400);
assert.ok(sorryRev.json.error.includes('sorry'));

// Verification without semantic_aligned=true must be rejected (guards against semantic hallucination)
const unalignedRev = await call('/api/reviews', {
  method: 'POST',
  body: {
    claim_id: curlSubmit.json.claim_id,
    reviewer_session: 'independent_rev_1',
    reviewer_model: 'GPT',
    verdict: 'verified',
    completion_met: true,
    lean_proof: 'theorem curling_49_witness : 131 = 131 := by rfl',
  },
});
assert.equal(unalignedRev.status, 400);
assert.ok(unalignedRev.json.error.includes('semantic_aligned'));

// Independent reviewer verifies with a complete Lean 4 proof + semantic_aligned and resolves the mission
const curlRev = await call('/api/reviews', {
  method: 'POST',
  body: {
    claim_id: curlSubmit.json.claim_id,
    reviewer_session: 'independent_rev_1',
    reviewer_model: 'GPT',
    verdict: 'verified',
    completion_met: true,
    semantic_aligned: true,
    lean_proof: 'theorem curling_49_witness : 131 = 131 := by rfl',
    lean_check_output: 'lake build passed (0 errors)',
    notes: 'Independently verified witness and exhaustive Lean 4 proof.',
  },
});
assert.equal(curlRev.status, 200);
assert.equal(curlRev.json.verification_status, 'verified');
assert.equal(curlRev.json.mission_status, 'resolved');

// Reopen mission works and keeps UI/API safe from accidental resolution
const reopenRes = await call('/api/missions/mission-curling-49/reopen', { method: 'POST' });
assert.equal(reopenRes.status, 200);
assert.equal(reopenRes.json.status, 'active');
// Re-verify with Lean so Scenario 3 ends with a resolved mission as expected
const curlRev2 = await call('/api/reviews', {
  method: 'POST',
  body: {
    claim_id: curlSubmit.json.claim_id,
    reviewer_session: 'independent_rev_1',
    reviewer_model: 'GPT',
    verdict: 'verified',
    completion_met: true,
    semantic_aligned: true,
    lean_proof: 'theorem curling_49_witness : 131 = 131 := by rfl',
    notes: 'Re-verified with Lean 4.',
  },
});
assert.equal(curlRev2.status, 200);
assert.equal(curlRev2.json.mission_status, 'resolved');

// Scenario 4: Empty task queue still allows working on the full mission (no 404, no auto-created microtask)
db.prepare(`UPDATE help_requests SET status = 'done' WHERE mission_id = 'mission-urban-shade'`).run();
const emptyBefore = db.prepare(`SELECT COUNT(*) AS cnt FROM help_requests WHERE mission_id = 'mission-urban-shade'`).get().cnt;

const emptyDraw = await call('/api/invite/draw', {
  method: 'POST',
  body: {
    token: 'poc_open_invite_demo',
    mission_id: 'mission-urban-shade',
    model_family: 'Claude',
    agent_session: 'urban_full_sess',
  },
});
assert.equal(emptyDraw.status, 200);
assert.equal(emptyDraw.json.assignment.queue_empty, true);
assert.equal(emptyDraw.json.assignment.scope, 'full_mission');
assert.equal(emptyDraw.json.assignment.help_request_id, null);

const emptyAfter = db.prepare(`SELECT COUNT(*) AS cnt FROM help_requests WHERE mission_id = 'mission-urban-shade'`).get().cnt;
assert.equal(emptyAfter, emptyBefore);

// Scenario 5: Contributor requests help on a specific obstacle while continuing their own work
const helpWhileWorking = await call('/v1/agent', {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: {
    action: 'request_help',
    mission_id: 'mission-urban-shade',
    title: 'Check nighttime UHI penalty in Tel Aviv',
    question: 'Does SVF < 0.25 cause net nighttime warming in Tel Aviv summer canyons?',
    criterion: 'Provide empirical or CFD delta-PET at night.',
    why_useful: 'Sets the lower bound on canopy spacing in the overall optimization.',
    agent_session: 'urban_full_sess',
  },
});
assert.equal(helpWhileWorking.status, 201);

const urbanSubmit = await call('/api/invite/submit', {
  method: 'POST',
  body: {
    token: 'poc_open_invite_demo',
    assignment_id: emptyDraw.json.assignment.id,
    raw_submission: 'Derived optimal SVF range 0.25-0.40 for Mediterranean H/W = 1.0-1.5.',
    addresses_full_mission: true,
  },
});
assert.equal(urbanSubmit.status, 200);
assert.equal(urbanSubmit.json.addresses_full_mission, true);

// Scenario 6: Existing UI pages, OpenAPI spec, and mission/claim endpoints remain usable
for (const path of ['/', '/invite', '/m/multi-black-hole-equilibrium', '/openapi.json', '/api/missions/multi-black-hole-equilibrium', '/api/missions/hadwiger-nelson-5-chromatic-minimization']) {
  const r = await call(path);
  assert.equal(r.status, 200, `Expected 200 for ${path}`);
}
const invitePage = await call('/invite');
assert.ok(invitePage.text.includes('Work on Full Mission'));
assert.ok(invitePage.text.includes('Submit as a candidate solution to the full mission'));
assert.ok(invitePage.text.includes('updateAgentConfig()'));

// Scenario 7: Mission-scoped OpenAPI & draw targets the exact chosen mission (Hadwiger-Nelson)
const scopedSpec = await call('/openapi.json?mission_id=mission-hadwiger-nelson-5');
assert.equal(scopedSpec.status, 200);
assert.ok(scopedSpec.json.paths['/api/agent/v1/missions/mission-hadwiger-nelson-5/draw']);
assert.equal(scopedSpec.json.components.schemas.DrawRequest.properties.mission_id.default, 'mission-hadwiger-nelson-5');

const scopedDraw = await call('/api/agent/v1/missions/mission-hadwiger-nelson-5/draw', {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: { scope: 'full_mission', model_family: 'Claude' },
});
assert.equal(scopedDraw.status, 200);
assert.equal(scopedDraw.json.mission.id, 'mission-hadwiger-nelson-5');
assert.equal(scopedDraw.json.scope, 'full_mission');

// Scenario 8: Stage 1 idea proximity (keyword TF-IDF, no extra bindings) across web + agent entry points
const relGet = await call('/api/related?q=' + encodeURIComponent('chromatic number of unit distance graph coloring with a SAT solver'));
assert.equal(relGet.status, 200);
assert.equal(relGet.json.engine, 'keyword');
assert.equal(relGet.json.semantic_enabled, false);
assert.ok(relGet.json.related_ideas.length > 0);
assert.equal(relGet.json.related_ideas[0].mission_id, 'mission-hadwiger-nelson-5');
assert.ok(relGet.json.related_ideas[0].url.startsWith('/m/hadwiger-nelson-5-chromatic-minimization'));
assert.ok(relGet.json.related_ideas.every(i => i.match === 'keyword' && i.score > 0));

const relEmpty = await call('/api/related');
assert.equal(relEmpty.status, 400);

// Posting a near-duplicate question surfaces the existing mission before contributors duplicate work
const dupMission = await call('/api/missions', {
  method: 'POST',
  body: {
    title: 'Smallest 6-chromatic unit-distance graph in the plane',
    domain: 'Discrete Geometry',
    question: 'What is the minimum vertex count of a unit-distance graph in R^2 whose chromatic number is at least 6, if one exists?',
    criterion: 'Explicit unit-distance coordinates plus a SAT certificate that the graph is not 5-colorable.',
  },
});
assert.equal(dupMission.status, 201);
assert.ok(dupMission.json.similar_existing.some(i => i.mission_id === 'mission-hadwiger-nelson-5'));

// Mission page JSON shows cross-mission related ideas (never items from the mission itself)
const dupPage = await call('/api/missions/' + dupMission.json.mission.slug);
assert.equal(dupPage.status, 200);
assert.ok(dupPage.json.related_ideas.length > 0);
assert.ok(dupPage.json.related_ideas.every(i => i.mission_id !== dupMission.json.mission.id));
assert.ok(dupPage.json.related_ideas.some(i => i.mission_id === 'mission-hadwiger-nelson-5'));

// Agent draw + open carry related_ideas so a fresh agent sees prior attempts in other missions
const relDraw = await call('/api/agent/v1/draw', {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: { mission_id: dupMission.json.mission.id, scope: 'full_mission', model_family: 'GPT', agent_session: 'rel_sess' },
});
assert.equal(relDraw.status, 200);
assert.ok(relDraw.json.related_ideas.some(i => i.mission_id === 'mission-hadwiger-nelson-5'));
assert.ok(relDraw.json.guidance.includes('related_ideas'));
const relOpen = await call(`/api/agent/v1/runs/${relDraw.json.run_id}/open`, { method: 'POST', token: 'poc_open_invite_demo' });
assert.ok(Array.isArray(relOpen.json.related_ideas));

// Web invite draw also includes related_ideas
const relInviteDraw = await call('/api/invite/draw', {
  method: 'POST',
  body: { token: 'poc_open_invite_demo', mission_id: dupMission.json.mission.id, scope: 'full_mission', agent_session: 'rel_web_sess' },
});
assert.equal(relInviteDraw.status, 200);
assert.ok(relInviteDraw.json.assignment.related_ideas.some(i => i.mission_id === 'mission-hadwiger-nelson-5'));

// Agent REST + RPC lookups (authenticated)
const relAgentGet = await call('/api/agent/v1/related?q=' + encodeURIComponent('subextremal horizons conical strut Ernst potential'), { token: 'poc_open_invite_demo' });
assert.equal(relAgentGet.status, 200);
assert.equal(relAgentGet.json.related_ideas[0].mission_id, 'mission-bh-balance');
const relRpc = await call('/v1/agent', {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: { action: 'find_related', q: 'axis-pole asymptotics logarithmic term', types: 'claim,help_request' },
});
assert.equal(relRpc.status, 200);
assert.ok(relRpc.json.related_ideas.length > 0);
assert.ok(relRpc.json.related_ideas.every(i => ['claim', 'help_request'].includes(i.item_type)));
// The stalled BH candidate (needs_work review) stays discoverable as a prior attempt
assert.ok(relRpc.json.related_ideas.some(i => i.item_id === bhHandoff.json.claim_id && i.prior_attempt === true));

// Receipts and new help requests report similar existing work
const relReq = await call('/api/help-requests', {
  method: 'POST',
  body: {
    mission_id: dupMission.json.mission.id,
    title: 'Monochromatic forcing gadget for 5-colorings',
    question: 'Build a small unit-distance gadget forcing two vertices at distance sqrt(3) to share a color in every 5-coloring.',
    criterion: 'Coordinates plus SAT check.',
    why_useful: 'Lets the 6-chromatic construction reuse Hadwiger-Nelson gadgets.',
  },
});
assert.equal(relReq.status, 201);
assert.ok(relReq.json.similar_existing.some(i => i.item_id === 'help-hn-gadget'));
assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM idea_vectors`).get().n, 0, 'No embeddings are stored without Workers AI');

// Scenario 9: Stage 2 semantic proximity with mock Workers AI + Vectorize, plus graceful fallback
const CONCEPTS = [
  ['black', 'hole', 'horizon', 'einstein', 'gravity', 'gravitational', 'spacetime', 'collapse', 'relativity', 'ernst', 'kerr'],
  ['graph', 'chromatic', 'coloring', 'colorable', 'colour', 'vertex', 'vertices', 'unit', 'distance', 'sat'],
  ['tree', 'shade', 'canopy', 'urban', 'street', 'cooling', 'heat', 'airflow'],
  ['curling', 'string', 'binary', 'sequence', 'witness'],
];
const DIMS = 64;
const aiCalls = { n: 0, texts: 0 };
const mockAI = {
  async run(model, { text }) {
    assert.equal(model, '@cf/baai/bge-base-en-v1.5');
    aiCalls.n++; aiCalls.texts += text.length;
    return {
      shape: [text.length, DIMS],
      data: text.map(t => {
        const v = new Array(DIMS).fill(0);
        for (const w of t.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
          const g = CONCEPTS.findIndex(c => c.includes(w));
          if (g >= 0) v[g] += 1;
          else { let h = 0; for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0; v[4 + (h % (DIMS - 4))] += 0.3; }
        }
        return v;
      }),
    };
  },
};
const vecStore = new Map();
const vecCalls = { upsert: 0, query: 0 };
const mockVectorize = {
  async upsert(items) { vecCalls.upsert++; for (const it of items) vecStore.set(it.id, it.values); return { count: items.length }; },
  async query(vec, { topK }) {
    vecCalls.query++;
    const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return x && y ? d / Math.sqrt(x * y) : 0; };
    return { matches: [...vecStore].map(([id, v]) => ({ id, score: cos(vec, v) })).sort((a, b) => b.score - a.score).slice(0, topK) };
  },
};
async function callEnv(env, path, { method = 'GET', body = null, token = null } = {}) {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await worker.fetch(new Request(`https://proof-commons.example${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { DB: D1, ...env });
  return { status: res.status, json: await res.json() };
}

// Semantic-only match: no shared keywords with the BH mission, but same concept
const semQ = 'gravitational spacetime collapse';
const semAI = await callEnv({ AI: mockAI }, '/api/related?q=' + encodeURIComponent(semQ));
assert.equal(semAI.status, 200);
assert.equal(semAI.json.engine, 'semantic+keyword');
assert.equal(semAI.json.vectorize, false);
assert.ok(semAI.json.related_ideas.length > 0);
assert.equal(semAI.json.related_ideas[0].mission_id, 'mission-bh-balance');
assert.equal(semAI.json.related_ideas[0].match, 'semantic');
assert.equal(semAI.json.related_ideas[0].keyword_score, 0);
const cachedRows = db.prepare(`SELECT COUNT(*) AS n FROM idea_vectors`).get().n;
assert.ok(cachedRows > 0, 'Embeddings are cached in D1');
const kwOnly = await call('/api/related?q=' + encodeURIComponent(semQ));
assert.equal(kwOnly.json.related_ideas.length, 0, 'Keyword engine alone cannot see this match');

// Cached embeddings are reused (no re-embedding of unchanged texts)
const callsBefore = aiCalls.texts;
let semAgain;
for (let i = 0; i < 5; i++) semAgain = await callEnv({ AI: mockAI }, '/api/related?q=' + encodeURIComponent(semQ));
assert.equal(semAgain.json.pending_embeddings, 0);
const backfillDone = aiCalls.texts;
await callEnv({ AI: mockAI }, '/api/related?q=' + encodeURIComponent(semQ));
assert.equal(aiCalls.texts, backfillDone, 'Fully cached corpus + cached query needs no new AI calls');
assert.ok(backfillDone >= callsBefore);

// New claims are indexed on submission and Vectorize is used when bound
const semDraw = await callEnv({ AI: mockAI, VECTORIZE: mockVectorize }, '/api/agent/v1/draw', {
  method: 'POST', token: 'poc_open_invite_demo',
  body: { mission_id: 'mission-hadwiger-nelson-5', scope: 'full_mission', model_family: 'Claude', agent_session: 'sem_sess' },
});
assert.equal(semDraw.status, 200);
const semSubmit = await callEnv({ AI: mockAI, VECTORIZE: mockVectorize }, `/api/agent/v1/runs/${semDraw.json.run_id}/handoff`, {
  method: 'POST', token: 'poc_open_invite_demo',
  body: { outcome: 'partial', finding: 'Partial: a 610-vertex colorable lattice patch; pruning stalled near 540 vertices.', remaining_gap: 'Needs better vertex pruning heuristic.' },
});
assert.equal(semSubmit.status, 200);
assert.ok(db.prepare(`SELECT item_id FROM idea_vectors WHERE item_id = ?`).get(semSubmit.json.claim_id), 'New claim embedded');
assert.ok(vecCalls.upsert > 0);
const semVec = await callEnv({ AI: mockAI, VECTORIZE: mockVectorize }, '/api/related?q=' + encodeURIComponent('vertex coloring of a graph'));
assert.equal(semVec.json.vectorize, true);
assert.ok(vecCalls.query > 0);
assert.ok(semVec.json.related_ideas.some(i => i.mission_id === 'mission-hadwiger-nelson-5'));

// Workers AI failure → silent fallback to keyword engine, still 200
const brokenAI = { async run() { throw new Error('quota exceeded'); } };
const fallback = await callEnv({ AI: brokenAI }, '/api/related?q=' + encodeURIComponent('chromatic unit distance graph'));
assert.equal(fallback.status, 200);
assert.equal(fallback.json.engine, 'keyword');
assert.ok(fallback.json.semantic_error.includes('quota'));
assert.ok(fallback.json.related_ideas.length > 0);
const pageFallback = await callEnv({ AI: brokenAI }, '/api/missions/multi-black-hole-equilibrium');
assert.equal(pageFallback.status, 200);

// UI exposes the related-ideas surfaces & Lean 4 verification gate
const missionHtml = await call('/m/multi-black-hole-equilibrium');
assert.ok(missionHtml.text.includes('Related Ideas Across Missions'));
assert.ok(missionHtml.text.includes('checkRelated('));
assert.ok(missionHtml.text.includes('Lean 4 Formal Proof Required'));
assert.ok(missionHtml.text.includes('Red-Team / Attack'));
assert.ok(missionHtml.text.includes('formalize_lean'));
assert.ok(!missionHtml.text.includes("reviewClaim(\\'\\'' + esc(c.id) + '\\', \\'verified\\'"));
const homeHtml = await call('/');
assert.ok(homeHtml.text.includes('checkRelated('));
assert.ok(homeHtml.text.includes('m-formal'));
const inviteHtml = await call('/invite');
assert.ok(inviteHtml.text.includes('Related Ideas From Other Missions'));
assert.ok(inviteHtml.text.includes('Search First, Reason Second'));
const spec = await call('/openapi.json');
assert.ok(spec.json.paths['/api/agent/v1/related']);
assert.ok(spec.json.components.schemas.HandoffRequest.properties.outcome.enum.includes('literature_found'));
assert.ok(spec.json.components.schemas.HandoffRequest.properties.lean_proof);

// Scenario 10: Locked formal_statement, literature_found, author Lean proof, and formalize_lean delegation
const lockRes = await call('/api/missions/mission-hadwiger-nelson-5/formal-statement', {
  method: 'POST',
  body: { formal_statement: 'theorem hn_5_chromatic : exists G : UnitDistanceGraph, G.card < 509 /\\ G.chromatic >= 5 := by sorry' },
});
assert.equal(lockRes.status, 200);
assert.ok(lockRes.json.formal_statement.includes('hn_5_chromatic'));

const litDraw = await call('/api/agent/v1/draw', {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: { mission_id: 'mission-hadwiger-nelson-5', scope: 'full_mission', model_family: 'GPT', agent_session: 'lit_sess' },
});
assert.equal(litDraw.status, 200);
assert.ok(litDraw.json.mission.formal_statement.includes('hn_5_chromatic'));
assert.ok(litDraw.json.guidance.includes('literature_found'));

const litSubmit = await call(`/api/agent/v1/runs/${litDraw.json.run_id}/handoff`, {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: {
    outcome: 'literature_found',
    finding: 'Found Parts (2020) 509-vertex construction in arXiv:2010.12665 as baseline.',
    references_text: 'https://arxiv.org/abs/2010.12665',
    lean_proof: 'theorem parts_baseline : 509 <= 509 := by omega',
    lean_check_output: 'lake build passed (0 errors)',
  },
});
assert.equal(litSubmit.status, 200);
const litClaim = await call(`/api/claims/${litSubmit.json.claim_id}`);
assert.equal(litClaim.json.claim.outcome, 'literature_found');
assert.ok(litClaim.json.claim.lean_proof.includes('parts_baseline'));

const leanHelp = await call('/v1/agent', {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: {
    action: 'request_help',
    mission_id: 'mission-hadwiger-nelson-5',
    kind: 'formalize_lean',
    title: 'Formalize 5-coloring reduction lemma in Lean 4',
    question: 'Convert Lemma 2.1 into a sorry-free Lean 4 theorem.',
    criterion: 'Compiles cleanly in Lean 4 without sorry.',
  },
});
assert.equal(leanHelp.status, 201);

// Scenario 11: Inclusive non-math missions (computational game + criterion_review psychology test)
const gameMission = await call('/api/missions', {
  method: 'POST',
  body: {
    title: 'Collaborative Browser Co-op Puzzle Game',
    domain: 'Game Dev',
    verification_mode: 'computational',
    question: 'Build a playable 2-player browser puzzle game with deterministic level validation and zero runtime console errors.',
    criterion: 'Playable HTML/JS build with automated unit tests passing and verified playtest through all 5 levels.',
  },
});
assert.equal(gameMission.status, 201);
assert.equal(gameMission.json.mission.verification_mode, 'computational');

const gameDraw = await call('/api/agent/v1/draw', {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: { mission_id: gameMission.json.mission.id, scope: 'full_mission', model_family: 'Claude', agent_session: 'game_author' },
});
const gameSubmit = await call(`/api/agent/v1/runs/${gameDraw.json.run_id}/handoff`, {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: {
    outcome: 'candidate_answer',
    addresses_full_mission: true,
    finding: 'Implemented 5-level co-op puzzle engine with keyboard controls and level solver.',
    how_to_check: 'Run npm test and play levels 1-5 in Chrome.',
  },
});
assert.equal(gameSubmit.status, 200);
// Must reject 1-click verify without run/playtest output
const badGameRev = await call('/api/reviews', {
  method: 'POST',
  body: { claim_id: gameSubmit.json.claim_id, reviewer_session: 'game_rev', verdict: 'verified', completion_met: true, semantic_aligned: true },
});
assert.equal(badGameRev.status, 400);
// Succeeds with reproducible run/playtest output (no Lean 4 required!)
const okGameRev = await call('/api/reviews', {
  method: 'POST',
  body: {
    claim_id: gameSubmit.json.claim_id,
    reviewer_session: 'game_rev',
    reviewer_model: 'GPT',
    verdict: 'verified',
    completion_met: true,
    semantic_aligned: true,
    verification_evidence: 'Ran npm test (18/18 passed) and completed playtest of all 5 co-op levels with zero console errors.',
  },
});
assert.equal(okGameRev.status, 200);
assert.equal(okGameRev.json.mission_status, 'resolved');

const psychMission = await call('/api/missions', {
  method: 'POST',
  body: {
    title: 'Design a Stress-Resilience Psychological Assessment Scale',
    domain: 'Psychology',
    verification_mode: 'criterion_review',
    question: 'Create a 20-item Likert scale measuring workplace stress resilience with reverse-coded items, scoring rubric, and construct validity rationale.',
    criterion: 'All 20 items map clearly to 4 sub-factors, include reverse-coded items, avoid double-barreled wording, and include a scoring manual.',
  },
});
assert.equal(psychMission.status, 201);
assert.equal(psychMission.json.mission.verification_mode, 'criterion_review');

const psychDraw = await call('/api/agent/v1/draw', {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: { mission_id: psychMission.json.mission.id, scope: 'full_mission', model_family: 'Gemini', agent_session: 'psych_author' },
});
const psychSubmit = await call(`/api/agent/v1/runs/${psychDraw.json.run_id}/handoff`, {
  method: 'POST',
  token: 'poc_open_invite_demo',
  body: {
    outcome: 'candidate_answer',
    addresses_full_mission: true,
    finding: 'Drafted 20-item 4-factor stress-resilience inventory with 6 reverse-coded items and scoring rubric.',
  },
});
assert.equal(psychSubmit.status, 200);
// Rejects 1-click verify without structured criterion evaluation
const badPsychRev = await call('/api/reviews', {
  method: 'POST',
  body: { claim_id: psychSubmit.json.claim_id, reviewer_session: 'psych_rev', verdict: 'verified', completion_met: true, semantic_aligned: true, notes: 'ok' },
});
assert.equal(badPsychRev.status, 400);
// Succeeds with structured criterion review + alignment sign-off
const okPsychRev = await call('/api/reviews', {
  method: 'POST',
  body: {
    claim_id: psychSubmit.json.claim_id,
    reviewer_session: 'psych_rev',
    reviewer_model: 'Human',
    verdict: 'verified',
    completion_met: true,
    semantic_aligned: true,
    verification_evidence: 'Checked all 20 items across the 4 sub-factors: no double-barreled items, 6 reverse-coded items verified, scoring thresholds clear.',
  },
});
assert.equal(okPsychRev.status, 200);
assert.equal(okPsychRev.json.mission_status, 'resolved');

// Verify starter catalog (30 curated missions + original seeds) auto-seeded across all 3 gates
const listRes = await call('/api/missions');
assert.equal(listRes.status, 200);
assert.ok(listRes.json.missions.length >= 34, `Expected >= 34 missions, got ${listRes.json.missions.length}`);
const modesSeen = new Set(listRes.json.missions.map(m => m.verification_mode));
assert.ok(modesSeen.has('lean4') && modesSeen.has('computational') && modesSeen.has('criterion_review'));

console.log('ALL_11_SCENARIOS_PASSED');
