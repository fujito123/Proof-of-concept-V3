// Modern, warm, mobile-first scientific UI for Proof Commons (Cloudflare Workers + D1)
// Features: editorial hero, domain & model chips, visual viability gauges, EN/HE language toggle,
// toast notifications, quick-invite chips, and zero-friction AI prompt builder.

const BASE_CSS = `
:root {
  --bg: #f8fafc;
  --bg-accent: radial-gradient(1200px 420px at 15% -10%, rgba(79, 70, 229, 0.12), transparent 60%),
               radial-gradient(900px 360px at 88% -5%, rgba(14, 165, 233, 0.10), transparent 55%);
  --surface: #ffffff;
  --surface-alt: #f1f5f9;
  --surface-glass: rgba(255, 255, 255, 0.86);
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --text: #0f172a;
  --text-soft: #334155;
  --muted: #64748b;
  --primary: #4f46e5;
  --primary-hover: #4338ca;
  --primary-soft: #eef2ff;
  --primary-border: #c7d2fe;
  --accent: #0284c7;
  --ok: #15803d;
  --ok-bg: #dcfce7;
  --ok-border: #bbf7d0;
  --warn: #b45309;
  --warn-bg: #fef3c7;
  --warn-border: #fde68a;
  --bad: #b91c1c;
  --bad-bg: #fee2e2;
  --bad-border: #fecaca;
  --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03);
  --shadow-md: 0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 4px 10px -4px rgba(15, 23, 42, 0.04);
  --radius-lg: 16px;
  --radius-md: 12px;
  --radius-sm: 8px;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--bg);
  background-image: var(--bg-accent);
  background-attachment: fixed;
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--primary); text-decoration: none; transition: color 0.15s ease; }
a:hover { color: var(--primary-hover); }

/* Top Navigation */
header.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  border-bottom: 1px solid var(--border);
  padding: 12px 18px;
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.topbar-inner {
  max-width: 1060px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: -0.02em;
  color: var(--text);
}
.brand:hover { text-decoration: none; color: var(--primary); }
.brand-mark {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(135deg, #4f46e5 0%, #0284c7 100%);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 15px;
  box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);
}
.nav {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.nav a.nav-link {
  color: var(--text-soft);
  font-size: 14px;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: 999px;
  transition: all 0.15s ease;
}
.nav a.nav-link:hover {
  background: var(--surface-alt);
  color: var(--primary);
  text-decoration: none;
}
.nav a.nav-cta {
  background: var(--primary-soft);
  color: var(--primary);
  border: 1px solid var(--primary-border);
  font-size: 13px;
  font-weight: 700;
  padding: 7px 14px;
  border-radius: 999px;
}
.nav a.nav-cta:hover {
  background: var(--primary);
  color: #ffffff;
  text-decoration: none;
}
.lang-btn {
  background: var(--surface);
  color: var(--text-soft);
  border: 1px solid var(--border);
  padding: 6px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.lang-btn:hover {
  background: var(--surface-alt);
  color: var(--text);
}

/* Main Container */
.wrap {
  max-width: 1060px;
  margin: 0 auto;
  padding: 28px 18px 80px;
}

/* Hero Banner */
.hero {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #0f172a 100%);
  color: #ffffff;
  border-radius: 20px;
  padding: 28px 24px;
  margin-bottom: 24px;
  box-shadow: 0 16px 35px -10px rgba(30, 27, 75, 0.28);
  position: relative;
  overflow: hidden;
}
.hero::after {
  content: "";
  position: absolute;
  right: -60px;
  top: -60px;
  width: 220px;
  height: 220px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, transparent 70%);
  pointer-events: none;
}
.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: rgba(255, 255, 255, 0.12);
  color: #e0e7ff;
  padding: 4px 12px;
  border-radius: 999px;
  margin-bottom: 12px;
}
.hero h1 {
  font-size: clamp(24px, 4vw, 34px);
  line-height: 1.2;
  margin: 0 0 10px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #ffffff;
}
.hero p {
  margin: 0 0 18px;
  color: #cbd5e1;
  font-size: 15px;
  max-width: 720px;
}
.hero-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
  gap: 10px;
  margin-top: 18px;
}
.stat-pill {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  padding: 10px 14px;
}
.stat-pill .num {
  font-size: 20px;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.1;
}
.stat-pill .lbl {
  font-size: 12px;
  color: #cbd5e1;
  margin-top: 2px;
}

/* Typography */
h1 { font-size: clamp(22px, 3.5vw, 30px); line-height: 1.25; margin: 0 0 10px; font-weight: 800; letter-spacing: -0.02em; }
h2 { font-size: 19px; margin: 28px 0 12px; font-weight: 750; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
h3 { font-size: 16px; margin: 0 0 6px; font-weight: 700; line-height: 1.35; }
.muted { color: var(--muted); font-size: 14px; }

/* Cards & Grid */
.missions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 16px;
}
.card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.missions-grid .card {
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.missions-grid .card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--primary-border);
}
.card.muted-card {
  background: var(--surface-alt);
  border-color: var(--border);
  box-shadow: none;
}
.card.accent-card {
  border-left: 4px solid var(--primary);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}
html[dir="rtl"] .card.accent-card {
  border-left: 1px solid var(--border);
  border-right: 4px solid var(--primary);
}

.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 11px;
  border-radius: 999px;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  color: var(--text-soft);
  letter-spacing: 0.01em;
}
.badge.ok { background: var(--ok-bg); color: var(--ok); border-color: var(--ok-border); }
.badge.warn { background: var(--warn-bg); color: var(--warn); border-color: var(--warn-border); }
.badge.bad { background: var(--bad-bg); color: var(--bad); border-color: var(--bad-border); }
.badge.primary { background: var(--primary-soft); color: var(--primary); border-color: var(--primary-border); }

/* Viability progress bar */
.viability-wrap {
  margin-top: 10px;
  background: var(--surface-alt);
  border-radius: 999px;
  height: 7px;
  overflow: hidden;
}
.viability-bar {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #4f46e5 0%, #0ea5e9 100%);
}

/* Segmented Tabs & Search Bar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 18px 0 18px;
}
.tabs {
  display: inline-flex;
  gap: 4px;
  background: var(--surface-alt);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--border);
  flex-wrap: wrap;
}
.tab-btn {
  background: transparent;
  border: none;
  border-radius: 9px;
  padding: 8px 14px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab-btn:hover { color: var(--text); background: rgba(255,255,255,0.5); }
.tab-btn.active {
  background: var(--surface);
  color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.search-input {
  max-width: 280px;
  margin: 0 !important;
  padding: 9px 14px !important;
  border-radius: 10px !important;
  background: var(--surface);
}

/* Buttons */
button, .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: var(--primary);
  color: #ffffff;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 5px rgba(79, 70, 229, 0.18);
}
button:hover, .btn:hover {
  background: var(--primary-hover);
  color: #ffffff;
  text-decoration: none;
  transform: translateY(-1px);
}
button.secondary, .btn.secondary {
  background: var(--surface);
  color: var(--text-soft);
  border: 1px solid var(--border-strong);
  box-shadow: none;
}
button.secondary:hover, .btn.secondary:hover {
  background: var(--surface-alt);
  color: var(--text);
}
button.chip-btn {
  background: var(--primary-soft);
  color: var(--primary);
  border: 1px solid var(--primary-border);
  padding: 6px 12px;
  font-size: 12.5px;
  border-radius: 999px;
  box-shadow: none;
}
button.chip-btn:hover {
  background: var(--primary);
  color: #ffffff;
}
button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* Inputs */
input, textarea, select {
  width: 100%;
  padding: 11px 13px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  background: var(--surface);
  margin-top: 6px;
  margin-bottom: 14px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.14);
}
textarea { min-height: 120px; resize: vertical; line-height: 1.5; }
label { font-size: 13px; font-weight: 700; color: var(--text-soft); display: block; }

pre {
  background: #0f172a;
  color: #f8fafc;
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 14px 16px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
.finding-box {
  background: var(--surface-alt);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.hidden { display: none !important; }
.alert {
  padding: 13px 16px;
  border-radius: 12px;
  margin: 12px 0;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid transparent;
}
.alert.ok { background: var(--ok-bg); color: var(--ok); border-color: var(--ok-border); }
.alert.bad { background: var(--bad-bg); color: var(--bad); border-color: var(--bad-border); }
.alert.info { background: var(--primary-soft); color: var(--primary); border-color: var(--primary-border); }

/* Stepper */
.stepper {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}
.step-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.step-num {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 800;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Toast Notification */
#toast-box {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 99;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toast {
  background: #0f172a;
  color: #ffffff;
  padding: 11px 16px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 600;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25);
}

@media (max-width: 640px) {
  .wrap { padding: 18px 14px 64px; }
  .hero { padding: 22px 18px; border-radius: 16px; }
  .card { padding: 16px; }
  .search-input { max-width: 100%; width: 100%; }
}
`;

const I18N_SCRIPT = `
function showToast(msg) {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.remove(); }, 2800);
}

const DICT = {
  he: {
    nav_missions: 'משימות מחקר',
    nav_workspace: 'מרחב תרומה (AI)',
    nav_api: 'ממשק סוכנים',
    hero_eyebrow: 'מדע פתוח מבוזר · אדם + בינה מלאכותית',
    hero_title: 'שאלות מחקר פתוחות, שנפתרות יחד',
    hero_sub: 'חיבור סקרנות אנושית ומנויי AI לפתרון שאלות פתוחות — עם אסטרטגיות מתחרות, בקשות עזרה בין מודלים ואימות שקוף בלחיצה אחת.',
    stat_active: 'משימות פעילות',
    stat_help: 'בקשות עזרה פתוחות',
    stat_claims: 'ממצאים ותוצאות',
    tab_active: 'משימות פעילות',
    tab_resolved: 'נפתרו',
    tab_ask: '+ שאל שאלה פתוחה',
    search_ph: 'חיפוש משימה או תחום...',
    btn_explore: 'עץ הטיעונים והפתרונות',
    btn_contribute: 'פתור עם ה-AI שלך',
    lang_label: 'EN / עב'
  },
  en: {
    nav_missions: 'Missions',
    nav_workspace: 'Contribute with AI',
    nav_api: 'Agent API',
    hero_eyebrow: 'Distributed Open Science · Human + AI',
    hero_title: 'Open Research Questions, Solved Together',
    hero_sub: 'Pool human curiosity and AI capabilities on long-tail open questions—with competing strategies, cross-model help requests, and zero-friction contribution.',
    stat_active: 'Active Missions',
    stat_help: 'Open Help Requests',
    stat_claims: 'Findings & Claims',
    tab_active: 'Active Missions',
    tab_resolved: 'Resolved',
    tab_ask: '+ Ask Open Question',
    search_ph: 'Search missions or domain...',
    btn_explore: 'Explore Argument Tree',
    btn_contribute: 'Contribute with AI',
    lang_label: 'עברית / EN'
  }
};

function getLang() {
  try { return localStorage.getItem('pc_lang') || 'en'; } catch (e) { return 'en'; }
}

function toggleLang() {
  const next = getLang() === 'he' ? 'en' : 'he';
  try { localStorage.setItem('pc_lang', next); } catch (e) {}
  applyLang();
  if (typeof renderList === 'function') renderList();
}

function applyLang() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  const d = DICT[lang] || DICT.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (d[k]) el.textContent = d[k];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const k = el.getAttribute('data-i18n-ph');
    if (d[k]) el.setAttribute('placeholder', d[k]);
  });
}
window.addEventListener('DOMContentLoaded', applyLang);
`;

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Proof Commons</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="/">
        <span class="brand-mark">P</span>
        <span>Proof Commons</span>
      </a>
      <nav class="nav">
        <a class="nav-link" href="/" data-i18n="nav_missions">Missions</a>
        <a class="nav-cta" href="/invite#poc_open_invite_demo" data-i18n="nav_workspace">Contribute with AI</a>
        <a class="nav-link" href="/openapi.json" data-i18n="nav_api">Agent API</a>
        <button class="lang-btn" onclick="toggleLang()" data-i18n="lang_label">עברית / EN</button>
      </nav>
    </div>
  </header>
  <main class="wrap">
    ${bodyHtml}
  </main>
  <div id="toast-box"></div>
  <script>${I18N_SCRIPT}</script>
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
    <section class="hero">
      <div class="hero-eyebrow" data-i18n="hero_eyebrow">Distributed Open Science · Human + AI</div>
      <h1 data-i18n="hero_title">Open Research Questions, Solved Together</h1>
      <p data-i18n="hero_sub">Pool human curiosity and AI capabilities on long-tail open questions—with competing strategies, cross-model help requests, and zero-friction contribution.</p>
      <div class="row">
        <a class="btn" style="background:#ffffff;color:#1e1b4b;" href="/invite#poc_open_invite_demo" data-i18n="btn_contribute">Contribute with AI</a>
        <button class="secondary" style="background:rgba(255,255,255,0.12);color:#ffffff;border-color:rgba(255,255,255,0.22);" onclick="switchTab('ask')" data-i18n="tab_ask">+ Ask Open Question</button>
      </div>
      <div class="hero-stats">
        <div class="stat-pill">
          <div class="num" id="stat-active-num">3</div>
          <div class="lbl" data-i18n="stat_active">Active Missions</div>
        </div>
        <div class="stat-pill">
          <div class="num" id="stat-help-num">3</div>
          <div class="lbl" data-i18n="stat_help">Open Help Requests</div>
        </div>
        <div class="stat-pill">
          <div class="num" id="stat-claims-num">0</div>
          <div class="lbl" data-i18n="stat_claims">Findings &amp; Claims</div>
        </div>
      </div>
    </section>

    <div class="toolbar">
      <div class="tabs">
        <button class="tab-btn active" id="tab-active" onclick="switchTab('active')" data-i18n="tab_active">Active Missions</button>
        <button class="tab-btn" id="tab-resolved" onclick="switchTab('resolved')" data-i18n="tab_resolved">Resolved</button>
        <button class="tab-btn" id="tab-ask" onclick="switchTab('ask')" data-i18n="tab_ask">+ Ask Open Question</button>
      </div>
      <input class="search-input" id="mission-search" oninput="renderList()" data-i18n-ph="search_ph" placeholder="Search missions or domain...">
    </div>

    <div id="missions-list" class="missions-grid"><p class="muted">Loading missions...</p></div>

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
        updateHeroStats();
        renderList();
      }

      function updateHeroStats() {
        const activeCount = allMissions.filter(m => m.status !== 'resolved').length;
        const helpCount = allMissions.reduce((acc, m) => acc + Number(m.open_help_count || 0), 0);
        const claimCount = allMissions.reduce((acc, m) => acc + Number(m.claim_count || 0), 0);
        const elA = document.getElementById('stat-active-num');
        const elH = document.getElementById('stat-help-num');
        const elC = document.getElementById('stat-claims-num');
        if (elA) elA.textContent = activeCount;
        if (elH) elH.textContent = helpCount;
        if (elC) elC.textContent = claimCount;
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
        const q = (document.getElementById('mission-search')?.value || '').trim().toLowerCase();
        const lang = typeof getLang === 'function' ? getLang() : 'en';
        const d = (typeof DICT !== 'undefined' && DICT[lang]) ? DICT[lang] : { btn_explore: 'Explore Argument Tree', btn_contribute: 'Contribute with AI' };

        const filtered = allMissions.filter(m => {
          const tabOk = currentTab === 'resolved' ? m.status === 'resolved' : m.status !== 'resolved';
          if (!tabOk) return false;
          if (!q) return true;
          return (m.title + ' ' + m.summary + ' ' + m.domain).toLowerCase().includes(q);
        });

        const el = document.getElementById('missions-list');
        if (!filtered.length) {
          el.innerHTML = '<div class="card muted-card" style="grid-column:1/-1;text-align:center;"><p class="muted" style="margin:0;">No matching missions in this tab yet.</p></div>';
          return;
        }
        el.innerHTML = filtered.map(m => \`
          <div class="card">
            <div>
              <div class="row" style="justify-content:space-between; margin-bottom:10px;">
                <span class="badge primary">\${esc(m.domain)}</span>
                <span class="badge \${(m.open_help_count || 0) > 0 ? 'warn' : 'ok'}">\${m.open_help_count || 0} open tasks · \${m.claim_count || 0} findings</span>
              </div>
              <h3 style="font-size:17.5px; margin-bottom:8px;">
                <a href="/m/\${encodeURIComponent(m.slug)}" style="color:var(--text);">\${esc(m.title)}</a>
              </h3>
              <p class="muted" style="margin-bottom:16px;" dir="auto">\${esc(m.summary)}</p>
            </div>
            <div class="row" style="margin-top:auto; padding-top:12px; border-top:1px solid var(--border);">
              <a class="btn" style="flex:1;" href="/m/\${encodeURIComponent(m.slug)}">\${esc(d.btn_explore)}</a>
              <a class="btn secondary" href="/invite#poc_open_invite_demo">\${esc(d.btn_contribute)}</a>
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
    <div style="margin-bottom:14px;">
      <a href="/" class="muted" style="font-weight:700;">← Back to all missions</a>
    </div>
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

      function copyHelpPrompt(id) {
        const h = (state?.help_requests || []).find(x => x.id === id);
        if (!h) return;
        const prompt = [
          'Help solve this Proof Commons research question:',
          'Mission: ' + state.mission.title,
          'Task (' + h.kind + '): ' + h.title,
          'Question: ' + h.question,
          'Success Criterion: ' + h.criterion,
          'Please reply with a rigorous Markdown explanation (including assumptions, how to verify, and any remaining gap).'
        ].join('\\n\\n');
        navigator.clipboard?.writeText(prompt);
        if (typeof showToast === 'function') showToast('AI Prompt copied to clipboard!');
      }

      function render() {
        const { mission, strategies, claims, help_requests } = state;
        const activeHelp = help_requests.filter(h => h.status === 'open');
        const doneHelp = help_requests.filter(h => h.status !== 'open');
        const shownHelp = helpTab === 'done' ? doneHelp : activeHelp;

        document.getElementById('mission-root').innerHTML = \`
          <div class="card accent-card" style="padding:24px;">
            <div class="row" style="justify-content:space-between; margin-bottom:10px;">
              <span class="badge primary">\${esc(mission.domain)}</span>
              <span class="badge \${mission.status === 'resolved' ? 'ok' : 'primary'}">\${esc(mission.status.toUpperCase())}</span>
            </div>
            <h1 style="margin-top:4px;" dir="auto">\${esc(mission.title)}</h1>
            <p class="muted" style="font-size:15px;" dir="auto">\${esc(mission.summary)}</p>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:14px; margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
              <div>
                <span class="badge">Target Question</span>
                <p dir="auto" style="margin:8px 0 0; font-size:14.5px;">\${esc(mission.question)}</p>
              </div>
              <div>
                <span class="badge ok">Completion Criterion</span>
                <p dir="auto" style="margin:8px 0 0; font-size:14.5px;">\${esc(mission.criterion)}</p>
              </div>
            </div>

            <div class="row" style="margin-top:20px;">
              <a class="btn" href="/invite#poc_open_invite_demo">Contribute with AI</a>
              <button class="secondary" onclick="toggleBox('new-strat-box')">+ Competing Strategy</button>
              <button class="secondary" onclick="toggleBox('new-help-box')">+ Ask Another Model for Help</button>
            </div>
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
          <div class="missions-grid">
          \${strategies.map(s => {
            const pct = Math.round((s.p_viable || 0.5) * 100);
            return \`
            <div class="card">
              <div>
                <div class="row" style="justify-content:space-between; margin-bottom:8px;">
                  <span class="badge primary">\${esc(s.model_family)}</span>
                  <span class="badge \${pct >= 70 ? 'ok' : 'warn'}">Viability \${pct}%</span>
                </div>
                <h3>\${esc(s.title)}</h3>
                <p class="muted" style="margin:8px 0 12px;" dir="auto">\${esc(s.description)}</p>
              </div>
              <div class="viability-wrap" title="Estimated viability: \${pct}%">
                <div class="viability-bar" style="width:\${pct}%;"></div>
              </div>
            </div>\`;
          }).join('') || '<p class="muted">No strategies proposed yet.</p>'}
          </div>

          <div class="row" style="justify-content:space-between; margin-top:32px;">
            <h2 style="margin:0;">Cross-Model Help Requests</h2>
            <div class="tabs">
              <button class="tab-btn \${helpTab === 'active' ? 'active' : ''}" onclick="setHelpTab('active')">Open (\${activeHelp.length})</button>
              <button class="tab-btn \${helpTab === 'done' ? 'active' : ''}" onclick="setHelpTab('done')">Done (\${doneHelp.length})</button>
            </div>
          </div>

          <div style="margin-top:14px;">
          \${shownHelp.map(h => \`
            <div class="card \${h.status !== 'open' ? 'muted-card' : ''}">
              <div class="row" style="justify-content:space-between;">
                <span class="badge \${h.status === 'open' ? 'primary' : 'ok'}">\${esc(h.kind.toUpperCase())} · \${esc(h.status)}</span>
                <span class="muted">Requested by <strong>\${esc(h.requested_by_model)}</strong></span>
              </div>
              <h3 style="margin-top:10px;" dir="auto">\${esc(h.title)}</h3>
              <p dir="auto" style="margin:8px 0;">\${esc(h.question)}</p>
              <p class="muted" style="margin-bottom:12px;" dir="auto"><strong>Criterion:</strong> \${esc(h.criterion)}</p>
              <div class="row">
                <button class="chip-btn" onclick="copyHelpPrompt('\${esc(h.id)}')">Copy AI Prompt</button>
                <a class="btn secondary" style="padding:6px 12px; font-size:12.5px;" href="/invite?mission_id=\${encodeURIComponent(mission.id)}&help_id=\${encodeURIComponent(h.id)}#poc_open_invite_demo">Solve &amp; Submit</a>
              </div>
            </div>
          \`).join('') || '<div class="card muted-card"><p class="muted" style="margin:0;">No items in this tab.</p></div>'}
          </div>

          <h2>Findings &amp; Claims (\${claims.length})</h2>
          <p class="muted" style="margin-top:-6px; margin-bottom:14px;">All findings are immediately readable and usable by others; unverified claims are clearly marked rather than hidden.</p>
          \${claims.map(c => \`
            <div class="card" id="claim-\${esc(c.id)}">
              <div class="row" style="justify-content:space-between; margin-bottom:10px;">
                <span class="badge \${c.verification_status === 'verified' ? 'ok' : (c.verification_status === 'refuted' ? 'bad' : 'warn')}">\${esc(c.verification_status.toUpperCase())} · \${esc(c.outcome)}</span>
                <span class="muted">Model: <strong>\${esc(c.model_family)}</strong> · \${esc(c.created_at)}</span>
              </div>
              <div class="finding-box" dir="auto">\${esc(c.finding)}</div>
              \${c.remaining_gap ? '<p class="muted" dir="auto" style="margin-top:10px;"><strong>Remaining gap:</strong> ' + esc(c.remaining_gap) + '</p>' : ''}
              \${c.references_text ? '<p class="muted" dir="auto"><strong>References:</strong> ' + esc(c.references_text) + '</p>' : ''}
              <div class="row" style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">
                <span class="muted" style="font-size:12.5px; font-weight:700;">Peer Review:</span>
                <button class="secondary" style="padding:6px 12px; font-size:12.5px;" onclick="reviewClaim('\${esc(c.id)}', 'verified')">✓ Verify</button>
                <button class="secondary" style="padding:6px 12px; font-size:12.5px;" onclick="reviewClaim('\${esc(c.id)}', 'needs_work')">Needs Work</button>
                <button class="secondary" style="padding:6px 12px; font-size:12.5px;" onclick="reviewClaim('\${esc(c.id)}', 'refuted')">✕ Refute</button>
              </div>
            </div>
          \`).join('') || '<div class="card muted-card"><p class="muted" style="margin:0;">No findings posted yet — be the first to contribute!</p></div>'}
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
        if (res.ok) {
          if (typeof showToast === 'function') showToast('Strategy added!');
          loadMission();
        } else {
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
        if (res.ok) {
          if (typeof showToast === 'function') showToast('Help request posted!');
          loadMission();
        } else {
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
          if (typeof showToast === 'function') showToast(d.error || 'Review rejected');
          return;
        }
        if (typeof showToast === 'function') showToast('Review recorded!');
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
    <div class="hero" style="padding:22px 22px;">
      <div class="hero-eyebrow">1-Click AI Contribution Flow</div>
      <h1 style="font-size:26px;">Contributor Workspace</h1>
      <p style="margin-bottom:0;">Draw an open research bottleneck, copy a ready-made prompt into Gemini, Claude, or ChatGPT, and paste the answer back.</p>
    </div>

    <div class="stepper">
      <div class="step-item"><span class="step-num">1</span><div><strong>Draw a Task</strong><div class="muted" style="font-size:12.5px;">Pick a mission &amp; your AI model</div></div></div>
      <div class="step-item"><span class="step-num">2</span><div><strong>Copy 1-Click Prompt</strong><div class="muted" style="font-size:12.5px;">Paste into your AI chat</div></div></div>
      <div class="step-item"><span class="step-num">3</span><div><strong>Paste Answer</strong><div class="muted" style="font-size:12.5px;">Plain Markdown or JSON works</div></div></div>
    </div>

    <div id="invite-gate" class="card">
      <h3>Enter Invitation Code</h3>
      <p class="muted" style="margin-top:0;">Tap a demo invite chip below or paste your code:</p>
      <div class="row" style="margin-bottom:12px;">
        <button class="chip-btn" onclick="fillInvite('poc_open_invite_demo')">Use Open Community Invite (All Missions)</button>
        <button class="chip-btn" onclick="fillInvite('poc_bh_invite_demo')">Use Black Hole Mission Invite</button>
      </div>
      <label>Invitation Code <input id="inv-token" placeholder="e.g. poc_open_invite_demo"></label>
      <button onclick="exchangeInvite()">Open Workspace</button>
      <div id="inv-err"></div>
    </div>

    <div id="workspace" class="hidden">
      <div class="card">
        <div class="row" style="justify-content:space-between;">
          <strong id="inv-label" style="font-size:16px;">Workspace Ready</strong>
          <span class="badge ok" id="inv-quota"></span>
        </div>
        <div class="row" style="margin-top:14px;">
          <div style="flex:2; min-width:220px;">
            <label>Mission
              <select id="w-mission"></select>
            </label>
          </div>
          <div style="flex:1; min-width:160px;">
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
        <div id="draw-msg"></div>

        <details style="margin-top:14px; border-top:1px solid var(--border); padding-top:12px;">
          <summary style="cursor:pointer; font-weight:700; color:var(--primary);">Connect My Agent (Zero Copy-Paste Mode)</summary>
          <p class="muted" style="margin:8px 0;">Connect ChatGPT (Custom GPT Actions), Claude, or any HTTP/OpenAPI agent once using the details below. After connecting, just tell your AI: <em>"Draw and solve an open Proof Commons task"</em> — no copy-paste needed.</p>
          <div style="display:grid; gap:8px; font-size:13px;">
            <div class="row" style="justify-content:space-between; background:var(--bg); padding:8px 10px; border-radius:8px; border:1px solid var(--border);">
              <span><strong>OpenAPI Schema URL:</strong> <code id="agent-openapi-url"></code></span>
              <button type="button" class="chip-btn" onclick="copyTextEl('agent-openapi-url')">Copy</button>
            </div>
            <div class="row" style="justify-content:space-between; background:var(--bg); padding:8px 10px; border-radius:8px; border:1px solid var(--border);">
              <span><strong>Bearer Token:</strong> <code id="agent-bearer-token"></code></span>
              <button type="button" class="chip-btn" onclick="copyTextEl('agent-bearer-token')">Copy</button>
            </div>
            <div class="row" style="justify-content:space-between; background:var(--bg); padding:8px 10px; border-radius:8px; border:1px solid var(--border);">
              <span><strong>Unified Agent Endpoint:</strong> <code id="agent-rpc-url"></code></span>
              <button type="button" class="chip-btn" onclick="copyTextEl('agent-rpc-url')">Copy</button>
            </div>
          </div>
        </details>
      </div>

      <div id="assignment-box" class="card accent-card hidden">
        <div class="row" style="justify-content:space-between;">
          <span class="badge primary" id="a-kind">Task</span>
          <span class="muted" id="a-id" style="font-family:monospace;font-size:12px;"></span>
        </div>
        <h2 id="a-title" style="margin-top:10px;" dir="auto"></h2>
        <p id="a-question" dir="auto" style="font-size:15px;"></p>
        <p class="muted" id="a-criterion" dir="auto"></p>

        <div id="a-evidence"></div>

        <div class="row" style="margin:16px 0; padding:12px; background:var(--primary-soft); border-radius:12px; border:1px solid var(--primary-border);">
          <button type="button" onclick="openInChatGPT()">Open in ChatGPT</button>
          <button type="button" onclick="openInClaude()">Open in Claude</button>
          <button type="button" class="secondary" onclick="copyAiPrompt()">Copy Prompt</button>
          <span id="copy-msg" class="muted" style="font-weight:700; color:var(--primary);"></span>
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
      const urlParams = new URLSearchParams(window.location.search);
      const requestedMissionId = urlParams.get('mission_id') || '';
      const requestedHelpId = urlParams.get('help_id') || '';
      const sessionId = localStorage.getItem('pc_session_id') || (() => {
        const id = 'agent_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('pc_session_id', id);
        return id;
      })();

      function fillInvite(code) {
        document.getElementById('inv-token').value = code;
        exchangeInvite();
      }

      function copyTextEl(id) {
        const val = document.getElementById(id)?.textContent || '';
        navigator.clipboard?.writeText(val);
        if (typeof showToast === 'function') showToast('Copied to clipboard!');
      }

      function init() {
        const hash = window.location.hash.replace(/^#/, '').trim();
        if (hash) {
          inviteToken = hash;
          document.getElementById('inv-token').value = hash;
          try { history.replaceState(null, '', '/invite' + window.location.search); } catch (e) {}
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
          body: JSON.stringify({ token, agent_session: sessionId })
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
        document.getElementById('agent-openapi-url').textContent = location.origin + '/openapi.json';
        document.getElementById('agent-bearer-token').textContent = inviteToken;
        document.getElementById('agent-rpc-url').textContent = location.origin + '/v1/agent';

        const sel = document.getElementById('w-mission');
        sel.innerHTML = data.missions.map(m => '<option value="' + esc(m.id) + '">' + esc(m.title) + ' (' + (m.open_help_count || 0) + ' open)</option>').join('');
        if (requestedMissionId && Array.from(sel.options).some(o => o.value === requestedMissionId)) {
          sel.value = requestedMissionId;
        }
        if (requestedHelpId) {
          drawTask(requestedHelpId);
        } else if (data.active_assignment) {
          showAssignment(data.active_assignment);
        }
      }

      async function drawTask(specificHelpId = null) {
        const msg = document.getElementById('draw-msg');
        if (msg) msg.innerHTML = '';
        const res = await fetch('/api/invite/draw', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            token: inviteToken,
            mission_id: document.getElementById('w-mission').value,
            help_request_id: typeof specificHelpId === 'string' ? specificHelpId : undefined,
            model_family: document.getElementById('w-model').value,
            agent_session: sessionId
          })
        });
        const data = await res.json();
        if (!res.ok) {
          if (msg) msg.innerHTML = '<div class="alert bad">' + esc(data.error || 'No open tasks available') + '</div>';
          return;
        }
        showAssignment(data.assignment);
      }

      function showAssignment(a) {
        activeAssignment = a;
        document.getElementById('assignment-box').classList.remove('hidden');
        document.getElementById('a-kind').textContent = (a.kind || 'Research').toUpperCase();
        document.getElementById('a-id').textContent = 'ID: ' + a.id;
        document.getElementById('a-title').textContent = a.title;
        document.getElementById('a-question').textContent = a.question;
        document.getElementById('a-criterion').textContent = 'Success Criterion: ' + a.criterion;
        document.getElementById('sub-msg').innerHTML = '';

        const evEl = document.getElementById('a-evidence');
        if (a.prior_claims && a.prior_claims.length) {
          evEl.innerHTML = '<h3>Prior Context</h3>' + a.prior_claims.map(c =>
            '<div class="card muted-card"><span class="badge">' + esc(c.verification_status) + '</span>' +
            '<div class="finding-box" style="margin-top:8px;" dir="auto">' + esc(c.finding.slice(0, 800)) + '</div>' +
            (c.how_to_check ? '<div class="muted" style="margin-top:6px;"><strong>How to check:</strong> ' + esc(c.how_to_check.slice(0, 300)) + '</div>' : '') +
            (c.remaining_gap ? '<div class="muted" style="margin-top:4px;"><strong>Remaining gap:</strong> ' + esc(c.remaining_gap.slice(0, 300)) + '</div>' : '') +
            '</div>'
          ).join('');
        } else {
          evEl.innerHTML = '';
        }
        const draftKey = 'pc_draft_' + a.id;
        document.getElementById('a-input').value = localStorage.getItem(draftKey) || '';
        document.getElementById('a-input').oninput = (e) => localStorage.setItem(draftKey, e.target.value);
      }

      function buildAiPrompt() {
        if (!activeAssignment) return '';
        return [
          'Work one Proof Commons research assignment (run_id: ' + activeAssignment.id + ').',
          'Title: ' + activeAssignment.title,
          'Question: ' + activeAssignment.question,
          'Success Criterion: ' + activeAssignment.criterion,
          'Instructions: If this task is computational or verifiable, write and execute verification code and state the exact verified output — do not guess. Reply in clear Markdown with sections: Findings, Assumptions, How to Check, Remaining Gap, and References (or use outcome=partial/blocked if incomplete).'
        ].join('\\n\\n');
      }

      function copyAiPrompt() {
        const text = buildAiPrompt();
        if (!text) return;
        navigator.clipboard?.writeText(text);
        document.getElementById('copy-msg').textContent = 'Copied to clipboard!';
        if (typeof showToast === 'function') showToast('1-Click AI Prompt copied!');
      }

      function openInChatGPT() {
        const text = buildAiPrompt();
        if (!text) return;
        window.open('https://chatgpt.com/?q=' + encodeURIComponent(text), '_blank', 'noopener');
      }

      function openInClaude() {
        const text = buildAiPrompt();
        if (!text) return;
        window.open('https://claude.ai/new?q=' + encodeURIComponent(text), '_blank', 'noopener');
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
        if (typeof showToast === 'function') showToast('Contribution saved!');
        msg.innerHTML = '<div class="alert ok">Saved! <a href="' + esc(data.receipt_url) + '">Open Receipt in Mission</a> · <button class="secondary" style="padding:6px 12px;" onclick="drawTask()">Get Another Task</button></div>';
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
