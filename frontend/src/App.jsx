import React, { useState, useEffect } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('providers');
  const [selectedCategory, setSelectedCategory] = useState('All');
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
    default_model: 'gemini-2.5-flash',
    providers: []
  });
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKey, setEditingKey] = useState({});
  const [keyVisible, setKeyVisible] = useState({});

  const [testModel, setTestModel] = useState('gemini-2.5-flash');
  const [testPrompt, setTestPrompt] = useState('Jelaskan keunggulan yrcrouter dalam 2 poin teknis.');
  const [testOutput, setTestOutput] = useState('Menunggu eksekusi prompt uji coba...');
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState('Siap');

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
      setTestStatus('Koneksi terputus');
    }
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
      setTestStatus('Gagal menyimpan');
    }
  }

  async function handleTestSubmit(e) {
    e.preventDefault();
    if (!testModel || !testPrompt) return;

    setTestLoading(true);
    setTestStatus('Mengirim...');
    setTestOutput('');

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
      setTestStatus('HTTP ' + res.status);
      if (res.ok && body.choices && body.choices[0]) {
        setTestOutput(body.choices[0].message.content);
      } else {
        setTestOutput(JSON.stringify(body, null, 2));
      }
    } catch (err) {
      setTestStatus('Gagal');
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

  function formatUptime(seconds) {
    if (!seconds) return '0s';
    if (seconds < 60) return seconds + 's';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return m + 'm ' + s + 's';
    const h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded bg-cyan-600 text-zinc-950 font-bold flex items-center justify-center text-sm">
              YR
            </span>
            <div className="flex flex-col">
              <span className="font-semibold text-base tracking-tight leading-none">yrcrouter</span>
              <span className="text-xs text-zinc-400 font-mono">multi-provider ai gateway</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex px-2.5 py-1 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-300">
              http://localhost:{config.port || 20128}/v1
            </span>
            <button
              type="button"
              onClick={fetchData}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-200 transition"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1 flex flex-col gap-6">
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Total Permintaan</span>
            <span className="text-xl font-mono font-bold text-zinc-100 mt-1">{metrics.total_requests}</span>
          </div>
          <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Berhasil</span>
            <span className="text-xl font-mono font-bold text-emerald-400 mt-1">{metrics.success_requests}</span>
          </div>
          <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Gagal</span>
            <span className="text-xl font-mono font-bold text-rose-400 mt-1">{metrics.failed_requests}</span>
          </div>
          <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Fallback Dipicu</span>
            <span className="text-xl font-mono font-bold text-amber-400 mt-1">{metrics.fallback_hits}</span>
          </div>
          <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Token Hemat</span>
            <span className="text-xl font-mono font-bold text-cyan-400 mt-1">{metrics.saved_tokens_est}</span>
          </div>
          <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Uptime</span>
            <span className="text-xl font-mono font-bold text-zinc-300 mt-1">{formatUptime(metrics.uptime_seconds)}</span>
          </div>
        </section>

        <nav className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('providers')}
            className={'px-3 py-1.5 text-sm font-medium rounded transition ' + (activeTab === 'providers' ? 'bg-zinc-800 text-cyan-300 border border-zinc-700' : 'text-zinc-400 hover:text-zinc-200')}
          >
            Penyedia Layanan ({config.providers ? config.providers.length : 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('playground')}
            className={'px-3 py-1.5 text-sm font-medium rounded transition ' + (activeTab === 'playground' ? 'bg-zinc-800 text-cyan-300 border border-zinc-700' : 'text-zinc-400 hover:text-zinc-200')}
          >
            Test Playground
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={'px-3 py-1.5 text-sm font-medium rounded transition ' + (activeTab === 'logs' ? 'bg-zinc-800 text-cyan-300 border border-zinc-700' : 'text-zinc-400 hover:text-zinc-200')}
          >
            Lalu Lintas ({logs.length})
          </button>
        </nav>

        {activeTab === 'providers' && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={'px-2.5 py-1 text-xs rounded border transition whitespace-nowrap ' + (selectedCategory === cat ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800 font-medium' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200')}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Cari provider atau model..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-200 outline-none focus:border-cyan-600 sm:w-64"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProviders.map(p => {
                const isKeyOpen = keyVisible[p.id];
                return (
                  <article key={p.id} className="p-4 bg-zinc-900/90 border border-zinc-800 rounded flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-zinc-100">{p.name}</span>
                        <span className="text-[11px] text-zinc-400 font-mono truncate max-w-[200px]">{p.base_url}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          Tier {p.tier}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateProvider(p.id, { enabled: !p.enabled })}
                          className={'px-2 py-0.5 text-[10px] font-bold rounded transition ' + (p.enabled ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-zinc-800 text-zinc-500 border border-zinc-700')}
                        >
                          {p.enabled ? 'AKTIF' : 'OFF'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">API Key</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type={isKeyOpen ? 'text' : 'password'}
                          placeholder="Masukkan token..."
                          value={editingKey[p.id] !== undefined ? editingKey[p.id] : (p.api_key || '')}
                          onChange={e => setEditingKey({ ...editingKey, [p.id]: e.target.value })}
                          className="flex-1 px-2.5 py-1 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded text-zinc-200 outline-none focus:border-cyan-600"
                        />
                        <button
                          type="button"
                          onClick={() => setKeyVisible({ ...keyVisible, [p.id]: !isKeyOpen })}
                          className="px-2 py-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 border border-zinc-700"
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
                            className="px-2 py-1 text-[11px] bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-bold rounded"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-zinc-800/80">
                      {p.models.map(m => (
                        <span key={m} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-950 text-zinc-400 border border-zinc-800">
                          {m}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'playground' && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleTestSubmit} className="p-5 bg-zinc-900/90 border border-zinc-800 rounded flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold text-zinc-100">Live Router Playground</h2>
                <span className="text-xs text-zinc-400">Kirim prompt uji coba melalui pipeline fallback router lokal</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-300">Model Target</label>
                <input
                  type="text"
                  value={testModel}
                  onChange={e => setTestModel(e.target.value)}
                  className="px-3 py-2 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded text-zinc-100 outline-none focus:border-cyan-600"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-300">Pesan Prompt</label>
                <textarea
                  rows={5}
                  value={testPrompt}
                  onChange={e => setTestPrompt(e.target.value)}
                  className="px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded text-zinc-100 outline-none focus:border-cyan-600 resize-none font-sans"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="submit"
                  disabled={testLoading}
                  className="px-4 py-2 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-zinc-950 rounded transition"
                >
                  {testLoading ? 'Memproses...' : 'Kirim Permintaan'}
                </button>
                <span className="text-xs font-mono text-zinc-400">{testStatus}</span>
              </div>
            </form>

            <div className="p-5 bg-zinc-900/90 border border-zinc-800 rounded flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Respon LLM</span>
              <pre className="flex-1 p-3 bg-zinc-950 border border-zinc-800 rounded font-mono text-xs text-zinc-200 whitespace-pre-wrap overflow-y-auto max-h-[320px]">
                {testOutput}
              </pre>
            </div>
          </section>
        )}

        {activeTab === 'logs' && (
          <section className="p-4 bg-zinc-900/90 border border-zinc-800 rounded flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-zinc-100">Riwayat Lalu Lintas Terakhir</h2>
              <span className="text-xs text-zinc-400">100 request terakhir yang diproses oleh gateway lokal</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-500">
                    <th className="py-2 px-3">Waktu</th>
                    <th className="py-2 px-3">Model</th>
                    <th className="py-2 px-3">Provider</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Latensi</th>
                    <th className="py-2 px-3">Hemat</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        Belum ada request yang tercatat
                      </td>
                    </tr>
                  ) : (
                    logs.map(l => (
                      <tr key={l.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/40">
                        <td className="py-2.5 px-3 font-mono text-zinc-400">{l.timestamp}</td>
                        <td className="py-2.5 px-3 font-mono text-zinc-200">{l.model}</td>
                        <td className="py-2.5 px-3 text-zinc-300">{l.provider || '-'}</td>
                        <td className="py-2.5 px-3">
                          <span className={'px-1.5 py-0.5 text-[10px] font-mono font-bold rounded ' + (l.status_code >= 200 && l.status_code < 300 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800')}>
                            {l.status_code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-400">{l.latency_ms}ms</td>
                        <td className="py-2.5 px-3 font-mono text-cyan-400">{l.saved_bytes > 0 ? l.saved_bytes + ' B' : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <footer className="border-t border-zinc-800 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-2">
          <span>yrcrouter &bull; Go Core Engine + React 19 / Tailwind v4</span>
          <span>Kompatibel dengan Claude Code, Cursor, Cline, Copilot</span>
        </div>
      </footer>
    </div>
  );
}
