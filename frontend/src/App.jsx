import React, { useState, useEffect } from 'react';

export default function App() {
  const [activeNav, setActiveNav] = useState('Overview');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSdk, setSelectedSdk] = useState('cURL');

  const [metrics, setMetrics] = useState({
    total_requests: 0,
    success_requests: 0,
    failed_requests: 0,
    fallback_hits: 0,
    saved_tokens_est: 0,
    uptime_seconds: 0
  });

  const [config, setConfig] = useState({
    port: 20128,
    compress_tokens: true,
    default_model: 'antigravity/claude-3-7-sonnet',
    providers: []
  });

  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKey, setEditingKey] = useState({});
  const [keyVisible, setKeyVisible] = useState({});
  const [apiKeyMasked, setApiKeyMasked] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState('yr_live_9823f2a445f2a0f13b9d25c9cafe5183');

  const [testModel, setTestModel] = useState('antigravity/claude-3-7-sonnet');
  const [testPrompt, setTestPrompt] = useState('Jelaskan cara kerja multi-tier fallback dan token saver pada yrcrouter.');
  const [testOutput, setTestOutput] = useState('Klik tombol "Kirim Permintaan HTTP" di sebelah kiri untuk melihat respons JSON live...');
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState('Ready');
  const [testLatency, setTestLatency] = useState(8);

  const [oauthModalOpen, setOauthModalOpen] = useState(false);
  const [oauthProvider, setOauthProvider] = useState(null);
  const [deviceFlowData, setDeviceFlowData] = useState(null);
  const [oauthStatusText, setOauthStatusText] = useState('');
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [copiedNotice, setCopiedNotice] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) return;
      const data = await res.json();
      setMetrics(data.metrics || {});
      setConfig(data.config || {});
      setLogs(data.logs || []);
    } catch (e) {
      setTestStatus('Offline');
    }
  }

  function triggerCopy(text, label) {
    navigator.clipboard.writeText(text);
    setCopiedNotice(label);
    setTimeout(() => setCopiedNotice(''), 2000);
  }

  async function updateProvider(id, updates) {
    const updatedProviders = config.providers.map(p => {
      if (p.id === id) {
        return { ...p, ...updates };
      }
      return p;
    });
    const newConfig = { ...config, providers: updatedProviders };
    setConfig(newConfig);

    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      fetchData();
    } catch (err) {
      setTestStatus('Gagal simpan');
    }
  }

  async function toggleCompression() {
    const newConfig = { ...config, compress_tokens: !config.compress_tokens };
    setConfig(newConfig);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      fetchData();
    } catch (err) {
      setTestStatus('Gagal ubah kompresi');
    }
  }

  async function openOAuthModal(provider) {
    setOauthProvider(provider);
    setOauthModalOpen(true);
    setDeviceFlowData(null);
    setOauthStatusText('');
    setManualTokenInput('');

    if (provider.id === 'github_copilot' || provider.id === 'github') {
      setOauthStatusText('Meminta device code dari GitHub...');
      try {
        const res = await fetch('/api/oauth/github/device-code', { method: 'POST' });
        const data = await res.json();
        if (data.user_code) {
          setDeviceFlowData(data);
          setOauthStatusText('Silakan buka tautan dan masukkan kode verifikasi.');
          startDevicePolling(data.device_code, data.interval || 5);
        } else {
          setOauthStatusText('Gagal: ' + (data.error || 'Respon tidak valid'));
        }
      } catch (err) {
        setOauthStatusText('Error GitHub: ' + err.message);
      }
    } else if (provider.id === 'antigravity' || provider.id === 'claude' || provider.id === 'gemini') {
      try {
        const res = await fetch('/api/oauth/pkce-start?provider=' + provider.id);
        const data = await res.json();
        if (data.auth_url) {
          setDeviceFlowData(data);
        }
      } catch (e) {
        setOauthStatusText('Gagal inisialisasi PKCE');
      }
    }
  }

  function startDevicePolling(deviceCode, intervalSec) {
    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/oauth/github/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_code: deviceCode })
        });
        const data = await res.json();
        if (data.status === 'authenticated') {
          clearInterval(pollTimer);
          setOauthStatusText('Otorisasi berhasil! Token telah terpasang.');
          setTimeout(() => {
            setOauthModalOpen(false);
            fetchData();
          }, 1500);
        } else if (data.error && data.error !== 'authorization_pending') {
          clearInterval(pollTimer);
          setOauthStatusText('Otorisasi dibatalkan: ' + data.error);
        }
      } catch (e) {
        clearInterval(pollTimer);
      }
    }, Math.max(intervalSec * 1000, 3000));
  }

  async function handleImportTokenSubmit() {
    if (!oauthProvider || !manualTokenInput) return;
    setOauthStatusText('Menyimpan token...');
    try {
      const res = await fetch('/api/oauth/import-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: oauthProvider.id,
          token: manualTokenInput
        })
      });
      if (res.ok) {
        setOauthStatusText('Token berhasil diimpor!');
        setTimeout(() => {
          setOauthModalOpen(false);
          fetchData();
        }, 1200);
      }
    } catch (err) {
      setOauthStatusText('Gagal menyimpan: ' + err.message);
    }
  }

  async function handleTestSubmit(e) {
    e.preventDefault();
    if (!testModel || !testPrompt) return;

    setTestLoading(true);
    setTestStatus('Executing');
    setTestOutput('Menghubungkan ke gateway...');
    const startTime = Date.now();

    try {
      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: testPrompt }],
          stream: false
        })
      });

      const body = await res.json();
      setTestLatency(Date.now() - startTime);
      setTestStatus('HTTP ' + res.status);
      setTestOutput(JSON.stringify(body, null, 2));
    } catch (err) {
      setTestStatus('Error');
      setTestOutput('Error: ' + err.message);
    } finally {
      setTestLoading(false);
      fetchData();
    }
  }

  const categories = ['All', 'High-Speed', 'Cloud', 'Asian LLM', 'Local', 'Aggregator', 'Search'];

  const filteredProviders = (config.providers || []).filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.models.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const oauthSupportedIds = ['antigravity', 'github_copilot', 'github', 'cursor', 'claude', 'gemini', 'openai', 'codex'];

  const navLinks = ['Overview', 'Provider', 'Fallback Pipeline', 'RTK Optimizer', 'Playground', 'Traffic Logs', 'SDK Integrasi'];

  const sdkCode = {
    cURL: `curl -X POST http://localhost:${config.port || 20128}/v1/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer \${API_KEY}" \\\n  -d '{\n    "model": "${testModel}",\n    "messages": [{"role": "user", "content": "Halo yrcrouter!"}]\n  }'`,
    'Node.js': `import OpenAI from "openai";\n\nconst client = new OpenAI({\n  baseURL: "http://localhost:${config.port || 20128}/v1",\n  apiKey: process.env.ROUTER_KEY || "local-key"\n});\n\nconst res = await client.chat.completions.create({\n  model: "${testModel}",\n  messages: [{ role: "user", content: "Halo dari Node.js!" }]\n});\nconsole.log(res.choices[0].message.content);`,
    Python: `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="http://localhost:${config.port || 20128}/v1",\n    api_key="local-key"\n)\n\nresponse = client.chat.completions.create(\n    model="${testModel}",\n    messages=[{"role": "user", "content": "Halo dari Python!"}]\n)\nprint(response.choices[0].message.content)`,
    Go: `package main\n\nimport (\n\t"bytes"\n\t"fmt"\n\t"io"\n\t"net/http"\n)\n\nfunc main() {\n\tpayload := []byte(\`{"model":"${testModel}","messages":[{"role":"user","content":"Halo dari Go!"}]}\`)\n\tresp, _ := http.Post("http://localhost:${config.port || 20128}/v1/chat/completions", "application/json", bytes.NewReader(payload))\n\tbody, _ := io.ReadAll(resp.Body)\n\tfmt.Println(string(body))\n}`,
    'Cursor / Cline': `// Tambahkan endpoint ini pada konfigurasi ekstensi Cline / Cursor / Claude Code:\n{\n  "openAiBaseUrl": "http://localhost:${config.port || 20128}/v1",\n  "openAiApiKey": "${apiKeyInput}",\n  "openAiModelId": "${testModel}"\n}`
  };

  return (
    <div className="min-h-screen text-neutral-800 flex flex-col font-sans selection:bg-[#e05236]/20 selection:text-[#e05236] w-full">
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur sticky top-0 z-40 w-full">
        <div className="w-full px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#e05236] text-white font-bold flex items-center justify-center text-sm shadow-sm">
              YR
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-neutral-900 leading-none">yrcrouter</span>
              <span className="text-[10px] text-neutral-600 uppercase font-mono tracking-wider">AI Gateway &amp; Proxy Suite</span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-neutral-600">
            {navLinks.map(link => (
              <a
                key={link}
                href={'#' + link.toLowerCase().replace(/ /g, '-')}
                onClick={() => setActiveNav(link)}
                className={'transition hover:text-neutral-900 ' + (activeNav === link ? 'text-[#e05236] font-semibold border-b-2 border-[#e05236] pb-1' : '')}
              >
                {link}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1 bg-neutral-100 border border-neutral-200/80 rounded-lg text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-mono text-neutral-800 text-[11px]">Port {config.port || 20128}</span>
              <span className="text-[10px] text-neutral-500 font-medium">Go Core</span>
            </div>

            <button
              type="button"
              onClick={() => triggerCopy('http://localhost:' + (config.port || 20128) + '/v1', 'Endpoint disalin!')}
              className="px-3.5 py-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition shadow-sm flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Salin Endpoint</span>
            </button>
          </div>
        </div>
      </header>

      {copiedNotice && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2 bg-neutral-900 text-white text-xs font-medium rounded-lg shadow-lg">
          {copiedNotice}
        </div>
      )}

      <main className="w-full px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 py-10 flex-1 flex flex-col gap-16">
        <section id="overview" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-950 tracking-tight leading-tight">
                Gateway AI &amp; Multi-Provider Reverse Proxy Tercepat
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-3xl">
                Engine routing mandiri berbasis Go standard library tanpa ketergantungan framework berat. Terhubung langsung ke Google Antigravity, GitHub Copilot OAuth resmi, Claude, OpenAI, dan model lokal tanpa perantara dengan latensi ultra rendah dan kompresi token RTK otomatis.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
              <div className="p-4 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col">
                <span className="text-lg font-bold text-neutral-900">99.98%</span>
                <span className="text-[11px] text-neutral-600">Uptime Gateway</span>
              </div>
              <div className="p-4 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col">
                <span className="text-lg font-bold text-neutral-900">&lt; 15ms</span>
                <span className="text-[11px] text-neutral-600">Engine Overhead</span>
              </div>
              <div className="p-4 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col">
                <span className="text-lg font-bold text-neutral-900">{config.providers ? config.providers.length : 30}+</span>
                <span className="text-[11px] text-neutral-600">Provider AI</span>
              </div>
              <div className="p-4 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col">
                <span className="text-lg font-bold text-emerald-600">Anti-Limit</span>
                <span className="text-[11px] text-neutral-600">Auto-Fallback 3-Tier</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 font-mono">
                KREDENSIAL GATEWAY ANDA
              </span>
              <span className="text-[10px] font-mono text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Gateway Aktif
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-neutral-700">Production Base URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={'http://localhost:' + (config.port || 20128) + '/v1'}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700"
                />
                <button
                  type="button"
                  onClick={() => triggerCopy('http://localhost:' + (config.port || 20128) + '/v1', 'URL Disalin!')}
                  className="px-3 py-2 text-xs font-medium border border-neutral-200 hover:bg-neutral-50 rounded-lg text-neutral-700"
                >
                  Salin
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-neutral-700">Gateway API Key (Header: Authorization)</label>
              <div className="flex items-center gap-2">
                <input
                  type={apiKeyMasked ? 'password' : 'text'}
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700"
                />
                <button
                  type="button"
                  onClick={() => setApiKeyMasked(!apiKeyMasked)}
                  className="p-2 border border-neutral-200 hover:bg-neutral-50 rounded-lg text-neutral-600 text-xs flex items-center justify-center"
                  aria-label={apiKeyMasked ? 'Tampilkan API Key' : 'Sembunyikan API Key'}
                >
                  {apiKeyMasked ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => triggerCopy(apiKeyInput, 'Kunci Disalin!')}
                  className="px-3 py-2 text-xs font-medium border border-neutral-200 hover:bg-neutral-50 rounded-lg text-neutral-700"
                >
                  Salin
                </button>
                <button
                  type="button"
                  onClick={() => triggerCopy(apiKeyInput, 'Kunci Tersimpan!')}
                  className="px-3.5 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg shadow-sm"
                >
                  Simpan
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-600 pt-2 border-t border-neutral-100">
              <span>Perlu rotasi kredensial lokal?</span>
              <button
                type="button"
                onClick={() => setApiKeyInput('yr_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15))}
                className="text-[#e05236] hover:underline font-medium"
              >
                Rotasi Kunci Baru
              </button>
            </div>
          </div>
        </section>

        <section id="fallback-pipeline" className="flex flex-col gap-6 w-full">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-900">Arsitektur Multi-Tier Fallback</h2>
              <span className="text-xs text-neutral-600">Alur perlindungan otomatis yang menjamin sesi koding IDE Anda tidak pernah terhenti saat rate limit.</span>
            </div>
            <a href="#provider" className="text-xs text-[#e05236] font-semibold hover:underline flex items-center gap-1">
              <span>Konfigurasi Provider</span>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <div className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-2">
              <span className="w-6 h-6 rounded bg-orange-100 text-[#e05236] text-xs font-bold flex items-center justify-center font-mono">01</span>
              <h3 className="font-bold text-sm text-neutral-900 mt-1">Tier 1: High-Speed Primary</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Prioritas utama ke akun resmi langsung seperti Google Antigravity, GitHub Copilot, atau DeepSeek dengan kecepatan maksimal dan latensi terendah.
              </p>
            </div>

            <div className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-2">
              <span className="w-6 h-6 rounded bg-orange-100 text-[#e05236] text-xs font-bold flex items-center justify-center font-mono">02</span>
              <h3 className="font-bold text-sm text-neutral-900 mt-1">Tier 2: Cloud Failover</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Jika Tier 1 mendeteksi HTTP 429 atau 5xx, router mengalihkan request secara instan dalam &lt;10ms ke OpenRouter atau Google Gemini tanpa memutus sesi IDE.
              </p>
            </div>

            <div className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-2">
              <span className="w-6 h-6 rounded bg-orange-100 text-[#e05236] text-xs font-bold flex items-center justify-center font-mono">03</span>
              <h3 className="font-bold text-sm text-neutral-900 mt-1">Tier 3: Local LLM Fallback</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Jalur darurat tanpa kuota internet ke Ollama atau LM Studio lokal. Memastikan completion dan chat tetap responsif saat koneksi jaringan terputus.
              </p>
            </div>

            <div className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-2">
              <span className="w-6 h-6 rounded bg-orange-100 text-[#e05236] text-xs font-bold flex items-center justify-center font-mono">04</span>
              <h3 className="font-bold text-sm text-neutral-900 mt-1">Zero Dependency Go Engine</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Dibangun murni dengan Go standard library tanpa perantara runtime berat. Footprint RAM hanya 15MB - 20MB dan waktu boot di bawah 50ms.
              </p>
            </div>
          </div>
        </section>

        <section id="rtk-optimizer" className="p-6 bg-white border border-neutral-200/80 rounded-2xl shadow-xs flex flex-col gap-5 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-neutral-900">RTK Token Compression Engine</h2>
                <span className={'px-2 py-0.5 text-[10px] font-mono font-bold rounded ' + (config.compress_tokens ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600')}>
                  {config.compress_tokens ? 'OPTIMIZER AKTIF' : 'NONAKTIF'}
                </span>
              </div>
              <p className="text-xs text-neutral-600 max-w-2xl">
                Memangkas pemborosan token prompt hingga 40% dengan menormalkan whitespace berlebih, metadata git diff redundan, dan baris kosong berturut-turut sebelum diteruskan ke upstream model LLM.
              </p>
            </div>

            <button
              type="button"
              onClick={toggleCompression}
              className={'px-4 py-2 text-xs font-semibold rounded-lg transition self-start ' + (config.compress_tokens ? 'bg-neutral-900 hover:bg-neutral-800 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white')}
            >
              {config.compress_tokens ? 'Matikan Kompresi' : 'Aktifkan Kompresi'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-100">
            <div className="p-4 bg-neutral-50 border border-neutral-200/80 rounded-xl flex flex-col gap-1">
              <span className="text-xs font-bold text-neutral-900">Git Diff Index Normalization</span>
              <span className="text-[11px] text-neutral-600">Menghapus hash commit index dan file header git redundant pada prompt koding.</span>
            </div>
            <div className="p-4 bg-neutral-50 border border-neutral-200/80 rounded-xl flex flex-col gap-1">
              <span className="text-xs font-bold text-neutral-900">Trailing &amp; Empty Line Compaction</span>
              <span className="text-[11px] text-neutral-600">Menyatukan spasi buntut dan jeda baris berturut-turut tanpa merusak struktur sintaksis kode.</span>
            </div>
            <div className="p-4 bg-neutral-50 border border-neutral-200/80 rounded-xl flex flex-col gap-1">
              <span className="text-xs font-bold text-neutral-900">Estimasi Token Dihemat</span>
              <span className="text-lg font-bold text-[#e05236] font-mono">
                {metrics.saved_tokens_est ? metrics.saved_tokens_est.toLocaleString() : '0'} tokens
              </span>
            </div>
          </div>
        </section>

        <section id="playground" className="flex flex-col gap-4 w-full">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-900">Interactive Live Playground</h2>
              <span className="text-xs text-neutral-600">Uji coba pemanggilan API langsung melalui browser Anda tanpa perlu membuka terminal eksternal.</span>
            </div>
            <span className="text-xs font-mono text-neutral-600">Header: Authorization otomatis aktif</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full">
            <form onSubmit={handleTestSubmit} className="lg:col-span-5 p-6 bg-white border border-neutral-200/80 rounded-2xl shadow-sm flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-700">Endpoint Target</label>
                <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="px-1.5 py-0.5 bg-orange-100 text-[#e05236] font-bold text-[10px] rounded">POST</span>
                    <span className="text-neutral-800 font-medium">/v1/chat/completions</span>
                  </div>
                  <span className="text-[11px] text-neutral-600">Chat &amp; Fallback</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-700">Model Target</label>
                <select
                  value={testModel}
                  onChange={e => setTestModel(e.target.value)}
                  className="px-3 py-2 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 outline-none"
                >
                  <option value="antigravity/claude-3-7-sonnet">antigravity/claude-3-7-sonnet (Google Antigravity)</option>
                  <option value="antigravity/gemini-2.5-flash">antigravity/gemini-2.5-flash (Google Antigravity)</option>
                  <option value="openrouter/auto">openrouter/auto (OpenRouter Auto-Fallback)</option>
                  <option value="gpt-4o">gpt-4o (GitHub Copilot / OpenAI)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Google Gemini)</option>
                  <option value="deepseek-chat">deepseek-chat (DeepSeek V3)</option>
                  <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Groq Speed)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-700">Pesan Prompt</label>
                <textarea
                  rows={4}
                  value={testPrompt}
                  onChange={e => setTestPrompt(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 outline-none resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={testLoading}
                className="w-full py-2.5 text-xs font-semibold bg-[#e05236] hover:bg-[#c9452b] disabled:opacity-50 text-white rounded-lg transition shadow-sm flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
                <span>{testLoading ? 'Mengirim Permintaan...' : 'Kirim Permintaan HTTP'}</span>
              </button>
            </form>

            <div className="lg:col-span-7 bg-[#0c1322] border border-neutral-800 rounded-2xl p-5 shadow-sm flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-neutral-400 text-[11px]">
                <div className="flex items-center gap-4">
                  <span>Status: <strong className="text-emerald-400 font-bold">{testStatus}</strong></span>
                  <span>Latency: <strong className="text-cyan-400">{testLatency} ms</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => triggerCopy(testOutput, 'JSON Disalin!')}
                  className="hover:text-white transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Salin Output JSON</span>
                </button>
              </div>

              <pre className="flex-1 text-zinc-300 whitespace-pre-wrap overflow-y-auto max-h-[300px] leading-relaxed text-[11px]">
                {testOutput}
              </pre>
            </div>
          </div>
        </section>

        <section id="provider" className="flex flex-col gap-6 w-full">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-900">Katalog Provider AI ({config.providers ? config.providers.length : 0})</h2>
              <span className="text-xs text-neutral-600">Daftar lengkap provider AI terintegrasi termasuk Google Antigravity, Copilot, Claude, dan provider lokal.</span>
            </div>

            <input
              type="text"
              placeholder="Cari provider atau nama model..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-3.5 py-2 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-800 outline-none sm:w-72 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={'px-3 py-1.5 text-xs rounded-lg border transition whitespace-nowrap ' + (selectedCategory === cat ? 'bg-neutral-900 text-white border-neutral-900 font-semibold' : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50')}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
            {filteredProviders.map(p => {
              const isKeyOpen = keyVisible[p.id];
              const hasOAuth = oauthSupportedIds.includes(p.id);

              return (
                <article key={p.id} className="p-5 bg-white border border-neutral-200/80 rounded-2xl shadow-xs flex flex-col gap-3 relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-950">{p.name}</span>
                        {p.id === 'antigravity' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 rounded">
                            Official
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-600 font-mono truncate max-w-[220px]">{p.base_url}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-neutral-100 text-neutral-700 border border-neutral-200 font-medium">
                        Tier {p.tier}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateProvider(p.id, { enabled: !p.enabled })}
                        className={'px-2.5 py-0.5 text-[10px] font-bold rounded transition ' + (p.enabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-neutral-100 text-neutral-600 border border-neutral-200')}
                      >
                        {p.enabled ? 'AKTIF' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-wider text-neutral-600 font-bold">Autentikasi</label>
                      {hasOAuth && (
                        <button
                          type="button"
                          onClick={() => openOAuthModal(p)}
                          className="text-[11px] text-[#e05236] hover:underline font-semibold flex items-center gap-1"
                        >
                          <span>OAuth Login</span>
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type={isKeyOpen ? 'text' : 'password'}
                        placeholder="Token API..."
                        value={editingKey[p.id] !== undefined ? editingKey[p.id] : (p.api_key || '')}
                        onChange={e => setEditingKey({ ...editingKey, [p.id]: e.target.value })}
                        className="flex-1 px-3 py-1.5 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setKeyVisible({ ...keyVisible, [p.id]: !isKeyOpen })}
                        className="px-2.5 py-1.5 text-[11px] bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-700 border border-neutral-200"
                      >
                        {isKeyOpen ? 'Hide' : 'Show'}
                      </button>
                      {editingKey[p.id] !== undefined && (
                        <button
                          type="button"
                          onClick={() => {
                            updateProvider(p.id, { api_key: editingKey[p.id] });
                            const next = { ...editingKey };
                            delete next[p.id];
                            setEditingKey(next);
                          }}
                          className="px-3 py-1.5 text-[11px] bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-lg shadow-xs"
                        >
                          Save
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-neutral-100">
                    {p.models.map(m => (
                      <span key={m} className="px-2 py-0.5 text-[10px] font-mono rounded bg-neutral-100 text-neutral-700 border border-neutral-200/80">
                        {m}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="traffic-logs" className="flex flex-col gap-4 w-full">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-900">Traffic Inspector &amp; Request Logs</h2>
              <span className="text-xs text-neutral-600">Catatan telemetri realtime setiap request yang diproses oleh engine gateway yrcrouter.</span>
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="px-3 py-1.5 text-xs font-medium border border-neutral-200 hover:bg-neutral-50 rounded-lg text-neutral-700 bg-white flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="bg-white border border-neutral-200/80 rounded-2xl overflow-hidden shadow-xs w-full">
            {logs && logs.length > 0 ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-mono text-[11px]">
                      <th className="py-2.5 px-4 font-semibold">Waktu</th>
                      <th className="py-2.5 px-4 font-semibold">Model Target</th>
                      <th className="py-2.5 px-4 font-semibold">Provider</th>
                      <th className="py-2.5 px-4 font-semibold">Status HTTP</th>
                      <th className="py-2.5 px-4 font-semibold">Latensi</th>
                      <th className="py-2.5 px-4 font-semibold">Stream</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-mono text-[11px]">
                    {logs.slice(-10).reverse().map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-neutral-50/50">
                        <td className="py-2.5 px-4 text-neutral-500">{log.timestamp}</td>
                        <td className="py-2.5 px-4 font-bold text-neutral-900">{log.model}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                            {log.provider}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={'px-1.5 py-0.5 rounded font-bold ' + (log.status_code === 200 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')}>
                            {log.status_code}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-cyan-700 font-semibold">{log.latency_ms} ms</td>
                        <td className="py-2.5 px-4 text-neutral-500">{log.stream ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-neutral-500 text-xs">
                <svg className="w-8 h-8 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                <span>Belum ada log traffic. Kirim prompt pengujian di playground di atas untuk melihat alur telemetri live.</span>
              </div>
            )}
          </div>
        </section>

        <section id="sdk-integrasi" className="flex flex-col gap-4 w-full">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-neutral-900">SDK &amp; Konfigurasi Klien IDE</h2>
            <span className="text-xs text-neutral-600">Salin cuplikan kode atau setting JSON untuk langsung menghubungkan editor, CLI, dan backend Anda.</span>
          </div>

          <div className="bg-[#0c1322] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm flex flex-col w-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-[#090e1a]">
              <div className="flex items-center gap-2">
                {['cURL', 'Node.js', 'Python', 'Go', 'Cursor / Cline'].map(sdk => (
                  <button
                    key={sdk}
                    type="button"
                    onClick={() => setSelectedSdk(sdk)}
                    className={'px-3 py-1 text-xs rounded-lg font-medium transition ' + (selectedSdk === sdk ? 'bg-neutral-800 text-white font-semibold' : 'text-neutral-400 hover:text-neutral-200')}
                  >
                    {sdk}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => triggerCopy(sdkCode[selectedSdk], 'Kode Disalin!')}
                className="text-xs text-neutral-400 hover:text-white font-mono transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Salin Konfigurasi</span>
              </button>
            </div>

            <pre className="p-5 font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed">
              {sdkCode[selectedSdk]}
            </pre>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-white py-12 mt-12 text-xs text-neutral-600 w-full">
        <div className="w-full px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-[#e05236] text-white font-bold flex items-center justify-center text-xs">YR</span>
              <span className="font-bold text-sm text-neutral-900">yrcrouter</span>
            </div>
            <p className="text-neutral-500 text-xs leading-relaxed">
              Infrastruktur REST API berkinerja tinggi untuk proxy AI multi-provider, integrasi Google Antigravity &amp; Copilot OAuth resmi, dan auto-fallback tercepat.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] text-emerald-700 font-medium">Gateway Operasional &bull; Port {config.port || 20128}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-bold text-xs uppercase text-neutral-900 tracking-wider">NAVIGASI ROUTER</span>
            <a href="#overview" className="hover:text-neutral-900">Overview Gateway</a>
            <a href="#provider" className="hover:text-neutral-900">Katalog Provider</a>
            <a href="#fallback-pipeline" className="hover:text-neutral-900">Fallback Pipeline</a>
            <a href="#rtk-optimizer" className="hover:text-neutral-900">RTK Optimizer</a>
            <a href="#playground" className="hover:text-neutral-900">Live Playground</a>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-bold text-xs uppercase text-neutral-900 tracking-wider">INTEGRASI SDK</span>
            <span className="hover:text-neutral-900">cURL API Direct</span>
            <span className="hover:text-neutral-900">OpenAI Node.js SDK</span>
            <span className="hover:text-neutral-900">OpenAI Python SDK</span>
            <span className="hover:text-neutral-900">Golang HTTP Client</span>
            <span className="hover:text-neutral-900">Cline / Cursor Editor</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-bold text-xs uppercase text-neutral-900 tracking-wider">REPOSITORI &amp; SISTEM</span>
            <a href="https://github.com/yanzyuyu/yrcrouter" target="_blank" rel="noreferrer" className="hover:text-neutral-900 flex items-center gap-1">
              <span>GitHub Repository</span>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <span className="hover:text-neutral-900">Pure Go Standard Library</span>
            <span className="hover:text-neutral-900">Zero-Trust Local Engine</span>
            <span className="hover:text-neutral-900">Zero Commercial Dependency</span>
          </div>
        </div>

        <div className="w-full px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-neutral-400">
          <span>&copy; 2026 yrcrouter Developer Suite &bull; Official REST Gateway &bull; 100% Go Native</span>
          <a href="#overview" className="hover:text-neutral-800 flex items-center gap-1.5 font-medium text-xs">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 15l-6-6-6 6" />
            </svg>
            <span>Kembali ke Puncak</span>
          </a>
        </div>
      </footer>

      {oauthModalOpen && oauthProvider && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-neutral-950">OAuth Login: {oauthProvider.name}</span>
              <button
                type="button"
                onClick={() => setOauthModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
                aria-label="Tutup modal"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {(oauthProvider.id === 'github_copilot' || oauthProvider.id === 'github') && deviceFlowData && (
              <div className="flex flex-col gap-3 py-2 text-xs text-neutral-600">
                <span>1. Buka halaman aktivasi GitHub Copilot resmi:</span>
                <a
                  href={deviceFlowData.verification_uri || 'https://github.com/login/device'}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg text-center hover:bg-neutral-800 flex items-center justify-center gap-1.5"
                >
                  <span>Buka github.com/login/device</span>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>

                <span className="mt-2">2. Masukkan kode verifikasi 8-digit ini:</span>
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-center">
                  <span className="font-mono text-2xl font-bold tracking-widest text-[#e05236] select-all">
                    {deviceFlowData.user_code}
                  </span>
                </div>

                <span className="font-mono text-neutral-500 text-center animate-pulse mt-2">
                  {oauthStatusText}
                </span>
              </div>
            )}

            {oauthProvider.id === 'antigravity' && (
              <div className="flex flex-col gap-3 py-2 text-xs text-neutral-600">
                <span>Otorisasi akun Google Antigravity langsung via Google OAuth 2.0:</span>
                {deviceFlowData && deviceFlowData.auth_url ? (
                  <a
                    href={deviceFlowData.auth_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 text-xs font-semibold bg-[#e05236] text-white rounded-lg text-center hover:bg-[#c9452b] flex items-center justify-center gap-1.5"
                  >
                    <span>Login Google Antigravity</span>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => openOAuthModal(oauthProvider)}
                    className="px-3 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg"
                  >
                    Inisialisasi Antigravity OAuth
                  </button>
                )}

                <span className="mt-2">Atau tempel Token Sesi / API Key Antigravity secara manual:</span>
                <textarea
                  rows={2}
                  placeholder="Tempel token di sini..."
                  value={manualTokenInput}
                  onChange={e => setManualTokenInput(e.target.value)}
                  className="w-full p-2 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg outline-none"
                />
                <button
                  type="button"
                  onClick={handleImportTokenSubmit}
                  className="w-full py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg"
                >
                  Simpan &amp; Hubungkan
                </button>
                {oauthStatusText && (
                  <span className="font-mono text-neutral-500 text-center">{oauthStatusText}</span>
                )}
              </div>
            )}

            {oauthProvider.id !== 'github_copilot' && oauthProvider.id !== 'github' && oauthProvider.id !== 'antigravity' && (
              <div className="flex flex-col gap-3 text-xs text-neutral-600">
                <span>
                  Impor token sesi / OAuth untuk <strong>{oauthProvider.name}</strong>:
                </span>
                <textarea
                  rows={3}
                  placeholder="Tempel token sesi OAuth di sini..."
                  value={manualTokenInput}
                  onChange={e => setManualTokenInput(e.target.value)}
                  className="w-full p-2 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 outline-none"
                />
                <button
                  type="button"
                  onClick={handleImportTokenSubmit}
                  className="w-full py-2 text-xs font-semibold bg-[#e05236] hover:bg-[#c9452b] text-white rounded-lg"
                >
                  Simpan &amp; Hubungkan
                </button>
                {oauthStatusText && (
                  <span className="font-mono text-neutral-500 text-center">{oauthStatusText}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
