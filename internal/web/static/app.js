(function () {
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
