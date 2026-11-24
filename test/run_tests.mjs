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

// Independent reviewer verifies and resolves the mission
const curlRev = await call('/api/reviews', {
  method: 'POST',
  body: {
    claim_id: curlSubmit.json.claim_id,
    reviewer_session: 'independent_rev_1',
    reviewer_model: 'GPT',
    verdict: 'verified',
    completion_met: true,
    notes: 'Independently verified witness and exhaustive proof.',
  },
});
assert.equal(curlRev.status, 200);
assert.equal(curlRev.json.verification_status, 'verified');
assert.equal(curlRev.json.mission_status, 'resolved');

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
for (const path of ['/', '/invite', '/m/multi-black-hole-equilibrium', '/openapi.json', '/api/missions/multi-black-hole-equilibrium']) {
  const r = await call(path);
  assert.equal(r.status, 200, `Expected 200 for ${path}`);
}
const invitePage = await call('/invite');
assert.ok(invitePage.text.includes('Work on Full Mission'));
assert.ok(invitePage.text.includes('Submit as a candidate solution to the full mission'));

console.log('ALL_6_SCENARIOS_PASSED');
