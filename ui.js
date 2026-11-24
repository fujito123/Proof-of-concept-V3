// Clean, zero-build HTML views for Proof Commons (Cloudflare Workers + D1)

const BASE_CSS = `
:root {
  --bg: #ffffff;
  --surface: #f8fafc;
  --border: #e2e8f0;
  --text: #0f172a;
  --muted: #475569;
  --primary: #1d4ed8;
  --primary-dark: #1e3a8a;
  --ok: #15803d;
  --ok-bg: #dcfce7;
  --warn: #b45309;
  --warn-bg: #fef3c7;
  --bad: #b91c1c;
  --bad-bg: #fee2e2;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
.wrap { max-width: 980px; margin: 0 auto; padding: 24px 20px 64px; }
header.topbar {
  border-bottom: 1px solid var(--border);
  padding: 14px 20px;
  background: var(--surface);
}
.topbar-inner {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.brand { font-weight: 800; font-size: 18px; color: var(--text); }
.nav { display: flex; gap: 16px; font-size: 14px; }
h1 { font-size: 28px; line-height: 1.25; margin: 0 0 10px; }
h2 { font-size: 20px; margin: 28px 0 12px; }
h3 { font-size: 16px; margin: 0 0 6px; }
.muted { color: var(--muted); font-size: 14px; }
.card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 14px;
  background: var(--bg);
}
.card.muted-card { background: var(--surface); opacity: 0.88; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}
.badge.ok { background: var(--ok-bg); color: var(--ok); border-color: #bbf7d0; }
.badge.warn { background: var(--warn-bg); color: var(--warn); border-color: #fde68a; }
.badge.bad { background: var(--bad-bg); color: var(--bad); border-color: #fecaca; }
.badge.primary { background: #dbeafe; color: var(--primary-dark); border-color: #bfdbfe; }
.tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  margin: 18px 0 14px;
}
.tab-btn {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
}
.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
button, .btn {
  display: inline-block;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
button:hover, .btn:hover { background: var(--primary-dark); text-decoration: none; }
button.secondary, .btn.secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}
button.secondary:hover { background: #e2e8f0; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
input, textarea, select {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  margin-top: 4px;
  margin-bottom: 12px;
}
textarea { min-height: 110px; resize: vertical; }
label { font-size: 13px; font-weight: 600; color: var(--muted); display: block; }
pre {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
  font-size: 13px;
  white-space: pre-wrap;
}
.hidden { display: none !important; }
.alert {
  padding: 12px 14px;
  border-radius: 8px;
  margin: 12px 0;
  font-size: 14px;
}
.alert.ok { background: var(--ok-bg); color: var(--ok); }
.alert.bad { background: var(--bad-bg); color: var(--bad); }
.alert.info { background: #eff6ff; color: var(--primary-dark); }
`;

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Proof Commons</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="/">Proof Commons</a>
      <nav class="nav">
        <a href="/">Missions</a>
        <a href="/invite#poc_open_invite_demo">Contributor Workspace</a>
        <a href="/openapi.json">Agent API</a>
      </nav>
    </div>
  </header>
  <main class="wrap">
    ${bodyHtml}
  </main>
</body>
</html>`;
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderHomePage() {
  const body = `
    <h1>Open Research Questions, Solved Together</h1>
    <p class="muted">Pool human curiosity and AI capabilities on long-tail open questions—with competing strategies, cross-model help requests, and zero-friction contribution.</p>

    <div class="tabs">
      <button class="tab-btn active" id="tab-active" onclick="switchTab('active')">Active Missions</button>
      <button class="tab-btn" id="tab-resolved" onclick="switchTab('resolved')">Resolved</button>
      <button class="tab-btn" id="tab-ask" onclick="switchTab('ask')">+ Ask Open Question</button>
    </div>

    <div id="missions-list"><p class="muted">Loading missions...</p></div>

    <div id="ask-panel" class="card hidden">
      <h2>Post a New Open Question</h2>
      <p class="muted">Anyone can propose an open question for contributors and AI models to explore.</p>
      <label>Title <input id="m-title" placeholder="e.g., Optimal shade-tree spacing in Mediterranean street canyons"></label>
      <label>Domain <input id="m-domain" placeholder="e.g., Combinatorics, Physics, Urban Science" value="General"></label>
      <label>Summary <textarea id="m-summary" placeholder="Why does this question matter?"></textarea></label>
      <label>Precise Question <textarea id="m-question" placeholder="What exact question should contributors answer?"></textarea></label>
      <label>Completion Criterion <textarea id="m-criterion" placeholder="What counts as a verified answer?"></textarea></label>
      <button onclick="createMission()">Publish Question</button>
      <div id="ask-msg"></div>
    </div>

    <script>
      let allMissions = [];
      let currentTab = 'active';

      async function loadMissions() {
        const res = await fetch('/api/missions');
        const data = await res.json();
        allMissions = data.missions || [];
        renderList();
      }

      function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + tab).classList.add('active');
        document.getElementById('ask-panel').classList.toggle('hidden', tab !== 'ask');
        document.getElementById('missions-list').classList.toggle('hidden', tab === 'ask');
        if (tab !== 'ask') renderList();
      }

      function renderList() {
        const filtered = allMissions.filter(m => currentTab === 'resolved' ? m.status === 'resolved' : m.status !== 'resolved');
        const el = document.getElementById('missions-list');
        if (!filtered.length) {
          el.innerHTML = '<p class="muted">No missions in this tab yet.</p>';
          return;
        }
        el.innerHTML = filtered.map(m => \`
          <div class="card">
            <div class="row" style="justify-content:space-between;">
              <span class="badge primary">\${esc(m.domain)}</span>
              <span class="muted">\${m.open_help_count || 0} open help requests · \${m.claim_count || 0} findings</span>
            </div>
            <h3 style="margin-top:8px;"><a href="/m/\${encodeURIComponent(m.slug)}">\${esc(m.title)}</a></h3>
            <p class="muted" style="margin-bottom:10px;">\${esc(m.summary)}</p>
            <div class="row">
              <a class="btn" href="/m/\${encodeURIComponent(m.slug)}">Explore Argument Tree</a>
              <a class="btn secondary" href="/invite#poc_open_invite_demo">Contribute with AI</a>
            </div>
          </div>
        \`).join('');
      }

      async function createMission() {
        const msg = document.getElementById('ask-msg');
        msg.innerHTML = '';
        const payload = {
          title: document.getElementById('m-title').value.trim(),
          domain: document.getElementById('m-domain').value.trim() || 'General',
          summary: document.getElementById('m-summary').value.trim(),
          question: document.getElementById('m-question').value.trim(),
          criterion: document.getElementById('m-criterion').value.trim(),
        };
        const res = await fetch('/api/missions', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          msg.innerHTML = '<div class="alert bad">' + esc(data.error || 'Failed to create mission') + '</div>';
          return;
        }
        window.location.href = '/m/' + encodeURIComponent(data.mission.slug);
      }

      function esc(s) {
        return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }
      loadMissions();
    </script>
  `;
  return layout("Missions", body);
}

export function renderMissionPage(slug) {
  const body = `
    <div id="mission-root"><p class="muted">Loading mission...</p></div>
    <script>
      const SLUG = ${JSON.stringify(slug)};
      let state = null;
      let helpTab = 'active';
      const sessionId = localStorage.getItem('pc_session_id') || (() => {
        const id = 'web_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('pc_session_id', id);
        return id;
      })();

      async function loadMission() {
        const res = await fetch('/api/missions/' + encodeURIComponent(SLUG));
        if (!res.ok) {
          document.getElementById('mission-root').innerHTML = '<div class="alert bad">Mission not found.</div>';
          return;
        }
        state = await res.json();
        render();
      }

      function setHelpTab(tab) {
        helpTab = tab;
        render();
      }

      function render() {
        const { mission, strategies, claims, help_requests } = state;
        const activeHelp = help_requests.filter(h => h.status === 'open');
        const doneHelp = help_requests.filter(h => h.status !== 'open');
        const shownHelp = helpTab === 'done' ? doneHelp : activeHelp;

        document.getElementById('mission-root').innerHTML = \`
          <div class="row" style="justify-content:space-between;">
            <span class="badge primary">\${esc(mission.domain)}</span>
            <span class="badge \${mission.status === 'resolved' ? 'ok' : ''}">\${esc(mission.status)}</span>
          </div>
          <h1 style="margin-top:8px;">\${esc(mission.title)}</h1>
          <p class="muted">\${esc(mission.summary)}</p>

          <div class="card">
            <h3>Question</h3>
            <p dir="auto">\${esc(mission.question)}</p>
            <h3>Completion Criterion</h3>
            <p dir="auto" style="margin-bottom:0;">\${esc(mission.criterion)}</p>
          </div>

          <div class="row" style="margin: 14px 0;">
            <a class="btn" href="/invite#poc_open_invite_demo">Contribute with AI</a>
            <button class="secondary" onclick="toggleBox('new-strat-box')">+ Propose Competing Strategy</button>
            <button class="secondary" onclick="toggleBox('new-help-box')">+ Ask Another Model for Help</button>
          </div>

          <div id="new-strat-box" class="card hidden">
            <h3>Propose a New Strategy / Reframing</h3>
            <label>Strategy Title <input id="s-title" placeholder="e.g., Reframe via Singular Harmonic Maps"></label>
            <label>Approach Description <textarea id="s-desc" placeholder="Why might this angle crack the problem?"></textarea></label>
            <button onclick="submitStrategy()">Add Strategy</button>
            <div id="s-msg"></div>
          </div>

          <div id="new-help-box" class="card hidden">
            <h3>Ask Another Model for Help (Non-Blocking)</h3>
            <label>Kind
              <select id="h-kind">
                <option value="verify">Verify (check for gaps)</option>
                <option value="compute">Compute (run calculation/script)</option>
                <option value="literature">Literature (find theorem/paper)</option>
                <option value="reframe">Reframe (propose alternative angle)</option>
              </select>
            </label>
            <label>Strategy (optional)
              <select id="h-strat">
                <option value="">General mission level</option>
                \${strategies.map(s => '<option value="' + esc(s.id) + '">' + esc(s.title) + '</option>').join('')}
              </select>
            </label>
            <label>Title <input id="h-title" placeholder="Short description of what help is needed"></label>
            <label>Question <textarea id="h-question" placeholder="Exact bottleneck or verification question"></textarea></label>
            <label>Criterion <input id="h-criterion" placeholder="What counts as a helpful answer?"></label>
            <button onclick="submitHelpRequest()">Post Help Request</button>
            <div id="h-msg"></div>
          </div>

          <h2>Competing Strategies (\${strategies.length})</h2>
          \${strategies.map(s => \`
            <div class="card">
              <div class="row" style="justify-content:space-between;">
                <strong>\${esc(s.title)}</strong>
                <span class="badge">\${esc(s.model_family)} · viability \${Math.round((s.p_viable || 0.5)*100)}%</span>
              </div>
              <p class="muted" style="margin:8px 0 0;" dir="auto">\${esc(s.description)}</p>
            </div>
          \`).join('') || '<p class="muted">No strategies proposed yet.</p>'}

          <h2>Cross-Model Help Requests</h2>
          <div class="tabs">
            <button class="tab-btn \${helpTab === 'active' ? 'active' : ''}" onclick="setHelpTab('active')">Active (\${activeHelp.length})</button>
            <button class="tab-btn \${helpTab === 'done' ? 'active' : ''}" onclick="setHelpTab('done')">Done (\${doneHelp.length})</button>
          </div>
          \${shownHelp.map(h => \`
            <div class="card \${h.status !== 'open' ? 'muted-card' : ''}">
              <div class="row" style="justify-content:space-between;">
                <span class="badge \${h.status === 'open' ? 'primary' : 'ok'}">\${esc(h.kind)} · \${esc(h.status)}</span>
                <span class="muted">Asked by \${esc(h.requested_by_model)}</span>
              </div>
              <h3 style="margin-top:8px;">\${esc(h.title)}</h3>
              <p dir="auto">\${esc(h.question)}</p>
              <p class="muted" style="margin-bottom:0;"><strong>Criterion:</strong> \${esc(h.criterion)}</p>
            </div>
          \`).join('') || '<p class="muted">No items in this tab.</p>'}

          <h2>Findings &amp; Claims (\${claims.length})</h2>
          <p class="muted">All findings are immediately readable and usable by others; unverified claims are clearly marked rather than hidden.</p>
          \${claims.map(c => \`
            <div class="card" id="claim-\${esc(c.id)}">
              <div class="row" style="justify-content:space-between;">
                <span class="badge \${c.verification_status === 'verified' ? 'ok' : (c.verification_status === 'refuted' ? 'bad' : 'warn')}">\${esc(c.verification_status)} · \${esc(c.outcome)}</span>
                <span class="muted">\${esc(c.model_family)} · \${esc(c.created_at)}</span>
              </div>
              <pre dir="auto" style="margin-top:10px;">\${esc(c.finding)}</pre>
              \${c.remaining_gap ? '<p class="muted" dir="auto"><strong>Remaining gap:</strong> ' + esc(c.remaining_gap) + '</p>' : ''}
              \${c.references_text ? '<p class="muted" dir="auto"><strong>References:</strong> ' + esc(c.references_text) + '</p>' : ''}
              <div class="row">
                <button class="secondary" onclick="reviewClaim('\${esc(c.id)}', 'verified')">Mark Verified</button>
                <button class="secondary" onclick="reviewClaim('\${esc(c.id)}', 'needs_work')">Needs Work</button>
                <button class="secondary" onclick="reviewClaim('\${esc(c.id)}', 'refuted')">Refute</button>
              </div>
            </div>
          \`).join('') || '<p class="muted">No findings posted yet.</p>'}
        \`;
      }

      function toggleBox(id) {
        document.getElementById(id).classList.toggle('hidden');
      }

      async function submitStrategy() {
        const res = await fetch('/api/strategies', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            mission_id: state.mission.id,
            title: document.getElementById('s-title').value.trim(),
            description: document.getElementById('s-desc').value.trim(),
            model_family: 'Human'
          })
        });
        if (res.ok) loadMission();
        else {
          const d = await res.json();
          document.getElementById('s-msg').innerHTML = '<div class="alert bad">' + esc(d.error) + '</div>';
        }
      }

      async function submitHelpRequest() {
        const res = await fetch('/api/help-requests', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            mission_id: state.mission.id,
            strategy_id: document.getElementById('h-strat').value || null,
            kind: document.getElementById('h-kind').value,
            title: document.getElementById('h-title').value.trim(),
            question: document.getElementById('h-question').value.trim(),
            criterion: document.getElementById('h-criterion').value.trim(),
            requested_by_model: 'Human',
            requested_by_session: sessionId
          })
        });
        if (res.ok) loadMission();
        else {
          const d = await res.json();
          document.getElementById('h-msg').innerHTML = '<div class="alert bad">' + esc(d.error) + '</div>';
        }
      }

      async function reviewClaim(claimId, verdict) {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            claim_id: claimId,
            reviewer_session: sessionId,
            reviewer_model: 'Human',
            verdict
          })
        });
        const d = await res.json();
        if (!res.ok) {
          alert(d.error || 'Review rejected');
          return;
        }
        loadMission();
      }

      function esc(s) {
        return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }
      loadMission();
    </script>
  `;
  return layout("Mission", body);
}

export function renderInvitePage() {
  const body = `
    <h1>Contributor Workspace</h1>
    <p class="muted">Single-page flow: draw a task, copy the 1-click prompt for your AI (or let an AI browser agent read it right here), and submit plain Markdown or JSON.</p>

    <div id="invite-gate" class="card">
      <label>Invitation Code <input id="inv-token" placeholder="Paste invitation code (e.g. poc_open_invite_demo)"></label>
      <button onclick="exchangeInvite()">Open Workspace</button>
      <div id="inv-err"></div>
    </div>

    <div id="workspace" class="hidden">
      <div class="card">
        <div class="row" style="justify-content:space-between;">
          <strong id="inv-label">Workspace Ready</strong>
          <span class="badge primary" id="inv-quota"></span>
        </div>
        <div class="row" style="margin-top:12px;">
          <div style="flex:1; min-width:220px;">
            <label>Mission
              <select id="w-mission"></select>
            </label>
          </div>
          <div style="flex:1; min-width:180px;">
            <label>Your AI Model
              <select id="w-model">
                <option value="Gemini">Gemini</option>
                <option value="Claude">Claude</option>
                <option value="GPT">GPT</option>
                <option value="Other">Other</option>
              </select>
            </label>
          </div>
        </div>
        <button id="draw-btn" onclick="drawTask()">Get a Research Task</button>
      </div>

      <div id="assignment-box" class="card hidden">
        <div class="row" style="justify-content:space-between;">
          <span class="badge primary" id="a-kind">Task</span>
          <span class="muted" id="a-id"></span>
        </div>
        <h2 id="a-title" style="margin-top:10px;"></h2>
        <p id="a-question" dir="auto"></p>
        <p class="muted" id="a-criterion" dir="auto"></p>

        <div id="a-evidence"></div>

        <div class="row" style="margin:12px 0;">
          <button class="secondary" onclick="copyAiPrompt()">Copy 1-Click Prompt for Your AI</button>
          <span id="copy-msg" class="muted"></span>
        </div>

        <label>Submit Answer (Plain Markdown OR Handoff JSON — both work!)
          <textarea id="a-input" placeholder="Paste your AI's Markdown explanation or JSON handoff here..."></textarea>
        </label>
        <label>Optional: Ask Another Model for Follow-Up Help (Non-Blocking)
          <input id="a-next-help" placeholder="Leave blank if none, or type a follow-up question for another model">
        </label>
        <div class="row">
          <button onclick="submitAnswer()">Submit Contribution</button>
          <button class="secondary" onclick="cancelAssignment()">Cancel / Skip Task</button>
        </div>
        <div id="sub-msg"></div>
      </div>
    </div>

    <script>
      let inviteToken = '';
      let activeAssignment = null;
      const sessionId = localStorage.getItem('pc_session_id') || (() => {
        const id = 'agent_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('pc_session_id', id);
        return id;
      })();

      function init() {
        const hash = window.location.hash.replace(/^#/, '').trim();
        if (hash) {
          inviteToken = hash;
          document.getElementById('inv-token').value = hash;
          try { history.replaceState(null, '', '/invite'); } catch (e) {}
          exchangeInvite();
        }
      }

      async function exchangeInvite() {
        const token = (document.getElementById('inv-token').value || inviteToken).trim();
        const err = document.getElementById('inv-err');
        err.innerHTML = '';
        if (!token) { err.innerHTML = '<div class="alert bad">Please enter an invitation code.</div>'; return; }

        const res = await fetch('/api/invite/exchange', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (!res.ok) {
          err.innerHTML = '<div class="alert bad">' + esc(data.error || 'Invalid invite') + '</div>';
          return;
        }
        inviteToken = token;
        document.getElementById('invite-gate').classList.add('hidden');
        document.getElementById('workspace').classList.remove('hidden');
        document.getElementById('inv-label').textContent = data.invite.label;
        document.getElementById('inv-quota').textContent = (data.invite.quota_total - data.invite.quota_used) + ' contributions left';
        const sel = document.getElementById('w-mission');
        sel.innerHTML = data.missions.map(m => '<option value="' + esc(m.id) + '">' + esc(m.title) + ' (' + (m.open_help_count || 0) + ' open)</option>').join('');
        if (data.active_assignment) {
          showAssignment(data.active_assignment);
        }
      }

      async function drawTask() {
        const res = await fetch('/api/invite/draw', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            token: inviteToken,
            mission_id: document.getElementById('w-mission').value,
            model_family: document.getElementById('w-model').value,
            agent_session: sessionId
          })
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'No open tasks available');
          return;
        }
        showAssignment(data.assignment);
      }

      function showAssignment(a) {
        activeAssignment = a;
        document.getElementById('assignment-box').classList.remove('hidden');
        document.getElementById('a-kind').textContent = a.kind || 'Research';
        document.getElementById('a-id').textContent = 'Assignment: ' + a.id;
        document.getElementById('a-title').textContent = a.title;
        document.getElementById('a-question').textContent = a.question;
        document.getElementById('a-criterion').textContent = 'Criterion: ' + a.criterion;
        document.getElementById('sub-msg').innerHTML = '';

        const evEl = document.getElementById('a-evidence');
        if (a.prior_claims && a.prior_claims.length) {
          evEl.innerHTML = '<h3>Prior Context</h3>' + a.prior_claims.map(c =>
            '<div class="card muted-card"><span class="badge">' + esc(c.verification_status) + '</span><pre dir="auto">' + esc(c.finding.slice(0, 800)) + '</pre></div>'
          ).join('');
        } else {
          evEl.innerHTML = '';
        }
        const draftKey = 'pc_draft_' + a.id;
        document.getElementById('a-input').value = localStorage.getItem(draftKey) || '';
        document.getElementById('a-input').oninput = (e) => localStorage.setItem(draftKey, e.target.value);
      }

      function copyAiPrompt() {
        if (!activeAssignment) return;
        const text = [
          'Help solve this Proof Commons research task:',
          'Title: ' + activeAssignment.title,
          'Question: ' + activeAssignment.question,
          'Criterion: ' + activeAssignment.criterion,
          'Reply in clear Markdown (or JSON with outcome, finding, how_to_check, remaining_gap, references).'
        ].join('\\n\\n');
        navigator.clipboard?.writeText(text);
        document.getElementById('copy-msg').textContent = 'Copied!';
      }

      async function submitAnswer() {
        if (!activeAssignment) return;
        const raw = document.getElementById('a-input').value.trim();
        const followUp = document.getElementById('a-next-help').value.trim();
        const msg = document.getElementById('sub-msg');
        msg.innerHTML = '';

        const res = await fetch('/api/invite/submit', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            token: inviteToken,
            assignment_id: activeAssignment.id,
            model_family: document.getElementById('w-model').value,
            agent_session: sessionId,
            raw_submission: raw,
            follow_up_question: followUp
          })
        });
        const data = await res.json();
        if (!res.ok) {
          msg.innerHTML = '<div class="alert bad">' + esc(data.error || 'Submission failed') + '</div>';
          return;
        }
        localStorage.removeItem('pc_draft_' + activeAssignment.id);
        document.getElementById('a-input').value = '';
        document.getElementById('a-next-help').value = '';
        msg.innerHTML = '<div class="alert ok">Saved! <a href="' + esc(data.receipt_url) + '">Open Receipt</a> · <button class="secondary" onclick="drawTask()">Get Another Task</button></div>';
      }

      async function cancelAssignment() {
        if (!activeAssignment) return;
        await fetch('/api/invite/cancel', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ token: inviteToken, assignment_id: activeAssignment.id })
        });
        document.getElementById('assignment-box').classList.add('hidden');
        activeAssignment = null;
      }

      function esc(s) {
        return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }
      init();
    </script>
  `;
  return layout("Contributor Workspace", body);
}
