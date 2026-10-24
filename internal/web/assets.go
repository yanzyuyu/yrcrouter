package web

const (
	assetIndexHTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>yrcrouter &mdash; AI Model Gateway &amp; Token Optimizer</title>
  <link rel="stylesheet" href="/static/app.css">
</head>
<body>
  <div class="shell">
    <header class="masthead">
      <div class="brand">
        <span class="symbol">YR</span>
        <div class="title-wrap">
          <h1 class="logo">yrcrouter</h1>
          <span class="sub">local ai proxy &amp; fallback router</span>
        </div>
      </div>
      <div class="masthead-meta">
        <span class="endpoint-chip">http://localhost:20128/v1</span>
        <button id="btn-refresh" class="btn btn-ghost" type="button">Refresh</button>
      </div>
    </header>

    <main class="grid-layout">
      <section class="panel metrics-panel">
        <div class="stat-card">
          <span class="stat-label">Total Permintaan</span>
          <span class="stat-value" id="val-total">0</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Berhasil</span>
          <span class="stat-value stat-ok" id="val-success">0</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Gagal</span>
          <span class="stat-value stat-fail" id="val-failed">0</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Fallback Dipicu</span>
          <span class="stat-value" id="val-fallback">0</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Estimasi Token Hemat</span>
          <span class="stat-value stat-highlight" id="val-saved">0</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Uptime</span>
          <span class="stat-value" id="val-uptime">0s</span>
        </div>
      </section>

      <section class="panel test-panel">
        <div class="panel-head">
          <h2>Test Prompt Router</h2>
          <span class="panel-desc">Kirim prompt uji coba melalui pipeline router lokal</span>
        </div>
        <form id="form-test" class="prompt-form">
          <div class="field-row">
            <label for="select-model" class="field-label">Model Target</label>
            <input type="text" id="select-model" class="input-text" value="gemini-2.5-flash" required>
          </div>
          <div class="field-row">
            <label for="prompt-input" class="field-label">Pesan Prompt</label>
            <textarea id="prompt-input" class="input-area" rows="3" placeholder="Tulis instruksi uji coba..." required>Jelaskan cara kerja yrcrouter dalam 1 kalimat padat.</textarea>
          </div>
          <div class="form-actions">
            <button type="submit" id="btn-submit" class="btn btn-primary">Kirim Permintaan</button>
            <span id="test-status" class="status-indicator">Siap</span>
          </div>
        </form>
        <div class="response-box">
          <pre id="test-output" class="code-output">Menunggu eksekusi uji coba...</pre>
        </div>
      </section>

      <section class="panel providers-panel">
        <div class="panel-head">
          <h2>Penyedia Layanan (Providers &amp; Tiers)</h2>
          <span class="panel-desc">Kelola rute upstream, prioritas tier, dan api keys</span>
        </div>
        <div id="providers-list" class="providers-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Provider</th>
                <th>Tier</th>
                <th>Base URL</th>
                <th>API Key</th>
                <th>Model Terdaftar</th>
              </tr>
            </thead>
            <tbody id="providers-tbody">
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel logs-panel">
        <div class="panel-head">
          <h2>Aktivitas Lalu Lintas Terbaru</h2>
          <span class="panel-desc">100 request terakhir yang diproses melalui gateway</span>
        </div>
        <div class="logs-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Model</th>
                <th>Provider Terpilih</th>
                <th>Status</th>
                <th>Latensi</th>
                <th>Stream</th>
                <th>Hemat (Bytes)</th>
              </tr>
            </thead>
            <tbody id="logs-tbody">
              <tr>
                <td colspan="7" class="empty-cell">Belum ada request tercatat</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>

    <footer class="colophon">
      <div class="colophon-inner">
        <span>yrcrouter &bull; Ultra-lean Go AI Gateway</span>
        <span>Kompatibel dengan Claude Code, Cursor, Cline, Copilot</span>
      </div>
    </footer>
  </div>
  <script src="/static/app.js"></script>
</body>
</html>
`
	assetAppCSS = `:root {
  --bg-canvas: oklch(0.14 0.015 255);
  --bg-surface: oklch(0.19 0.02 255);
  --bg-surface-elevated: oklch(0.23 0.025 255);
  --border-subtle: oklch(0.28 0.02 255);
  --border-focus: oklch(0.65 0.16 235);
  --text-main: oklch(0.96 0.01 255);
  --text-muted: oklch(0.68 0.02 255);
  --text-dim: oklch(0.52 0.02 255);
  --accent-primary: oklch(0.65 0.16 235);
  --accent-primary-hover: oklch(0.72 0.18 235);
  --accent-primary-fg: oklch(0.12 0.01 255);
  --status-ok: oklch(0.72 0.16 145);
  --status-fail: oklch(0.65 0.20 25);
  --radius-card: 8px;
  --radius-element: 6px;
  --radius-small: 4px;
}

html, body, * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg-canvas);
  color: var(--text-main);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.5;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

.shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.masthead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.symbol {
  width: 38px;
  height: 38px;
  background-color: var(--accent-primary);
  color: var(--accent-primary-fg);
  font-weight: 700;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-element);
  letter-spacing: -0.05em;
}

.title-wrap {
  display: flex;
  flex-direction: column;
}

.logo {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.sub {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.masthead-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.endpoint-chip {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  padding: 6px 10px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-small);
  color: var(--text-muted);
}

.grid-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.metrics-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.stat-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  letter-spacing: -0.02em;
}

.stat-ok {
  color: var(--status-ok);
}

.stat-fail {
  color: var(--status-fail);
}

.stat-highlight {
  color: var(--accent-primary);
}

.panel {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.panel-head h2 {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.panel-desc {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.prompt-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-muted);
}

.input-text, .input-area {
  width: 100%;
  background-color: var(--bg-canvas);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-element);
  color: var(--text-main);
  padding: 8px 12px;
  font-family: inherit;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s ease;
}

.input-text:focus, .input-area:focus {
  border-color: var(--border-focus);
}

.input-area {
  resize: vertical;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: var(--radius-element);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  font-family: inherit;
}

.btn-primary {
  background-color: var(--accent-primary);
  color: var(--accent-primary-fg);
}

.btn-primary:hover {
  background-color: var(--accent-primary-hover);
}

.btn-ghost {
  background-color: var(--bg-surface-elevated);
  border-color: var(--border-subtle);
  color: var(--text-main);
}

.btn-ghost:hover {
  border-color: var(--border-focus);
}

.status-indicator {
  font-size: 0.8125rem;
  color: var(--text-dim);
  font-family: ui-monospace, monospace;
}

.response-box {
  background-color: var(--bg-canvas);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-element);
  padding: 14px;
}

.code-output {
  font-family: ui-monospace, monospace;
  font-size: 0.8125rem;
  color: var(--text-main);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow-y: auto;
}

.providers-table-wrap, .logs-table-wrap {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  text-align: left;
}

.data-table th {
  padding: 8px 12px;
  color: var(--text-dim);
  font-weight: 500;
  border-bottom: 1px solid var(--border-subtle);
  text-transform: uppercase;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
}

.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-main);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover td {
  background-color: var(--bg-surface-elevated);
}

.tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: var(--radius-small);
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
}

.tag-active {
  background-color: oklch(0.24 0.05 145);
  color: var(--status-ok);
}

.tag-disabled {
  background-color: oklch(0.24 0.05 25);
  color: var(--status-fail);
}

.tag-tier {
  background-color: var(--bg-canvas);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
}

.empty-cell {
  text-align: center;
  color: var(--text-dim);
  padding: 24px 12px;
}

.colophon {
  border-top: 1px solid var(--border-subtle);
  padding-top: 20px;
}

.colophon-inner {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-dim);
  flex-wrap: wrap;
  gap: 8px;
}
`
	assetAppJS = `(function () {
  const elTotal = document.getElementById("val-total");
  const elSuccess = document.getElementById("val-success");
  const elFailed = document.getElementById("val-failed");
  const elFallback = document.getElementById("val-fallback");
  const elSaved = document.getElementById("val-saved");
  const elUptime = document.getElementById("val-uptime");
  const btnRefresh = document.getElementById("btn-refresh");
  const formTest = document.getElementById("form-test");
  const inputModel = document.getElementById("select-model");
  const inputPrompt = document.getElementById("prompt-input");
  const btnSubmit = document.getElementById("btn-submit");
  const testStatus = document.getElementById("test-status");
  const testOutput = document.getElementById("test-output");
  const providersTbody = document.getElementById("providers-tbody");
  const logsTbody = document.getElementById("logs-tbody");

  function formatUptime(seconds) {
    if (seconds < 60) return seconds + "s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return m + "m " + s + "s";
    const h = Math.floor(m / 60);
    return h + "h " + (m % 60) + "m";
  }

  async function fetchStatus() {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) return;
      const data = await res.json();
      elTotal.textContent = data.metrics.total_requests;
      elSuccess.textContent = data.metrics.success_requests;
      elFailed.textContent = data.metrics.failed_requests;
      elFallback.textContent = data.metrics.fallback_hits;
      elSaved.textContent = data.metrics.saved_tokens_est;
      elUptime.textContent = formatUptime(data.metrics.uptime_seconds);
      renderProviders(data.config.providers);
      renderLogs(data.logs);
    } catch (e) {
      testStatus.textContent = "Koneksi gateway terputus";
    }
  }

  function renderProviders(providers) {
    if (!providers || !providersTbody) return;
    providersTbody.innerHTML = "";
    providers.forEach(function (p) {
      const tr = document.createElement("tr");

      const tdStatus = document.createElement("td");
      const spanStatus = document.createElement("span");
      spanStatus.className = "tag " + (p.enabled ? "tag-active" : "tag-disabled");
      spanStatus.textContent = p.enabled ? "AKTIF" : "NONAKTIF";
      tdStatus.appendChild(spanStatus);

      const tdName = document.createElement("td");
      tdName.textContent = p.name;

      const tdTier = document.createElement("td");
      const spanTier = document.createElement("span");
      spanTier.className = "tag tag-tier";
      spanTier.textContent = "Tier " + p.tier;
      tdTier.appendChild(spanTier);

      const tdUrl = document.createElement("td");
      tdUrl.textContent = p.base_url;

      const tdKey = document.createElement("td");
      tdKey.textContent = p.api_key ? "••••••••" : "(belum diisi)";

      const tdModels = document.createElement("td");
      tdModels.textContent = p.models.join(", ");

      tr.appendChild(tdStatus);
      tr.appendChild(tdName);
      tr.appendChild(tdTier);
      tr.appendChild(tdUrl);
      tr.appendChild(tdKey);
      tr.appendChild(tdModels);
      providersTbody.appendChild(tr);
    });
  }

  function renderLogs(logs) {
    if (!logs || !logsTbody) return;
    if (logs.length === 0) {
      logsTbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Belum ada request tercatat</td></tr>';
      return;
    }
    logsTbody.innerHTML = "";
    logs.forEach(function (l) {
      const tr = document.createElement("tr");

      const tdTime = document.createElement("td");
      tdTime.textContent = l.timestamp;

      const tdModel = document.createElement("td");
      tdModel.textContent = l.model;

      const tdProv = document.createElement("td");
      tdProv.textContent = l.provider || "-";

      const tdStatus = document.createElement("td");
      const spanCode = document.createElement("span");
      spanCode.className = "tag " + (l.status_code >= 200 && l.status_code < 300 ? "tag-active" : "tag-disabled");
      spanCode.textContent = l.status_code;
      tdStatus.appendChild(spanCode);

      const tdLat = document.createElement("td");
      tdLat.textContent = l.latency_ms + "ms";

      const tdStream = document.createElement("td");
      tdStream.textContent = l.stream ? "Ya" : "Tidak";

      const tdSaved = document.createElement("td");
      tdSaved.textContent = l.saved_bytes > 0 ? l.saved_bytes + " B" : "-";

      tr.appendChild(tdTime);
      tr.appendChild(tdModel);
      tr.appendChild(tdProv);
      tr.appendChild(tdStatus);
      tr.appendChild(tdLat);
      tr.appendChild(tdStream);
      tr.appendChild(tdSaved);
      logsTbody.appendChild(tr);
    });
  }

  async function handleTestSubmit(e) {
    e.preventDefault();
    const model = inputModel.value.trim();
    const prompt = inputPrompt.value.trim();
    if (!model || !prompt) return;

    btnSubmit.disabled = true;
    testStatus.textContent = "Mengirim...";
    testOutput.textContent = "";

    try {
      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }],
          stream: false
        })
      });

      const body = await res.json();
      testStatus.textContent = "HTTP " + res.status;
      if (res.ok && body.choices && body.choices[0]) {
        testOutput.textContent = body.choices[0].message.content;
      } else {
        testOutput.textContent = JSON.stringify(body, null, 2);
      }
    } catch (err) {
      testStatus.textContent = "Gagal";
      testOutput.textContent = "Error: " + err.message;
    } finally {
      btnSubmit.disabled = false;
      fetchStatus();
    }
  }

  if (formTest) {
    formTest.addEventListener("submit", handleTestSubmit);
  }

  if (btnRefresh) {
    btnRefresh.addEventListener("click", fetchStatus);
  }

  fetchStatus();
  setInterval(fetchStatus, 4000);
})();
`
)
