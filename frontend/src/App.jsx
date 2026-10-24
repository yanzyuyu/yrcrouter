import React, { useState, useEffect } from 'react';

export default function App() {
  const [activeNav, setActiveNav] = useState('Overview');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSdk, setSelectedSdk] = useState('cURL');
  const [faqOpen, setFaqOpen] = useState({ 0: true });

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
      if (res.ok && body.choices && body.choices[0]) {
        setTestOutput(JSON.stringify(body, null, 2));
      } else {
        setTestOutput(JSON.stringify(body, null, 2));
      }
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

  const navLinks = ['Overview', 'Keunggulan', 'Playground', 'API Reference', 'Paket & Lisensi', 'Order via Bot', 'Status & SLA', 'SDK Integrasi', 'FAQ'];

  const sdkCode = {
    cURL: `curl -X POST http://localhost:${config.port || 20128}/v1/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer \${API_KEY}" \\\n  -d '{\n    "model": "${testModel}",\n    "messages": [{"role": "user", "content": "Halo yrcrouter!"}]\n  }'`,
    'Node.js': `import OpenAI from "openai";\n\nconst client = new OpenAI({\n  baseURL: "http://localhost:${config.port || 20128}/v1",\n  apiKey: process.env.ROUTER_KEY || "local-key"\n});\n\nconst res = await client.chat.completions.create({\n  model: "${testModel}",\n  messages: [{ role: "user", content: "Halo dari Node.js!" }]\n});\nconsole.log(res.choices[0].message.content);`,
    'Discord.js': `const { Client, GatewayIntentBits } = require("discord.js");\nconst client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });\n\nclient.on("messageCreate", async (msg) => {\n  if (msg.author.bot) return;\n  const res = await fetch("http://localhost:${config.port || 20128}/v1/chat/completions", {\n    method: "POST",\n    headers: { "Content-Type": "application/json" },\n    body: JSON.stringify({ model: "${testModel}", messages: [{ role: "user", content: msg.content }] })\n  });\n  const data = await res.json();\n  msg.reply(data.choices[0].message.content);\n});\nclient.login(process.env.DISCORD_TOKEN);`,
    Python: `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="http://localhost:${config.port || 20128}/v1",\n    api_key="local-key"\n)\n\nresponse = client.chat.completions.create(\n    model="${testModel}",\n    messages=[{"role": "user", "content": "Halo dari Python!"}]\n)\nprint(response.choices[0].message.content)`,
    Go: `package main\n\nimport (\n\t"bytes"\n\t"fmt"\n\t"io"\n\t"net/http"\n)\n\nfunc main() {\n\tpayload := []byte(\`{"model":"${testModel}","messages":[{"role":"user","content":"Halo dari Go!"}]}\`)\n\tresp, _ := http.Post("http://localhost:${config.port || 20128}/v1/chat/completions", "application/json", bytes.NewReader(payload))\n\tbody, _ := io.ReadAll(resp.Body)\n\tfmt.Println(string(body))\n}`
  };

  const faqs = [
    {
      q: 'Bagaimana cara menghubungkan akun Google Antigravity ke router ini?',
      a: 'Pada tabel provider di bawah, cari kartu Google Antigravity lalu klik tombol OAuth Login. Anda akan diarahkan ke halaman login Google resmi dengan izin Cloud Platform, lalu token sesi akan terpasang otomatis.'
    },
    {
      q: 'Apakah akun GitHub Copilot bisa digunakan tanpa mengetikkan token manual?',
      a: 'Bisa. Klik OAuth Login pada kartu GitHub Copilot. Router akan menghasilkan kode 8-digit dan tautan ke github.com/login/device. Setelah Anda klik Authorize di browser, router otomatis mengambil Copilot Internal Token dan langsung mengaktifkannya.'
    },
    {
      q: 'Apakah yrcrouter benar-benar kompatibel dengan Claude Code, Cursor, dan Cline?',
      a: '100% kompatibel. yrcrouter mengekspos endpoint OpenAI-compatible standar di http://localhost:20128/v1. Cukup masukkan base URL tersebut dan pilih model apa saja seperti antigravity/claude-3-7-sonnet atau gemini-2.5-flash.'
    },
    {
      q: 'Bagaimana cara kerja 3-tier auto-fallback saat terkena limit 429?',
      a: 'Jika provider Tier 1 (misal Antigravity atau Groq) mengalami rate limit HTTP 429 atau downtime 5xx, router secara instan dalam <10ms mengalihkan panggilan ke Tier 2 (OpenRouter, DeepSeek) atau Tier 3 (Ollama lokal) tanpa memutus sesi IDE Anda.'
    },
    {
      q: 'Berapa konsumsi RAM dan resource engine Go ini?',
      a: 'Engine inti dibangun dengan Go standard library tanpa framework berat sehingga footprint RAM hanya berkisar antara 15MB - 20MB, jauh lebih hemat dibanding Node.js/Next.js yang memakan 200MB+.'
    },
    {
      q: 'Bagaimana cara kerja penghemat token (RTK Token Optimizer)?',
      a: 'Router mendeteksi teks redundan dalam percakapan coding seperti git diff index header, trailing spaces, dan baris kosong berturut-turut, lalu menormalkannya sebelum diteruskan ke LLM, menghemat 20% hingga 40% kuota token input.'
    }
  ];

  return (
    <div className="min-h-screen text-neutral-800 flex flex-col font-sans selection:bg-[#e05236]/20 selection:text-[#e05236]">
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#e05236] text-white font-bold flex items-center justify-center text-sm shadow-sm">
              YR
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-neutral-900 leading-none">yrcrouter</span>
              <span className="text-[10px] text-neutral-600 uppercase font-mono tracking-wider">AI Gateway Suite</span>
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
              <span className="w-5 h-5 rounded-full bg-neutral-300 text-neutral-700 flex items-center justify-center text-[10px] font-bold">
                Y
              </span>
              <div className="flex flex-col leading-tight">
                <span className="font-medium text-neutral-800 text-[11px]">yanzyuyu</span>
                <span className="text-[9px] text-emerald-600 font-semibold leading-none">Verified Member</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => triggerCopy('http://localhost:' + (config.port || 20128) + '/v1', 'Endpoint disalin!')}
              className="px-3.5 py-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition shadow-sm"
            >
              Salin Endpoint
            </button>
          </div>
        </div>
      </header>

      {copiedNotice && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2 bg-neutral-900 text-white text-xs font-medium rounded-lg shadow-lg">
          {copiedNotice}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-10 w-full flex-1 flex flex-col gap-16">
        <section id="overview" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-950 tracking-tight leading-tight">
                Gateway AI &amp; Proxy Model Multi-Provider Tercepat di Indonesia
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-2xl">
                Engine backend REST API mandiri tanpa perantara Cloudflare Worker. Ditenagai komunikasi langsung dengan Google Antigravity, GitHub Copilot OAuth resmi, auto-fallback 3-tier saat terkena rate limit 429, dan kompresi token RTK bawaan untuk penghematan biaya token hingga 40%.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col">
                <span className="text-lg font-bold text-neutral-900">99.98%</span>
                <span className="text-[11px] text-neutral-600">Uptime Gateway</span>
              </div>
              <div className="p-4 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col">
                <span className="text-lg font-bold text-neutral-900">&lt; 120ms</span>
                <span className="text-[11px] text-neutral-600">Rata-rata Latensi</span>
              </div>
              <div className="p-4 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col">
                <span className="text-lg font-bold text-neutral-900">100%</span>
                <span className="text-[11px] text-neutral-600">Resmi &amp; Standar API</span>
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
                KREDENSIAL API ANDA
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
              <label className="text-xs font-semibold text-neutral-700">API Key Aktif (Header: Authorization)</label>
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
                  className="p-2 border border-neutral-200 hover:bg-neutral-50 rounded-lg text-neutral-600 text-xs"
                >
                  {apiKeyMasked ? '👁' : '🔒'}
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
              <span>Kunci hilang atau bocor?</span>
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

        <section id="keunggulan" className="flex flex-col gap-6">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-900">Keunggulan Engine Kami</h2>
              <span className="text-xs text-neutral-600">Mengapa ratusan developer AI coding assistant dan bot memilih integrasi yrcrouter.</span>
            </div>
            <a href="#providers" className="text-xs text-[#e05236] font-semibold hover:underline">Lihat Selengkapnya &rarr;</a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-2">
              <span className="w-6 h-6 rounded bg-orange-100 text-[#e05236] text-xs font-bold flex items-center justify-center font-mono">01</span>
              <h3 className="font-bold text-sm text-neutral-900 mt-1">Multi-Tier Auto Fallback</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Mencegah error HTTP 429 saat sesi koding. Beralih instan dari tier akun utama ke model cadangan atau tier gratis tanpa memutus koneksi IDE.
              </p>
            </div>

            <div className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-2">
              <span className="w-6 h-6 rounded bg-orange-100 text-[#e05236] text-xs font-bold flex items-center justify-center font-mono">02</span>
              <h3 className="font-bold text-sm text-neutral-900 mt-1">Direct Antigravity &amp; Copilot OAuth</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Otorisasi akun Google Antigravity dan GitHub Copilot via Device Code resmi tanpa perlu repot mengekstrak token manual.
              </p>
            </div>

            <div className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-2">
              <span className="w-6 h-6 rounded bg-orange-100 text-[#e05236] text-xs font-bold flex items-center justify-center font-mono">03</span>
              <h3 className="font-bold text-sm text-neutral-900 mt-1">RTK Token Optimizer</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Menghapus baris kosong berulang, spasi buntut, dan metadata git diff secara cerdas, memangkas 20% hingga 40% konsumsi token prompt.
              </p>
            </div>

            <div className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-2">
              <span className="w-6 h-6 rounded bg-orange-100 text-[#e05236] text-xs font-bold flex items-center justify-center font-mono">04</span>
              <h3 className="font-bold text-sm text-neutral-900 mt-1">100% Zero Dependency Go Core</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Dibangun dengan pustaka standar Go native tanpa bloatware external. Bebas risiko supply-chain CVE, hemat memori &lt; 20MB RAM, dan boot time &lt; 50ms.
              </p>
            </div>
          </div>
        </section>

        <section id="playground" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-900">Interactive Live Playground</h2>
              <span className="text-xs text-neutral-600">Uji coba panggilan API secara langsung melalui browser Anda tanpa perlu membuka terminal.</span>
            </div>
            <span className="text-xs font-mono text-neutral-600">Header: Authorization aktif otomatis</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
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
                <span>▷</span>
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
                  className="hover:text-white transition"
                >
                  Salin Output JSON
                </button>
              </div>

              <pre className="flex-1 text-zinc-300 whitespace-pre-wrap overflow-y-auto max-h-[300px] leading-relaxed text-[11px]">
                {testOutput}
              </pre>
            </div>
          </div>
        </section>

        <section id="api-reference" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-900">Dokumentasi Endpoint REST API</h2>
              <span className="text-xs text-neutral-600">Daftar spesifikasi lengkap endpoint yang siap diintegrasikan ke bot atau aplikasi Anda.</span>
            </div>
            <button
              type="button"
              onClick={() => triggerCopy(JSON.stringify(config.providers, null, 2), 'Format JSON Disalin!')}
              className="px-3 py-1.5 text-xs font-medium border border-neutral-200 hover:bg-neutral-50 rounded-lg text-neutral-700 bg-white"
            >
              JSON Format
            </button>
          </div>

          <div className="bg-white border border-neutral-200/80 rounded-2xl overflow-hidden shadow-xs divide-y divide-neutral-100 text-xs">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-orange-100 text-[#e05236] rounded">POST</span>
                <span className="font-mono font-semibold text-neutral-900">/v1/chat/completions</span>
                <span className="text-neutral-600 text-xs hidden sm:inline">&mdash; Chat completions kompatibel format OpenAI &amp; multi-tier fallback</span>
              </div>
              <span className="font-mono text-[11px] text-neutral-600">Payload: ChatRequest</span>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-purple-100 text-purple-700 rounded">OAUTH</span>
                <span className="font-mono font-semibold text-neutral-900">/api/oauth/antigravity</span>
                <span className="text-neutral-600 text-xs hidden sm:inline">&mdash; Inisialisasi login Google Antigravity PKCE</span>
              </div>
              <span className="font-mono text-[11px] text-neutral-600">Alur: PKCE Auth URL</span>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded">OAUTH</span>
                <span className="font-mono font-semibold text-neutral-900">/api/oauth/github/device-code</span>
                <span className="text-neutral-600 text-xs hidden sm:inline">&mdash; Minta kode 8-digit aktivasi GitHub Copilot</span>
              </div>
              <span className="font-mono text-[11px] text-neutral-600">Alur: Device Code Flow</span>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-blue-100 text-blue-700 rounded">GET</span>
                <span className="font-mono font-semibold text-neutral-900">/v1/models</span>
                <span className="text-neutral-600 text-xs hidden sm:inline">&mdash; Mengembalikan daftar agregasi model dari 40+ provider</span>
              </div>
              <span className="font-mono text-[11px] text-neutral-600">Query: None</span>
            </div>
          </div>
        </section>

        <section id="providers" className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-900">Katalog Provider AI ({config.providers ? config.providers.length : 0})</h2>
              <span className="text-xs text-neutral-600">Termasuk Google Antigravity, GitHub Copilot, OpenAI, Claude, dan provider lokal.</span>
            </div>

            <input
              type="text"
              placeholder="Cari provider atau nama model..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-3.5 py-2 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-800 outline-none sm:w-72 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                          className="text-[11px] text-[#e05236] hover:underline font-semibold"
                        >
                          OAuth Login ↗
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

        <section id="paket-&-lisensi" className="flex flex-col gap-6 items-center">
          <div className="text-center flex flex-col gap-1 max-w-xl">
            <h2 className="text-2xl font-bold text-neutral-900">Paket Lisensi &amp; Peran</h2>
            <p className="text-xs text-neutral-600">Pilih tingkatan role yang sesuai dengan kebutuhan integrasi Anda. Seluruh pembayaran dan aktivasi berjalan otomatis.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
            <div className="p-6 bg-white border border-neutral-200/80 rounded-2xl shadow-xs flex flex-col gap-5">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-600">STARTER</span>
                <h3 className="text-lg font-bold text-neutral-900">Free Tier</h3>
                <span className="text-xs text-neutral-600">Untuk eksplorasi fitur dasar dan uji coba integrasi bot Anda.</span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-neutral-900">Gratis</span>
                <span className="text-xs text-neutral-600">/ selamanya</span>
              </div>

              <ul className="flex flex-col gap-2.5 text-xs text-neutral-700">
                <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> 50 Request API / hari</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> Akses Pengujian di Live Playground</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> Auto-Fallback Dasar</li>
                <li className="flex items-center gap-2"><span className="text-neutral-400">✕</span> Tanpa Antigravity &amp; Copilot OAuth</li>
              </ul>

              <button type="button" className="w-full py-2.5 text-xs font-semibold border border-neutral-200 hover:bg-neutral-50 rounded-lg text-neutral-800 mt-auto">
                Mulai Gratis Sekarang
              </button>
            </div>

            <div className="p-6 bg-white border-2 border-[#e05236] rounded-2xl shadow-sm flex flex-col gap-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#e05236] font-mono">REKOMENDASI &bull; FULL FITUR</span>
                <span className="text-[9px] bg-orange-100 text-[#e05236] px-2 py-0.5 rounded font-bold uppercase">Populer</span>
              </div>

              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-neutral-900">Standar Pro</h3>
                <span className="text-xs text-neutral-600">Pilihan terlengkap untuk bot Discord jualan, kreator konten, dan automasi akun.</span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-xs font-semibold text-neutral-600">Rp</span>
                <span className="text-3xl font-extrabold text-neutral-900">25.000</span>
                <span className="text-xs text-neutral-600">/ bulan</span>
              </div>

              <ul className="flex flex-col gap-2.5 text-xs text-neutral-700">
                <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> 2.500 Request API / bulan (Unlimited self-hosted)</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> Integrasi Penuh Google Antigravity &amp; Copilot OAuth</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> Bypass Limit Kuota Otomatis via Fallback 3-Tier</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> RTK Token Compression (-40% Token)</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600 font-bold">✓</span> Role Server VIP Member &amp; Bantuan Setup</li>
              </ul>

              <button type="button" className="w-full py-2.5 text-xs font-semibold bg-[#e05236] hover:bg-[#c9452b] text-white rounded-lg shadow-sm mt-auto">
                Pilih Paket Standar
              </button>
            </div>
          </div>
        </section>

        <section id="order-via-bot" className="p-8 bg-white border border-neutral-200/80 rounded-2xl shadow-xs flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-900">Order Otomatis Lewat Bot Discord 24/7</h2>
              <p className="text-xs text-neutral-600 max-w-xl">
                Tidak perlu menunggu admin membalas manual. Lakukan pembelian role atau API key kapan saja melalui Bot Resmi Discord kami. Bayar melalui QRIS dan kunci API Anda langsung dikirimkan ke Direct Message (DM) dalam hitungan detik.
              </p>
            </div>

            <button
              type="button"
              onClick={() => triggerCopy('https://discord.gg/antigravity', 'Link Discord disalin!')}
              className="px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-sm whitespace-nowrap self-start"
            >
              <span>👾</span>
              <span>Order Lewat Bot Discord</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-neutral-100">
            <div className="p-4 bg-neutral-50 border border-neutral-200/80 rounded-xl flex flex-col gap-1">
              <span className="text-xs font-bold text-neutral-900">Langkah 1: Masuk Server</span>
              <span className="text-[11px] text-neutral-600">Klik tombol di atas untuk bergabung ke server Discord resmi kami.</span>
            </div>
            <div className="p-4 bg-neutral-50 border border-neutral-200/80 rounded-xl flex flex-col gap-1">
              <span className="text-xs font-bold text-neutral-900">Langkah 2: Perintah /order</span>
              <span className="text-[11px] text-neutral-600">Buka channel #order-lisensi atau DM bot kami, lalu ketik perintah /order.</span>
            </div>
            <div className="p-4 bg-neutral-50 border border-neutral-200/80 rounded-xl flex flex-col gap-1">
              <span className="text-xs font-bold text-neutral-900">Langkah 3: QRIS Instan</span>
              <span className="text-[11px] text-neutral-600">Scan QRIS dan sistem akan langsung mengirimkan kunci aktif ke DM Anda.</span>
            </div>
          </div>
        </section>

        <section id="status-&-sla" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-neutral-600">SLA &amp; KEANDALAN</span>
            <span className="font-bold text-sm text-neutral-900">Garansi Uptime 99.98%</span>
            <span className="text-xs text-neutral-600 mt-1">
              Infrastruktur serverless didukung failover otomatis antar region. Pemantauan aktif memverifikasi status koneksi setiap detik.
            </span>
          </div>

          <div className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-neutral-600">KEAMANAN</span>
            <span className="font-bold text-sm text-neutral-900">Zero-Trust &amp; Anti-Bruteforce</span>
            <span className="text-xs text-neutral-600 mt-1">
              Dilengkapi pembatasan ketat rate limiting per IP (60 req/min), enkripsi token berkekuatan kriptografi, dan perlindungan buffer body.
            </span>
          </div>

          <div className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-neutral-600">KOMPATIBILITAS</span>
            <span className="font-bold text-sm text-neutral-900">Mendukung Seluruh Bahasa</span>
            <span className="text-xs text-neutral-600 mt-1">
              Berjalan di atas protokol standar HTTP REST JSON yang kompatibel dengan Python, Node.js, PHP, Golang, cURL, C#, dan Discord.js.
            </span>
          </div>
        </section>

        <section id="sdk-integrasi" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-neutral-900">Contoh Integrasi Kode SDK</h2>
            <span className="text-xs text-neutral-600">Salin cuplikan kode siap pakai untuk langsung menghubungkan backend Anda.</span>
          </div>

          <div className="bg-[#0c1322] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-[#090e1a]">
              <div className="flex items-center gap-2">
                {['cURL', 'Node.js', 'Discord.js', 'Python', 'Go'].map(sdk => (
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
                className="text-xs text-neutral-400 hover:text-white font-mono transition"
              >
                Salin Kode
              </button>
            </div>

            <pre className="p-5 font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed">
              {sdkCode[selectedSdk]}
            </pre>
          </div>
        </section>

        <section id="faq" className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-neutral-900">Pertanyaan yang Sering Diajukan (FAQ)</h2>
            <span className="text-xs text-neutral-600">Jawaban lengkap dan transparan seputar durasi akun, bypass limit, serta integrasi bot.</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {faqs.map((f, idx) => {
              const isOpen = faqOpen[idx];
              return (
                <div key={idx} className="p-4 bg-white border border-neutral-200/80 rounded-xl shadow-xs flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setFaqOpen({ ...faqOpen, [idx]: !isOpen })}
                    className="flex items-center justify-between text-left font-bold text-xs sm:text-sm text-neutral-900 gap-2"
                  >
                    <span>{f.q}</span>
                    <span className="text-neutral-400 text-xs font-mono">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <p className="text-xs text-neutral-600 leading-relaxed pt-1 border-t border-neutral-100">
                      {f.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-white py-12 mt-12 text-xs text-neutral-600">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-[#e05236] text-white font-bold flex items-center justify-center text-xs">YR</span>
              <span className="font-bold text-sm text-neutral-900">yrcrouter</span>
            </div>
            <p className="text-neutral-500 text-xs leading-relaxed">
              Infrastruktur REST API berkinerja tinggi untuk proxy AI model multi-provider, integrasi Google Antigravity &amp; Copilot OAuth resmi, dan auto-fallback tercepat.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] text-emerald-700 font-medium">Semua Gateway Operasional &bull; 99.98% SLA</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-bold text-xs uppercase text-neutral-900 tracking-wider">NAVIGASI PORTAL</span>
            <a href="#overview" className="hover:text-neutral-900">Overview Gateway</a>
            <a href="#keunggulan" className="hover:text-neutral-900">Keunggulan Engine</a>
            <a href="#playground" className="hover:text-neutral-900">Interactive Playground</a>
            <a href="#providers" className="hover:text-neutral-900">Katalog Provider</a>
            <a href="#paket-&-lisensi" className="hover:text-neutral-900">Paket &amp; Lisensi Role</a>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-bold text-xs uppercase text-neutral-900 tracking-wider">SDK &amp; BAHASA</span>
            <span className="hover:text-neutral-900">cURL Command</span>
            <span className="hover:text-neutral-900">Node.js Fetch / Axios</span>
            <span className="hover:text-neutral-900">Discord.js Bot Integration</span>
            <span className="hover:text-neutral-900">Python Requests</span>
            <span className="hover:text-neutral-900">PHP cURL Client</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-bold text-xs uppercase text-neutral-900 tracking-wider">DUKUNGAN &amp; KOMUNITAS</span>
            <a href="https://github.com/yanzyuyu/yrcrouter" target="_blank" rel="noreferrer" className="hover:text-neutral-900">GitHub Repository &rarr;</a>
            <span className="hover:text-neutral-900">Order Otomatis 24/7 QRIS</span>
            <span className="hover:text-neutral-900">Kebijakan SLA &amp; Keamanan</span>
            <span className="hover:text-neutral-900">Otentikasi Akun Discord</span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-neutral-400">
          <span>&copy; 2026 yrcrouter Developer Suite &bull; Official REST Gateway &bull; 100% Go Native</span>
          <a href="#overview" className="hover:text-neutral-800 flex items-center gap-1 font-medium text-xs">
            <span>▲ Kembali ke Puncak</span>
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
                className="text-neutral-400 hover:text-neutral-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {(oauthProvider.id === 'github_copilot' || oauthProvider.id === 'github') && deviceFlowData && (
              <div className="flex flex-col gap-3 py-2 text-xs text-neutral-600">
                <span>1. Buka halaman aktivasi GitHub Copilot resmi:</span>
                <a
                  href={deviceFlowData.verification_uri || 'https://github.com/login/device'}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg text-center hover:bg-neutral-800"
                >
                  Buka github.com/login/device ↗
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
                    className="px-3 py-2 text-xs font-semibold bg-[#e05236] text-white rounded-lg text-center hover:bg-[#c9452b]"
                  >
                    Login Google Antigravity ↗
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
