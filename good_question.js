// Good Question — Evidence Synthesis & Follow-Up Hypothesis Engine
//
// Unifies missions, verified/partial/stalled claims, gaps, and optional external notes
// to produce:
//   1. A concise synthesis of what is currently known and where prior attempts stalled.
//   2. Grounded, falsifiable follow-up hypotheses ("Good Questions") with novelty checks,
//      completion criteria, and recommended verification gates (lean4 / computational / criterion_review).
//
// Uses Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct) when `env.AI` is bound,
// and falls back cleanly to a structured graph-based synthesizer when `env.AI` is unavailable.

import { safeRelatedIdeas } from "./similarity.js";

export const SYNTHESIS_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const VALID_MODES = ["lean4", "computational", "criterion_review"];

function uid(prefix = "gq") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function clip(s, n) {
  const str = String(s || "").replace(/\s+/g, " ").trim();
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function normMode(v, fallback = "criterion_review") {
  return VALID_MODES.includes(v) ? v : fallback;
}

async function gatherEvidence(env, { topic, missionIds = [], claimIds = [], externalNotes = "" }) {
  const queryText = [topic, externalNotes].filter(Boolean).join("\n").trim();
  const related = queryText
    ? await safeRelatedIdeas(env, { text: queryText, limit: 10 })
    : { items: [], engine: "keyword" };

  const missionSet = new Set((missionIds || []).filter(Boolean));
  const claimSet = new Set((claimIds || []).filter(Boolean));
  for (const r of related.items) {
    if (r.mission_id) missionSet.add(r.mission_id);
    if (r.item_type === "claim") claimSet.add(r.item_id);
  }

  // If user gave neither a matching topic nor explicit IDs, pull most active missions/claims
  if (missionSet.size === 0) {
    const { results: recent } = await env.DB.prepare(
      `SELECT id FROM missions WHERE status = 'active' ORDER BY created_at DESC LIMIT 4`
    ).all();
    for (const m of recent) missionSet.add(m.id);
  }

  const missions = [];
  for (const mId of [...missionSet].slice(0, 6)) {
    const row = await env.DB.prepare(
      `SELECT id, slug, title, summary, question, criterion, domain, status, verification_mode FROM missions WHERE id = ? OR slug = ?`
    ).bind(mId, mId).first();
    if (row) missions.push(row);
  }

  const claims = [];
  const seenClaims = new Set();
  for (const cId of [...claimSet].slice(0, 8)) {
    const row = await env.DB.prepare(
      `SELECT id, mission_id, outcome, finding, assumptions, remaining_gap, verification_status, model_family FROM claims WHERE id = ?`
    ).bind(cId).first();
    if (row && !seenClaims.has(row.id)) {
      seenClaims.add(row.id);
      claims.push(row);
    }
  }
  for (const m of missions) {
    const { results: mClaims } = await env.DB.prepare(
      `SELECT id, mission_id, outcome, finding, assumptions, remaining_gap, verification_status, model_family FROM claims WHERE mission_id = ? ORDER BY created_at DESC LIMIT 3`
    ).bind(m.id).all();
    for (const c of mClaims) {
      if (!seenClaims.has(c.id)) {
        seenClaims.add(c.id);
        claims.push(c);
      }
    }
  }

  const openGaps = [];
  for (const m of missions) {
    const { results: helps } = await env.DB.prepare(
      `SELECT id, mission_id, kind, title, question, why_useful, disputed_step FROM help_requests WHERE mission_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 2`
    ).bind(m.id).all();
    for (const h of helps) openGaps.push(h);
  }

  return { missions, claims: claims.slice(0, 10), openGaps: openGaps.slice(0, 8), relatedEngine: related.engine };
}

function buildDeterministicSynthesis({ topic, externalNotes, missions, claims, openGaps, count }) {
  const domains = [...new Set(missions.map(m => m.domain).filter(Boolean))];
  const verifiedCount = claims.filter(c => c.verification_status === "verified").length;
  const gapClaims = claims.filter(c => c.remaining_gap && c.remaining_gap.trim().length > 5);

  const summaryParts = [
    `Unified ${missions.length} mission(s) across ${domains.join(", ") || "General"}` +
      (claims.length ? ` and ${claims.length} recorded finding(s) (${verifiedCount} verified, ${claims.length - verifiedCount} open/in-progress).` : "."),
    gapClaims.length
      ? `Key unresolved bottleneck observed: ${clip(gapClaims[0].remaining_gap, 180)}`
      : (openGaps.length ? `Active open subproblem: ${clip(openGaps[0].title, 140)}.` : ""),
    externalNotes ? `Incorporated external context: ${clip(externalNotes, 160)}` : "",
  ].filter(Boolean);

  const synthesis_summary = summaryParts.join(" ");
  const candidates = [];

  // 1. Gap-driven follow-up from stalled/partial claim or disputed step
  if (gapClaims.length > 0) {
    const c = gapClaims[0];
    const m = missions.find(x => x.id === c.mission_id) || missions[0];
    candidates.push({
      title: `Can we close the gap: ${clip(c.remaining_gap, 72)}?`,
      hypothesis: `Resolving "${clip(c.remaining_gap, 140)}" will either unlock the main route in "${m?.title || topic}" or reveal a structural obstruction.`,
      question: `Given prior finding ${c.id} ("${clip(c.finding, 160)}"), what minimal additional lemma, data, or counterexample settles the remaining gap: ${c.remaining_gap}?`,
      criterion: `Provide either a verified resolution closing the gap in ${c.id} or a concrete counterexample showing why the route fails.`,
      domain: m?.domain || "General",
      verification_mode: normMode(m?.verification_mode),
      why_interesting: `Directly targets the exact bottleneck blocking existing finding ${c.id} instead of restarting from scratch.`,
      source_ids: [c.id, m?.id].filter(Boolean),
    });
  }

  // 2. Cross-mission unification / bridge hypothesis
  if (missions.length >= 2) {
    const m1 = missions[0];
    const m2 = missions[1];
    const mode = m1.verification_mode === "computational" || m2.verification_mode === "computational"
      ? "computational"
      : (m1.verification_mode === "lean4" && m2.verification_mode === "lean4" ? "lean4" : "criterion_review");
    candidates.push({
      title: `Cross-domain synthesis: transferring methods between "${clip(m1.title, 42)}" and "${clip(m2.title, 42)}"`,
      hypothesis: `The core constraint structure in ${m1.domain} (${clip(m1.title, 60)}) shares transferable verification or modeling mechanics with ${m2.domain} (${clip(m2.title, 60)}).`,
      question: `Can a unified framework or shared verification harness solve subproblems in both "${m1.title}" and "${m2.title}"—or where does the analogy break down?`,
      criterion: `Deliver an explicit mapping of shared abstractions plus at least one concrete tested transfer or sharp breakdown counterexample.`,
      domain: m1.domain === m2.domain ? m1.domain : `${m1.domain} × ${m2.domain}`,
      verification_mode: mode,
      why_interesting: `Connects two active threads (${m1.id} & ${m2.id}) that contributors working in isolation rarely combine.`,
      source_ids: [m1.id, m2.id],
    });
  }

  // 3. Assumption stress-test / edge-regime question
  const m0 = missions[0];
  const assumptionSeed = claims.find(c => c.assumptions && c.assumptions.length > 5)?.assumptions || m0?.summary || topic;
  candidates.push({
    title: topic
      ? `Where do standard assumptions break for "${clip(topic, 58)}"?`
      : `Stress-testing core assumptions behind "${clip(m0?.title || "this domain", 55)}"`,
    hypothesis: `Relaxing one hidden assumption ("${clip(assumptionSeed, 120)}") exposes a regime where existing solutions degrade or invert.`,
    question: `Identify the sharpest boundary condition or realistic failure regime for ${topic || m0?.title || "the target problem"}, and test whether current approaches still hold under that relaxed assumption.`,
    criterion: `Document at least one concrete boundary/failure regime with reproducible evidence, simulation, or proof and propose a revised threshold.`,
    domain: m0?.domain || "General",
    verification_mode: normMode(m0?.verification_mode),
    why_interesting: `Turns tacit assumptions into falsifiable stress-tests that prevent brittle conclusions.`,
    source_ids: [m0?.id, ...claims.slice(0, 2).map(c => c.id)].filter(Boolean),
  });

  // 4. Open subproblem generalization if still need more
  if (candidates.length < count && openGaps.length > 0) {
    const h = openGaps[0];
    const m = missions.find(x => x.id === h.mission_id) || m0;
    candidates.push({
      title: `Generalizing subproblem: ${clip(h.title, 68)}`,
      hypothesis: `A reusable benchmark or general lemma answering "${clip(h.title, 80)}" will accelerate multiple downstream missions in ${m?.domain || "this area"}.`,
      question: `Beyond the single instance in "${m?.title || ""}", what general criterion or reusable tool settles: ${clip(h.question, 180)}?`,
      criterion: `Produce a general, reusable artifact or theorem validated on >= 3 distinct instances.`,
      domain: m?.domain || "General",
      verification_mode: normMode(m?.verification_mode),
      why_interesting: `Lifts a narrow open request (${h.id}) into a reusable building block for the whole community.`,
      source_ids: [h.id, m?.id].filter(Boolean),
    });
  }

  return { synthesis_summary, questions: candidates.slice(0, count) };
}

async function tryAiSynthesis(env, { topic, externalNotes, missions, claims, openGaps, count }) {
  if (!env?.AI || typeof env.AI.run !== "function") return null;
  const contextLines = [
    topic ? `Focus Topic: ${topic}` : "",
    externalNotes ? `User External Notes / Findings:\n${clip(externalNotes, 1000)}` : "",
    "Existing Missions:",
    ...missions.map(m => `- [${m.id}] (${m.domain}, gate=${m.verification_mode}) ${m.title} | Q: ${clip(m.question, 160)}`),
    claims.length ? "Recorded Findings & Gaps:" : "",
    ...claims.map(c => `- [${c.id}] (${c.verification_status}/${c.outcome}) ${clip(c.finding, 160)}${c.remaining_gap ? " | GAP: " + clip(c.remaining_gap, 120) : ""}`),
    openGaps.length ? "Open Subproblems:" : "",
    ...openGaps.map(h => `- [${h.id}] ${clip(h.title, 100)}: ${clip(h.question, 120)}`),
  ].filter(Boolean).join("\n");

  const sysPrompt =
    "You are 'Good Question', a scientific and collaborative-project hypothesis synthesizer. " +
    "Given existing missions, findings, stalled gaps, and optional notes, unify what is known and propose " +
    `${count} sharp, falsifiable, non-generic follow-up questions that bridge results or resolve real bottlenecks. ` +
    "Respond ONLY with valid JSON matching this schema: " +
    '{"synthesis_summary":"string","questions":[{"title":"string","hypothesis":"string","question":"string","criterion":"string","domain":"string","verification_mode":"lean4|computational|criterion_review","why_interesting":"string","source_ids":["id1"]}]}.';

  const out = await env.AI.run(SYNTHESIS_MODEL, {
    messages: [
      { role: "system", content: sysPrompt },
      { role: "user", content: contextLines },
    ],
    max_tokens: 1200,
  });

  const rawText = String(out?.response || out?.result?.response || "").trim();
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]);
  if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) return null;

  const defaultMode = normMode(missions[0]?.verification_mode);
  const questions = parsed.questions.slice(0, count).map(q => ({
    title: clip(q.title || "Follow-up Question", 140),
    hypothesis: clip(q.hypothesis || q.question || "", 400),
    question: clip(q.question || q.title || "", 600),
    criterion: clip(q.criterion || "Provide reproducible evidence or independent peer verification settling the question.", 400),
    domain: clip(q.domain || missions[0]?.domain || "General", 40),
    verification_mode: normMode(q.verification_mode, defaultMode),
    why_interesting: clip(q.why_interesting || "Synthesized from existing findings and unresolved gaps.", 320),
    source_ids: Array.isArray(q.source_ids) ? q.source_ids.map(String).slice(0, 6) : missions.slice(0, 2).map(m => m.id),
  })).filter(q => q.title.length >= 5 && q.question.length >= 10);

  if (!questions.length) return null;
  return {
    synthesis_summary: clip(parsed.synthesis_summary || "Synthesized existing findings into follow-up hypotheses.", 600),
    questions,
  };
}

export async function synthesizeGoodQuestions(env, opts = {}) {
  const topic = String(opts.topic || "").trim();
  const externalNotes = String(opts.external_notes || "").trim();
  const missionIds = Array.isArray(opts.mission_ids) ? opts.mission_ids : [];
  const claimIds = Array.isArray(opts.claim_ids) ? opts.claim_ids : [];
  const count = Math.max(1, Math.min(5, Number(opts.count) || 3));

  const evidence = await gatherEvidence(env, { topic, missionIds, claimIds, externalNotes });

  let engine = "deterministic";
  let aiError = null;
  let result = null;
  try {
    result = await tryAiSynthesis(env, { topic, externalNotes, ...evidence, count });
    if (result) engine = "workers_ai";
  } catch (err) {
    aiError = String(err?.message || err).slice(0, 140);
  }
  if (!result) {
    result = buildDeterministicSynthesis({ topic, externalNotes, ...evidence, count });
  }

  const persisted = [];
  for (const q of result.questions) {
    const id = uid("gq");
    const rel = await safeRelatedIdeas(env, { text: `${q.title}\n${q.question}`, limit: 3 });
    const topScore = rel.items[0]?.score || 0;
    const novelty_score = Math.round(Math.max(0, Math.min(1, 1 - topScore)) * 100) / 100;

    await env.DB.prepare(
      `INSERT INTO good_questions (id, topic, synthesis_summary, title, hypothesis, question, criterion, domain, verification_mode, why_interesting, source_ids_json, novelty_score, engine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      topic || evidence.missions.map(m => m.domain).slice(0, 2).join(" & ") || "Cross-Mission Synthesis",
      result.synthesis_summary,
      q.title,
      q.hypothesis,
      q.question,
      q.criterion,
      q.domain,
      q.verification_mode,
      q.why_interesting,
      JSON.stringify(q.source_ids || []),
      novelty_score,
      engine
    ).run();

    persisted.push({
      id,
      ...q,
      synthesis_summary: result.synthesis_summary,
      novelty_score,
      novelty_pct: Math.round(novelty_score * 100),
      closest_existing: rel.items.slice(0, 2),
      endorsements: 0,
      launched_mission_id: null,
      engine,
    });
  }

  return {
    topic: topic || "Cross-Mission Synthesis",
    engine,
    ...(aiError ? { ai_fallback_reason: aiError } : {}),
    synthesis_summary: result.synthesis_summary,
    sources: {
      missions: evidence.missions.map(m => ({ id: m.id, slug: m.slug, title: m.title, domain: m.domain })),
      claims: evidence.claims.map(c => ({ id: c.id, mission_id: c.mission_id, status: c.verification_status, outcome: c.outcome })),
    },
    questions: persisted,
  };
}
