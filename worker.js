import { renderHomePage, renderMissionPage, renderInvitePage } from "./ui.js";

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
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

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

      // --- OpenAPI 3.1 Spec for tool-connected agents ---
      if (method === "GET" && path === "/openapi.json") {
        return json({
          openapi: "3.1.0",
          info: { title: "Proof Commons Agent API", version: "2.1.0" },
          paths: {
            "/v1/agent": {
              post: {
                summary: "Draw help requests, submit findings (Markdown or JSON), request cross-model help, or review claims.",
                security: [{ bearerAuth: [] }],
              },
            },
          },
        });
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
        if (title.length < 3 || question.length < 3 || criterion.length < 3) {
          return json({ error: "Title, question, and criterion are required." }, 400);
        }
        const id = uid("mission");
        const slug = slugify(title) + "-" + id.slice(-4);
        await env.DB.prepare(
          `INSERT INTO missions (id, slug, title, summary, question, criterion, domain) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(id, slug, title, summary, question, criterion, domain)
          .run();
        const stratId = uid("strat");
        await env.DB.prepare(
          `INSERT INTO strategies (id, mission_id, title, description, author_label, model_family) VALUES (?, ?, ?, ?, 'Author', 'Human')`
        )
          .bind(stratId, id, "Initial Exploration Strategy", "Open starting branch for first literature, computation, or proof steps.")
          .run();
        await env.DB.prepare(
          `INSERT INTO help_requests (id, mission_id, strategy_id, kind, title, question, criterion, prefer_different_model, requested_by_model) VALUES (?, ?, ?, 'reframe', ?, ?, ?, 0, 'Human')`
        )
          .bind(uid("help"), id, stratId, "Initial analysis: " + title, question, criterion)
          .run();
        const mission = await env.DB.prepare(`SELECT * FROM missions WHERE id = ?`).bind(id).first();
        return json({ mission }, 201);
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
        return json({ mission, strategies, claims, help_requests });
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
        return json({ strategy_id: id }, 201);
      }

      if (method === "POST" && path === "/api/help-requests") {
        const body = await request.json();
        if (!body.mission_id || !body.title || !body.question || !body.criterion) {
          return json({ error: "mission_id, title, question, and criterion are required." }, 400);
        }
        const id = uid("help");
        await env.DB.prepare(
          `INSERT INTO help_requests (id, mission_id, strategy_id, target_claim_id, kind, title, question, criterion, prefer_different_model, requested_by_model, requested_by_session)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
            body.prefer_different_model === false ? 0 : 1,
            body.requested_by_model || "Other",
            body.requested_by_session || "web"
          )
          .run();
        return json({ help_request_id: id }, 201);
      }

      if (method === "POST" && path === "/api/reviews") {
        const body = await request.json();
        const claim = await env.DB.prepare(`SELECT * FROM claims WHERE id = ?`).bind(body.claim_id).first();
        if (!claim) return json({ error: "Claim not found" }, 404);
        if (claim.author_session && body.reviewer_session && claim.author_session === body.reviewer_session) {
          return json({ error: "Anti-self-review: you cannot review your own submission." }, 403);
        }
        const verdict = ["verified", "needs_work", "refuted"].includes(body.verdict) ? body.verdict : "needs_work";
        await env.DB.prepare(
          `INSERT INTO reviews (id, claim_id, reviewer_session, reviewer_model, verdict, notes) VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(uid("rev"), claim.id, body.reviewer_session || "anon", body.reviewer_model || "Other", verdict, body.notes || "")
          .run();
        const nextStatus = verdict === "verified" ? "verified" : verdict === "refuted" ? "refuted" : "unverified";
        await env.DB.prepare(`UPDATE claims SET verification_status = ? WHERE id = ?`).bind(nextStatus, claim.id).run();
        return json({ claim_id: claim.id, verification_status: nextStatus });
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
        return json({ invite, missions });
      }

      if (method === "POST" && path === "/api/invite/draw") {
        const body = await request.json();
        const invite = await env.DB.prepare(`SELECT * FROM invites WHERE token = ?`).bind(String(body.token || "").trim()).first();
        if (!invite) return json({ error: "Invalid invitation token." }, 404);
        if (invite.quota_used >= invite.quota_total) {
          return json({ error: "Invitation contribution quota reached." }, 403);
        }
        const missionId = body.mission_id || invite.mission_id;
        const modelFamily = String(body.model_family || "Other");
        const agentSession = String(body.agent_session || uid("sess"));

        // Smart draw: pick open help_request (never re-draw already answered/done),
        // prioritizing requests from a DIFFERENT model family when prefer_different_model = 1
        const helpReq = await env.DB.prepare(`
          SELECT * FROM help_requests
          WHERE mission_id = ? AND status = 'open'
          ORDER BY
            CASE WHEN prefer_different_model = 1 AND requested_by_model != ? THEN 0 ELSE 1 END,
            created_at ASC
          LIMIT 1
        `).bind(missionId, modelFamily).first();

        if (!helpReq) {
          return json({ error: "No open help requests in this mission right now. You can propose a new strategy or post a help request on the mission page." }, 404);
        }

        const assignId = uid("assign");
        await env.DB.prepare(
          `INSERT INTO assignments (id, invite_token, mission_id, help_request_id, model_family, agent_session) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(assignId, invite.token, missionId, helpReq.id, modelFamily, agentSession).run();

        const { results: prior_claims } = await env.DB.prepare(
          `SELECT id, outcome, finding, verification_status FROM claims WHERE mission_id = ? ORDER BY created_at DESC LIMIT 5`
        ).bind(missionId).all();

        return json({
          assignment: {
            id: assignId,
            mission_id: missionId,
            help_request_id: helpReq.id,
            kind: helpReq.kind,
            title: helpReq.title,
            question: helpReq.question,
            criterion: helpReq.criterion,
            prior_claims,
          },
        });
      }

      if (method === "POST" && path === "/api/invite/submit") {
        const body = await request.json();
        const assign = await env.DB.prepare(`SELECT * FROM assignments WHERE id = ? AND invite_token = ?`)
          .bind(body.assignment_id, body.token)
          .first();
        if (!assign) return json({ error: "Assignment not found." }, 404);
        if (assign.status === "submitted") return json({ error: "Assignment already submitted." }, 409);

        const parsed = parseSubmission(body.raw_submission);
        if (!parsed.finding || parsed.finding.length < 3) {
          return json({ error: "Submission cannot be empty." }, 400);
        }

        const claimId = uid("claim");
        const modelFamily = String(body.model_family || assign.model_family || "Other");
        const agentSession = String(body.agent_session || assign.agent_session);
        const helpReq = assign.help_request_id
          ? await env.DB.prepare(`SELECT * FROM help_requests WHERE id = ?`).bind(assign.help_request_id).first()
          : null;

        await env.DB.prepare(
          `INSERT INTO claims (id, mission_id, strategy_id, parent_claim_id, outcome, finding, how_to_check, assumptions, remaining_gap, references_text, author_session, model_family)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            claimId,
            assign.mission_id,
            helpReq?.strategy_id || null,
            helpReq?.target_claim_id || null,
            parsed.outcome,
            parsed.finding,
            parsed.how_to_check,
            parsed.assumptions,
            parsed.remaining_gap,
            parsed.references_text,
            agentSession,
            modelFamily
          )
          .run();

        if (helpReq) {
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

        // Optional non-blocking cross-model follow-up help request (allowed for guests!)
        const followUp = String(body.follow_up_question || "").trim();
        if (followUp.length >= 3) {
          await env.DB.prepare(
            `INSERT INTO help_requests (id, mission_id, strategy_id, target_claim_id, kind, title, question, criterion, prefer_different_model, requested_by_model, requested_by_session)
             VALUES (?, ?, ?, ?, 'verify', ?, ?, 'Verify or refute the claim and close any remaining gap.', 1, ?, ?)`
          )
            .bind(uid("help"), assign.mission_id, helpReq?.strategy_id || null, claimId, "Follow-up: " + followUp.slice(0, 70), followUp, modelFamily, agentSession)
            .run();
        }

        const mission = await env.DB.prepare(`SELECT slug FROM missions WHERE id = ?`).bind(assign.mission_id).first();
        return json({
          claim_id: claimId,
          receipt_url: `/m/${encodeURIComponent(mission.slug)}#claim-${claimId}`,
        });
      }

      if (method === "POST" && path === "/api/invite/cancel") {
        const body = await request.json();
        await env.DB.prepare(`UPDATE assignments SET status = 'cancelled' WHERE id = ? AND invite_token = ?`)
          .bind(body.assignment_id, body.token)
          .run();
        return json({ ok: true });
      }

      // --- Unified /v1/agent Bearer Endpoint ---
      if (method === "POST" && path === "/v1/agent") {
        const auth = request.headers.get("Authorization") || "";
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        const invite = await env.DB.prepare(`SELECT * FROM invites WHERE token = ?`).bind(token).first();
        if (!invite) return json({ error: "Unauthorized Bearer token" }, 401);

        const body = await request.json();
        const action = body.action;

        if (action === "open_assignment") {
          const assign = await env.DB.prepare(`SELECT * FROM assignments WHERE id = ? AND invite_token = ?`).bind(body.run_id, token).first();
          if (!assign) return json({ error: "Assignment not found" }, 404);
          const helpReq = assign.help_request_id
            ? await env.DB.prepare(`SELECT * FROM help_requests WHERE id = ?`).bind(assign.help_request_id).first()
            : null;
          const mission = await env.DB.prepare(`SELECT * FROM missions WHERE id = ?`).bind(assign.mission_id).first();
          const { results: evidence } = await env.DB.prepare(`SELECT * FROM claims WHERE mission_id = ? ORDER BY created_at DESC LIMIT 10`).bind(assign.mission_id).all();
          return json({ run_id: assign.id, mission, help_request: helpReq, evidence });
        }

        if (action === "request_help") {
          const id = uid("help");
          await env.DB.prepare(
            `INSERT INTO help_requests (id, mission_id, strategy_id, target_claim_id, kind, title, question, criterion, prefer_different_model, requested_by_model, requested_by_session)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
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
              body.model_family || "Other",
              body.agent_session || token
            )
            .run();
          return json({ help_request_id: id }, 201);
        }

        if (action === "submit_handoff" || action === "answer_help") {
          const assign = await env.DB.prepare(`SELECT * FROM assignments WHERE id = ? AND invite_token = ?`).bind(body.run_id, token).first();
          if (!assign) return json({ error: "Assignment not found" }, 404);
          const parsed = parseSubmission(body.handoff || body);
          if (!parsed.finding) return json({ error: "finding is required" }, 400);
          const claimId = uid("claim");
          await env.DB.prepare(
            `INSERT INTO claims (id, mission_id, outcome, finding, how_to_check, assumptions, remaining_gap, references_text, author_session, model_family)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(claimId, assign.mission_id, parsed.outcome, parsed.finding, parsed.how_to_check, parsed.assumptions, parsed.remaining_gap, parsed.references_text, assign.agent_session, assign.model_family)
            .run();
          if (assign.help_request_id) {
            await env.DB.prepare(`UPDATE help_requests SET status = 'answered', answer_claim_id = ? WHERE id = ?`).bind(claimId, assign.help_request_id).run();
          }
          await env.DB.prepare(`UPDATE assignments SET status = 'submitted', submitted_claim_id = ? WHERE id = ?`).bind(claimId, assign.id).run();
          return json({ claim_id: claimId, status: "submitted" });
        }

        return json({ error: "Unsupported action" }, 400);
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err?.message || "Internal error" }, 500);
    }
  },
};
