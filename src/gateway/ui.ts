/**
 * Embedded Gateway UI assets.
 *
 * Responsibility:
 * - Provide a lightweight, no-build dashboard for provider status and event logs.
 * - Keep deployment simple by serving static HTML/CSS/JS from the gateway process.
 */

export const gatewayUiHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fahrenheit Gateway Ops</title>
    <link rel="stylesheet" href="/ui/app.css" />
  </head>
  <body>
    <div class="bg-grid"></div>
    <main class="layout">
      <header class="topbar panel">
        <div>
          <p class="eyebrow">Fahrenheit Gateway</p>
          <h1>Provider Surface Monitor</h1>
        </div>
        <div class="top-controls">
          <label class="token-input">
            <span>Ingest Token</span>
            <input id="tokenInput" type="password" placeholder="optional bearer token" />
          </label>
          <button id="saveTokenBtn" class="btn">Save</button>
          <button id="refreshBtn" class="btn btn-primary">Refresh</button>
        </div>
      </header>

      <section class="stats">
        <article class="panel stat">
          <p>Events</p>
          <h2 id="eventsCount">-</h2>
        </article>
        <article class="panel stat">
          <p>Providers</p>
          <h2 id="providersCount">-</h2>
        </article>
        <article class="panel stat">
          <p>Conversational</p>
          <h2 id="convCount">-</h2>
        </article>
        <article class="panel stat">
          <p>Observational</p>
          <h2 id="obsCount">-</h2>
        </article>
      </section>

      <section class="panel">
        <div class="section-head">
          <h3>Providers</h3>
          <p>Native + bridge integration readiness</p>
        </div>
        <div id="providersGrid" class="providers-grid"></div>
      </section>

      <section class="panel">
        <div class="section-head">
          <h3>Event Stream</h3>
          <div class="filters">
            <select id="providerFilter">
              <option value="">All providers</option>
            </select>
            <select id="modeFilter">
              <option value="">All modes</option>
              <option value="conversational">Conversational</option>
              <option value="observational">Observational</option>
            </select>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Provider</th>
                <th>Source</th>
                <th>Mode</th>
                <th>Direction</th>
                <th>Sender</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody id="messagesTbody"></tbody>
          </table>
        </div>
      </section>
    </main>

    <script src="/ui/app.js"></script>
  </body>
</html>
`;

export const gatewayUiCss = `:root {
  --bg: #0a0f18;
  --panel: #0f1724;
  --panel-hi: #121f31;
  --line: #223248;
  --muted: #7f95b0;
  --text: #dbe8f8;
  --good: #54e18a;
  --warn: #ff9f50;
  --bad: #ff5f75;
  --accent: #79b8ff;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--text);
  background: radial-gradient(circle at 20% -10%, #1a2b43 0%, var(--bg) 45%),
    radial-gradient(circle at 100% 120%, #14293a 0%, var(--bg) 50%);
  font-family: Inter, "Segoe UI", Roboto, sans-serif;
}

.bg-grid {
  position: fixed;
  inset: 0;
  background-image: linear-gradient(to right, rgba(90, 130, 170, 0.1) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(90, 130, 170, 0.1) 1px, transparent 1px);
  background-size: 54px 54px;
  pointer-events: none;
}

.layout {
  width: min(1400px, 96vw);
  margin: 18px auto 40px;
  display: grid;
  gap: 14px;
}

.panel {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent), var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px;
  backdrop-filter: blur(2px);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 18px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  letter-spacing: 0.12em;
  font-size: 11px;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 22px;
}

h2, h3, p {
  margin: 0;
}

.top-controls {
  display: flex;
  align-items: end;
  gap: 8px;
}

.token-input {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

input, select, .btn {
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--panel-hi);
  color: var(--text);
  padding: 0 10px;
}

.btn {
  cursor: pointer;
}

.btn:hover {
  filter: brightness(1.08);
}

.btn-primary {
  border-color: #2f6bb1;
  background: linear-gradient(180deg, #2c5f99, #244d7f);
}

.stats {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.stat p {
  color: var(--muted);
  font-size: 13px;
}

.stat h2 {
  margin-top: 6px;
  font-size: 28px;
  letter-spacing: 0.03em;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.section-head p {
  color: var(--muted);
  font-size: 13px;
}

.filters {
  display: flex;
  gap: 8px;
}

.providers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}

.provider-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #0d1626;
  padding: 10px;
  display: grid;
  gap: 10px;
}

.provider-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.dot.good { background: var(--good); box-shadow: 0 0 10px rgba(84, 225, 138, 0.8); }
.dot.bad { background: var(--bad); box-shadow: 0 0 10px rgba(255, 95, 117, 0.8); }

.provider-meta {
  font-size: 12px;
  color: var(--muted);
}

.table-wrap {
  max-height: 54vh;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #101b2c;
}

th, td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(70, 105, 145, 0.25);
}

tbody tr:hover {
  background: rgba(121, 184, 255, 0.08);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

@media (max-width: 900px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .topbar {
    flex-direction: column;
    align-items: stretch;
  }
}
`;

export const gatewayUiJs = `const state = {
  providers: [],
  messages: [],
};

const els = {
  tokenInput: document.getElementById("tokenInput"),
  saveTokenBtn: document.getElementById("saveTokenBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  eventsCount: document.getElementById("eventsCount"),
  providersCount: document.getElementById("providersCount"),
  convCount: document.getElementById("convCount"),
  obsCount: document.getElementById("obsCount"),
  providersGrid: document.getElementById("providersGrid"),
  providerFilter: document.getElementById("providerFilter"),
  modeFilter: document.getElementById("modeFilter"),
  messagesTbody: document.getElementById("messagesTbody"),
};

function getToken() {
  return localStorage.getItem("fahrenheit.ingestToken") || "";
}

function authHeaders() {
  const token = getToken();
  if (!token) return {};
  return { Authorization: "Bearer " + token };
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("Request failed: " + res.status + " " + text);
  }
  return res.json();
}

function formatTs(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function truncate(text, max = 110) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

async function runProviderTest(providerId) {
  try {
    await api("/providers/" + encodeURIComponent(providerId) + "/test", {
      method: "POST",
      body: JSON.stringify({
        content: "UI test event (" + new Date().toISOString() + ")",
        mode: "observational",
      }),
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function renderProviders() {
  els.providersGrid.innerHTML = "";

  const providerIds = new Set();
  for (const entry of state.providers) {
    providerIds.add(entry.status.providerId);
  }
  const selected = els.providerFilter.value;
  els.providerFilter.innerHTML = '<option value="">All providers</option>';
  for (const id of providerIds) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    if (selected === id) opt.selected = true;
    els.providerFilter.appendChild(opt);
  }

  for (const entry of state.providers) {
    const card = document.createElement("article");
    card.className = "provider-card";

    const statusDot = entry.status.connected ? "good" : "bad";
    const statusText = entry.status.connected ? "Connected" : "Disconnected";
    const lastError = entry.status.lastError
      ? '<div class="provider-meta">Error: ' + entry.status.lastError + "</div>"
      : "";

    card.innerHTML = [
      '<div class="provider-row">',
      "<strong>" + entry.setup.title + "</strong>",
      '<span class="pill"><span class="dot ' + statusDot + '"></span>' + statusText + "</span>",
      "</div>",
      '<div class="provider-meta">' + entry.setup.summary + "</div>",
      '<div class="provider-meta mono">id: ' + entry.status.providerId + " · mode: " + entry.status.mode + "</div>",
      lastError,
      '<div class="provider-row">',
      '<button class="btn" data-test="' + entry.status.providerId + '">Send Test Event</button>',
      entry.setup.docsUrl ? '<a class="provider-meta" href="' + entry.setup.docsUrl + '" target="_blank" rel="noreferrer">docs</a>' : "<span></span>",
      "</div>",
    ].join("");

    els.providersGrid.appendChild(card);
  }

  els.providersGrid.querySelectorAll("button[data-test]").forEach((button) => {
    button.addEventListener("click", () => runProviderTest(button.dataset.test));
  });
}

function renderStats() {
  const messages = state.messages;
  const conv = messages.filter((m) => m.mode === "conversational").length;
  const obs = messages.filter((m) => m.mode === "observational").length;
  const providers = new Set(messages.map((m) => m.channelId));

  els.eventsCount.textContent = String(messages.length);
  els.providersCount.textContent = String(providers.size || state.providers.length);
  els.convCount.textContent = String(conv);
  els.obsCount.textContent = String(obs);
}

function renderMessages() {
  const providerFilter = els.providerFilter.value;
  const modeFilter = els.modeFilter.value;

  const filtered = state.messages.filter((m) => {
    if (providerFilter && m.channelId !== providerFilter) return false;
    if (modeFilter && m.mode !== modeFilter) return false;
    return true;
  });

  els.messagesTbody.innerHTML = "";
  for (const message of filtered) {
    const row = document.createElement("tr");
    row.innerHTML = [
      "<td>" + formatTs(message.timestamp) + "</td>",
      '<td class="mono">' + message.channelId + "</td>",
      '<td class="mono">' + message.sourceId + "</td>",
      "<td>" + (message.mode || "-") + "</td>",
      "<td>" + (message.direction || "-") + "</td>",
      "<td>" + (message.senderName || message.senderId || "-") + "</td>",
      "<td>" + truncate(message.content) + "</td>",
    ].join("");
    els.messagesTbody.appendChild(row);
  }
}

async function refresh() {
  try {
    const [providersRes, messagesRes] = await Promise.all([
      api("/providers"),
      api("/messages?limit=250"),
    ]);
    state.providers = providersRes.providers || [];
    state.messages = messagesRes.messages || [];
    renderProviders();
    renderStats();
    renderMessages();
  } catch (error) {
    console.error(error);
  }
}

els.saveTokenBtn.addEventListener("click", () => {
  localStorage.setItem("fahrenheit.ingestToken", els.tokenInput.value.trim());
});
els.refreshBtn.addEventListener("click", refresh);
els.providerFilter.addEventListener("change", renderMessages);
els.modeFilter.addEventListener("change", renderMessages);

els.tokenInput.value = getToken();
refresh();
setInterval(refresh, 4000);
`;
