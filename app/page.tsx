"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Bot = { id: string; name: string; description?: string; chat_id: string; enabled: boolean; rate_limit: number; created_at: string; total_messages?: number; messages_today?: number };
type MsgLog = {
  id: string;
  bot_id: string;
  bot_name: string;
  chat_id: string;
  message: string;
  parse_mode?: string;
  status: string;
  tg_message_id?: number;
  error?: string;
  ip?: string;
  created_at: string;
};
type Template = { id: string; name: string; content: string; parse_mode: string; bot_id?: string; bot_name?: string; usage_count: number; variables: string[]; created_at: string };
type TrackerCfg = { id: string; name: string; tracker_key: string; bot_id?: string; bot_name?: string; notify_events: string[]; allowed_origins: string[]; enabled: boolean; total_events: number; events_today: number; created_at: string };
type TrackerEvent = { id: string; tracker_name?: string; event_type: string; url?: string; ip?: string; ua?: string; session_id?: string; data: Record<string, unknown>; created_at: string };
type ActivityLog = { id: string; log_type: string; action: string; bot_name?: string; endpoint: string; method: string; status?: number; duration_ms?: number; ip?: string; details: Record<string, unknown>; created_at: string };
type Stats = { bots: { total: number; active: number; inactive: number }; messages: { total: number; today: number; week: number; failed_today: number }; tracker: { active: number; events_today: number }; logs: { total: number } };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtShort(d: string) {
  return new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function truncate(s: string, n = 60) { return s.length > n ? s.slice(0, n) + "…" : s; }

// ─── Toast ────────────────────────────────────────────────────────────────────
type Toast = { id: number; msg: string; type: "ok" | "err" | "info" };
let _tid = 0;

function Toasts({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => remove(t.id)} style={{ cursor: "pointer" }}>
          {t.type === "ok" ? "✅" : t.type === "err" ? "❌" : "ℹ️"} {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={wide ? { maxWidth: 620 } : {}}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Snippet generator ────────────────────────────────────────────────────────
function makeSnippet(key: string, baseUrl: string) {
  return `<!-- GeoTracker v2 by Geotama Backend -->
<script>
(function(w,d){
  var E='${baseUrl}/api/tracker',K='${key}';
  var SID='gt_'+Math.random().toString(36).slice(2,9);
  var MSK=['password','passwd','token','secret','key','card','cvv','pin','otp'];
  function mask(o){if(!o||typeof o!=='object')return o;var r={};for(var k in o){r[k]=MSK.some(function(m){return k.toLowerCase().indexOf(m)>-1})?'***':o[k];}return r;}
  function send(ev,data){
    var p=JSON.stringify({event:ev,url:w.location.href,referrer:d.referrer,session_id:SID,data:mask(data||{})});
    var b=new Blob([p],{type:'application/json'});
    (w.navigator.sendBeacon&&w.navigator.sendBeacon(E+'?k='+K,b))||fetch(E,{method:'POST',headers:{'Content-Type':'application/json','x-tracker-key':K},body:p,keepalive:true}).catch(function(){});
  }
  // Auto: page view
  send('page_view',{title:d.title});
  // Auto: form submits (dengan masking password)
  d.addEventListener('submit',function(e){
    var f=e.target,fd={};
    [].forEach.call(f.elements,function(el){if(el.name&&el.type!=='submit')fd[el.name]=el.value;});
    send('form_submit',{form_id:f.id||null,action:f.action,fields:mask(fd)});
  },true);
  // Auto: klik tombol & link
  d.addEventListener('click',function(e){
    var el=e.target.closest('button,a,[data-track]');
    if(!el)return;
    send('click',{tag:el.tagName.toLowerCase(),text:(el.innerText||'').slice(0,50),href:el.href||null,id:el.id||null});
  },true);
  // Auto: JS errors
  w.addEventListener('error',function(e){send('js_error',{message:e.message,file:e.filename,line:e.lineno});});
  // Manual: window.GeoTracker.track('custom_event', {key:'value'})
  w.GeoTracker={track:send};
})(window,document);
</script>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Page() {
  const [adminKey, setAdminKey] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMsgs, setRecentMsgs] = useState<MsgLog[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [messages, setMessages] = useState<MsgLog[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [trackers, setTrackers] = useState<TrackerCfg[]>([]);
  const [trackerEvents, setTrackerEvents] = useState<TrackerEvent[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // Toast helpers
  const toast = useCallback((msg: string, type: "ok" | "err" | "info" = "ok") => {
    const id = ++_tid;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  const removeToast = (id: number) => setToasts(p => p.filter(t => t.id !== id));

  // Auth check on load
  useEffect(() => {
    const saved = sessionStorage.getItem("gt_admin_key");
    if (saved) { setAdminKey(saved); setAuthed(true); }
  }, []);

  // API helper
  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const res = await fetch(path, { ...opts, headers: { "x-admin-key": adminKey, "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
    const data = await res.json();
    if (!data.ok && data.error) throw new Error(data.error);
    return data;
  }, [adminKey]);

  // Login
  const login = async () => {
    setAuthLoading(true); setAuthErr("");
    try {
      const res = await fetch("/api/admin/bots", { headers: { "x-admin-key": inputKey } });
      if (res.status === 401) { setAuthErr("Admin key salah."); return; }
      sessionStorage.setItem("gt_admin_key", inputKey);
      setAdminKey(inputKey); setAuthed(true);
    } catch { setAuthErr("Tidak bisa terhubung ke server."); }
    finally { setAuthLoading(false); }
  };

  // Load data per tab
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api("/api/admin/stats");
      setStats(d.stats);
      setRecentMsgs(d.recent_messages ?? []);
    } catch (e: unknown) { toast((e as Error).message, "err"); }
    finally { setLoading(false); }
  }, [api, toast]);

  const loadBots = useCallback(async () => {
    setLoading(true);
    try { const d = await api("/api/admin/bots"); setBots(d.bots); }
    catch (e: unknown) { toast((e as Error).message, "err"); }
    finally { setLoading(false); }
  }, [api, toast]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try { const d = await api("/api/admin/messages?limit=100"); setMessages(d.messages); }
    catch (e: unknown) { toast((e as Error).message, "err"); }
    finally { setLoading(false); }
  }, [api, toast]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try { const d = await api("/api/admin/templates"); setTemplates(d.templates); }
    catch (e: unknown) { toast((e as Error).message, "err"); }
    finally { setLoading(false); }
  }, [api, toast]);

  const loadTrackers = useCallback(async () => {
    setLoading(true);
    try {
      const [tc, te] = await Promise.all([api("/api/admin/tracker"), api("/api/admin/tracker/events?limit=50")]);
      setTrackers(tc.trackers); setTrackerEvents(te.events);
    } catch (e: unknown) { toast((e as Error).message, "err"); }
    finally { setLoading(false); }
  }, [api, toast]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try { const d = await api("/api/admin/logs?limit=100"); setLogs(d.logs); }
    catch (e: unknown) { toast((e as Error).message, "err"); }
    finally { setLoading(false); }
  }, [api, toast]);

  useEffect(() => {
    if (!authed) return;
    if (tab === "dashboard") loadDashboard();
    else if (tab === "bots") loadBots();
    else if (tab === "messages") loadMessages();
    else if (tab === "templates") loadTemplates();
    else if (tab === "tracker") loadTrackers();
    else if (tab === "logs") loadLogs();
  }, [tab, authed, loadDashboard, loadBots, loadMessages, loadTemplates, loadTrackers, loadLogs]);

  // ── Login Screen ───────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🤖</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Geotama Backend</h1>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Admin Dashboard v2.0</p>
          </div>
          <div className="form-group">
            <label className="form-label">Master Admin Key</label>
            <input type="password" placeholder="Masukkan x-admin-key…" value={inputKey}
              onChange={e => setInputKey(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} autoFocus />
          </div>
          {authErr && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>⚠️ {authErr}</p>}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}
            onClick={login} disabled={authLoading || !inputKey}>
            {authLoading ? <span className="spin">⏳</span> : "Masuk →"}
          </button>
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 16 }}>
            Set MASTER_API_KEY di environment Vercel
          </p>
        </div>
      </div>
    );
  }

  // ── Main Layout ────────────────────────────────────────────────────────────
  const NAV = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "bots", icon: "🤖", label: "Bot Manager" },
    { id: "messages", icon: "💬", label: "Riwayat Pesan" },
    { id: "templates", icon: "📋", label: "Templates" },
    { id: "tracker", icon: "📡", label: "Web Tracker" },
    { id: "logs", icon: "📝", label: "Activity Logs" },
    { id: "playground", icon: "🧪", label: "Playground" },
    { id: "docs", icon: "📖", label: "API Docs" },
  ];

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">Geo<span>tama</span> Backend</div>
        <nav className="sidebar-nav">
          <div className="sidebar-section">Main</div>
          {NAV.slice(0, 3).map(n => (
            <button key={n.id} className={`nav-item ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
          <div className="sidebar-section">Tools</div>
          {NAV.slice(3).map(n => (
            <button key={n.id} className={`nav-item ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1e293b" }}>
          <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", color: "#94a3b8", borderColor: "#1e293b" }}
            onClick={() => { sessionStorage.removeItem("gt_admin_key"); setAuthed(false); setAdminKey(""); }}>
            🚪 Keluar
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">{NAV.find(n => n.id === tab)?.icon} {NAV.find(n => n.id === tab)?.label}</div>
            <div className="topbar-sub">{baseUrl}</div>
          </div>
          <div className="row">
            <a href="/api/health" target="_blank" className="btn btn-ghost btn-sm">🏥 Health</a>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              if (tab === "dashboard") loadDashboard();
              else if (tab === "bots") loadBots();
              else if (tab === "messages") loadMessages();
              else if (tab === "templates") loadTemplates();
              else if (tab === "tracker") loadTrackers();
              else if (tab === "logs") loadLogs();
            }}>🔄 Refresh</button>
          </div>
        </div>

        <div className="content">
          {tab === "dashboard" && <DashboardTab stats={stats} msgs={recentMsgs} loading={loading} />}
          {tab === "bots" && <BotsTab bots={bots} loading={loading} reload={loadBots} api={api} toast={toast} />}
          {tab === "messages" && <MessagesTab msgs={messages} loading={loading} reload={loadMessages} api={api} toast={toast} />}
          {tab === "templates" && <TemplatesTab templates={templates} bots={bots} loading={loading} reload={loadTemplates} api={api} toast={toast} />}
          {tab === "tracker" && <TrackerTab trackers={trackers} events={trackerEvents} loading={loading} reload={loadTrackers} api={api} toast={toast} baseUrl={baseUrl} />}
          {tab === "logs" && <LogsTab logs={logs} loading={loading} reload={loadLogs} api={api} toast={toast} />}
          {tab === "playground" && <PlaygroundTab bots={bots} loadBots={loadBots} api={api} toast={toast} />}
          {tab === "docs" && <DocsTab baseUrl={baseUrl} />}
        </div>
      </main>

      <Toasts toasts={toasts} remove={removeToast} />
    </div>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ stats, msgs, loading }: { stats: Stats | null; msgs: MsgLog[]; loading: boolean }) {
  if (loading) return <div className="loading"><span className="spin">⏳</span> Memuat data...</div>;
  if (!stats) return <div className="loading text-muted">Tidak ada data.</div>;
  return (
    <div>
      <div className="stat-grid">
        {[
          { label: "Total Bot", value: stats.bots.total, sub: `${stats.bots.active} aktif`, icon: "🤖", color: "#6366f1" },
          { label: "Pesan Hari Ini", value: stats.messages.today, sub: `Total: ${stats.messages.total}`, icon: "💬", color: "#22c55e" },
          { label: "Pesan Minggu Ini", value: stats.messages.week, sub: `Gagal hari ini: ${stats.messages.failed_today}`, icon: "📈", color: "#3b82f6" },
          { label: "Tracker Events", value: stats.tracker.events_today, sub: `${stats.tracker.active} tracker aktif`, icon: "📡", color: "#f59e0b" },
          { label: "Error Hari Ini", value: stats.messages.failed_today, sub: "Pesan gagal", icon: "⚠️", color: "#ef4444" },
          { label: "Total Log", value: stats.logs.total, sub: "Semua aktivitas", icon: "📝", color: "#8b5cf6" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value.toLocaleString()}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-header"><span className="section-title">📩 Pesan Terbaru</span></div>
        {msgs.length === 0 ? <div className="empty-state"><div className="icon">💬</div>Belum ada pesan.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Bot</th><th>Chat ID</th><th>Pesan</th><th>Status</th><th>Waktu</th></tr></thead>
              <tbody>{msgs.map(m => (
                <tr key={m.id}>
                  <td><span className="badge badge-blue">{m.bot_name}</span></td>
                  <td><code>{m.chat_id}</code></td>
                  <td className="truncate" style={{ maxWidth: 200 }}>{truncate(m.message, 50)}</td>
                  <td><span className={`badge ${m.status === "sent" ? "badge-green" : "badge-red"}`}>{m.status}</span></td>
                  <td className="text-muted text-sm">{fmtShort(m.created_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bots Tab ──────────────────────────────────────────────────────────────────
function BotsTab({ bots, loading, reload, api, toast }: { bots: Bot[]; loading: boolean; reload: () => void; api: (p: string, o?: RequestInit) => Promise<Record<string, unknown>>; toast: (m: string, t?: "ok"|"err"|"info") => void }) {
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editBot, setEditBot] = useState<Bot | null>(null);
  const [form, setForm] = useState({ name: "", botToken: "", chatId: "", description: "", rateLimit: "60" });
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [keyResult, setKeyResult] = useState<{ bot: { name: string }; apiKey: string } | null>(null);

  const openAdd = () => { setForm({ name: "", botToken: "", chatId: "", description: "", rateLimit: "60" }); setModal("add"); };
  const openEdit = (b: Bot) => { setEditBot(b); setForm({ name: b.name, botToken: "", chatId: b.chat_id, description: b.description ?? "", rateLimit: String(b.rate_limit) }); setModal("edit"); };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === "add") {
        const d = await api("/api/admin/bots", { method: "POST", body: JSON.stringify({ name: form.name, botToken: form.botToken, chatId: form.chatId, description: form.description, rateLimit: Number(form.rateLimit) }) });
        setKeyResult(d as { bot: { name: string }; apiKey: string });
        toast(`Bot "${form.name}" berhasil dibuat!`);
      } else if (editBot) {
        await api(`/api/admin/bots/${editBot.id}`, { method: "PATCH", body: JSON.stringify({ name: form.name, chatId: form.chatId, description: form.description, rateLimit: Number(form.rateLimit), ...(form.botToken ? { botToken: form.botToken } : {}) }) });
        toast("Bot berhasil diperbarui!");
        setModal(null);
      }
      reload();
    } catch (e: unknown) { toast((e as Error).message, "err"); }
    finally { setSaving(false); }
  };

  const toggleEnabled = async (b: Bot) => {
    try { await api(`/api/admin/bots/${b.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !b.enabled }) }); toast(`Bot "${b.name}" ${b.enabled ? "dinonaktifkan" : "diaktifkan"}.`); reload(); }
    catch (e: unknown) { toast((e as Error).message, "err"); }
  };

  const deleteBot = async (b: Bot) => {
    if (!confirm(`Hapus bot "${b.name}"? Semua riwayat pesan juga akan terhapus!`)) return;
    try { await api(`/api/admin/bots/${b.id}`, { method: "DELETE" }); toast(`Bot "${b.name}" dihapus.`); reload(); }
    catch (e: unknown) { toast((e as Error).message, "err"); }
  };

  const rotateKey = async (b: Bot) => {
    if (!confirm(`Rotate API key bot "${b.name}"? API key lama langsung tidak berlaku!`)) return;
    try { const d = await api(`/api/admin/bots/${b.id}/rotate-key`, { method: "POST" }); setKeyResult(d as { bot: { name: string }; apiKey: string }); toast("API key baru berhasil dibuat!"); }
    catch (e: unknown) { toast((e as Error).message, "err"); }
  };

  const testBot = async (b: Bot) => {
    try { const d = await api(`/api/admin/bots/${b.id}/test`, { method: "POST", body: "{}" }); setTestResult(d as Record<string, unknown>); toast("Test berhasil!"); }
    catch (e: unknown) { toast((e as Error).message, "err"); }
  };

  if (loading) return <div className="loading"><span className="spin">⏳</span> Memuat bot...</div>;

  return (
    <div>
      <div className="section-header">
        <span className="section-title">🤖 Bot Manager <span className="badge badge-gray">{bots.length}</span></span>
        <button className="btn btn-primary" onClick={openAdd}>+ Tambah Bot</button>
      </div>

      {bots.length === 0 ? (
        <div className="empty-state card"><div className="icon">🤖</div><b>Belum ada bot.</b><br /><span className="text-muted text-sm">Klik "Tambah Bot" untuk memulai.</span></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nama</th><th>Chat ID</th><th>Status</th><th>Rate Limit</th><th>Pesan Hari Ini</th><th>Total Pesan</th><th>Aksi</th></tr></thead>
            <tbody>{bots.map(b => (
              <tr key={b.id}>
                <td><div style={{ fontWeight: 600 }}>{b.name}</div>{b.description && <div className="text-muted text-xs">{b.description}</div>}</td>
                <td><code>{b.chat_id}</code></td>
                <td><span className={`badge ${b.enabled ? "badge-green" : "badge-red"}`}>{b.enabled ? "Aktif" : "Nonaktif"}</span></td>
                <td><span className="text-muted">{b.rate_limit}/mnt</span></td>
                <td>{b.messages_today ?? 0}</td>
                <td>{b.total_messages ?? 0}</td>
                <td>
                  <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => openEdit(b)}>✏️ Edit</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => testBot(b)}>🧪 Test</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => rotateKey(b)}>🔑 Rotate</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => toggleEnabled(b)}>{b.enabled ? "⛔ Nonaktif" : "✅ Aktif"}</button>
                    <button className="btn btn-danger btn-xs" onClick={() => deleteBot(b)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(modal === "add" || modal === "edit") && !keyResult && (
        <Modal title={modal === "add" ? "➕ Tambah Bot Baru" : `✏️ Edit Bot: ${editBot?.name}`} onClose={() => setModal(null)}>
          {(["name", "botToken", "chatId", "description", "rateLimit"] as const).map(f => (
            <div className="form-group" key={f}>
              <label className="form-label">
                {f === "name" ? "Nama Bot" : f === "botToken" ? `Token Bot Telegram${modal === "edit" ? " (kosongkan jika tidak ganti)" : ""}` : f === "chatId" ? "Chat ID Default" : f === "description" ? "Deskripsi (opsional)" : "Rate Limit (pesan/menit)"}
              </label>
              <input type={f === "botToken" ? "password" : f === "rateLimit" ? "number" : "text"}
                placeholder={f === "botToken" ? "123456789:AABBcc…" : f === "chatId" ? "-100123456789" : f === "rateLimit" ? "60" : ""}
                value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
            </div>
          ))}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </Modal>
      )}

      {/* API Key Result Modal */}
      {keyResult && (
        <Modal title="🔑 Simpan API Key!" onClose={() => { setKeyResult(null); setModal(null); }}>
          <div className="card-sm" style={{ background: "#fef3c7", border: "1px solid #fde68a", marginBottom: 16 }}>
            ⚠️ <strong>API key ini hanya ditampilkan SEKALI. Salin sekarang!</strong>
          </div>
          <div className="form-group">
            <label className="form-label">Bot</label>
            <input readOnly value={keyResult.bot?.name ?? ""} />
          </div>
          <div className="form-group">
            <label className="form-label">API Key (salin sekarang!)</label>
            <div className="row">
              <input readOnly value={String(keyResult.apiKey ?? "")} style={{ fontFamily: "monospace", fontSize: 13 }} />
              <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(String(keyResult.apiKey)); toast("API key disalin!"); }}>📋</button>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={() => { setKeyResult(null); setModal(null); }}>Sudah Disalin ✓</button>
          </div>
        </Modal>
      )}

      {/* Test Result Modal */}
      {testResult && (
        <Modal title="🧪 Hasil Test Bot" onClose={() => setTestResult(null)}>
          <pre style={{ fontSize: 12 }}>{JSON.stringify(testResult, null, 2)}</pre>
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setTestResult(null)}>Tutup</button></div>
        </Modal>
      )}
    </div>
  );
}

// ─── Messages Tab ──────────────────────────────────────────────────────────────
function MessagesTab({ msgs, loading, reload, api, toast }: { msgs: MsgLog[]; loading: boolean; reload: () => void; api: (p: string, o?: RequestInit) => Promise<Record<string, unknown>>; toast: (m: string, t?: "ok"|"err"|"info") => void }) {
  const [filter, setFilter] = useState("");
  const filtered = msgs.filter(m => !filter || m.bot_name?.toLowerCase().includes(filter.toLowerCase()) || m.message.toLowerCase().includes(filter.toLowerCase()) || m.status.includes(filter));

  const resend = async (m: MsgLog) => {
    try { await api(`/api/admin/messages/${m.id}/resend`, { method: "POST" }); toast("Pesan berhasil dikirim ulang!"); reload(); }
    catch (e: unknown) { toast((e as Error).message, "err"); }
  };

  if (loading) return <div className="loading"><span className="spin">⏳</span> Memuat pesan...</div>;
  return (
    <div>
      <div className="section-header">
        <span className="section-title">💬 Riwayat Pesan <span className="badge badge-gray">{msgs.length}</span></span>
        <div className="row"><input placeholder="Filter bot / pesan / status…" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 240 }} /><button className="btn btn-ghost btn-sm" onClick={reload}>🔄</button></div>
      </div>
      {filtered.length === 0 ? <div className="empty-state card"><div className="icon">💬</div>Tidak ada pesan.</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Bot</th><th>Chat ID</th><th>Pesan</th><th>Mode</th><th>Status</th><th>TG ID</th><th>Waktu</th><th>Aksi</th></tr></thead>
            <tbody>{filtered.map(m => (
              <tr key={m.id}>
                <td><span className="badge badge-blue">{m.bot_name}</span></td>
                <td><code>{m.chat_id}</code></td>
                <td style={{ maxWidth: 200 }}><span title={m.message}>{truncate(m.message, 45)}</span></td>
                <td><code>{m.parse_mode ?? "—"}</code></td>
                <td><span className={`badge ${m.status === "sent" ? "badge-green" : "badge-red"}`}>{m.status}</span>{m.error && <div className="text-xs" style={{ color: "var(--red)" }}>{truncate(m.error, 30)}</div>}</td>
                <td><code>{m.tg_message_id ?? "—"}</code></td>
                <td className="text-muted text-sm">{fmtShort(m.created_at)}</td>
                <td><button className="btn btn-ghost btn-xs" onClick={() => resend(m)} title="Kirim ulang">🔁</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Templates Tab ─────────────────────────────────────────────────────────────
function TemplatesTab({ templates, bots, loading, reload, api, toast }: { templates: Template[]; bots: Bot[]; loading: boolean; reload: () => void; api: (p: string, o?: RequestInit) => Promise<Record<string, unknown>>; toast: (m: string, t?: "ok"|"err"|"info") => void }) {
  const [modal, setModal] = useState(false);
  const [editTpl, setEditTpl] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: "", content: "", parseMode: "HTML", botId: "", variables: "" });
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setEditTpl(null); setForm({ name: "", content: "", parseMode: "HTML", botId: "", variables: "" }); setModal(true); };
  const openEdit = (t: Template) => { setEditTpl(t); setForm({ name: t.name, content: t.content, parseMode: t.parse_mode, botId: t.bot_id ?? "", variables: t.variables.join(", ") }); setModal(true); };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { name: form.name, content: form.content, parse_mode: form.parseMode, bot_id: form.botId || null, variables: form.variables.split(",").map(s => s.trim()).filter(Boolean) };
      if (editTpl) { await api(`/api/admin/templates/${editTpl.id}`, { method: "PATCH", body: JSON.stringify(payload) }); toast("Template diperbarui!"); }
      else { await api("/api/admin/templates", { method: "POST", body: JSON.stringify(payload) }); toast("Template dibuat!"); }
      setModal(false); reload();
    } catch (e: unknown) { toast((e as Error).message, "err"); }
    finally { setSaving(false); }
  };

  const del = async (t: Template) => {
    if (!confirm(`Hapus template "${t.name}"?`)) return;
    try { await api(`/api/admin/templates/${t.id}`, { method: "DELETE" }); toast("Template dihapus."); reload(); }
    catch (e: unknown) { toast((e as Error).message, "err"); }
  };

  if (loading) return <div className="loading"><span className="spin">⏳</span> Memuat template...</div>;
  return (
    <div>
      <div className="section-header">
        <span className="section-title">📋 Templates <span className="badge badge-gray">{templates.length}</span></span>
        <button className="btn btn-primary" onClick={openAdd}>+ Tambah Template</button>
      </div>
      <p className="text-muted text-sm" style={{ marginBottom: 14 }}>Gunakan <code>{"{{variabel}}"}</code> di konten. Kirim via API: <code>{`{"template":"nama", "vars":{"key":"val"}}`}</code></p>
      {templates.length === 0 ? <div className="empty-state card"><div className="icon">📋</div>Belum ada template.</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nama</th><th>Konten</th><th>Mode</th><th>Bot</th><th>Variabel</th><th>Dipakai</th><th>Aksi</th></tr></thead>
            <tbody>{templates.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.name}</td>
                <td style={{ maxWidth: 220 }}><span title={t.content}>{truncate(t.content, 50)}</span></td>
                <td><span className="badge badge-purple">{t.parse_mode}</span></td>
                <td>{t.bot_name ? <span className="badge badge-blue">{t.bot_name}</span> : <span className="text-muted">Global</span>}</td>
                <td>{t.variables.length > 0 ? t.variables.map(v => <code key={v} style={{ marginRight: 4 }}>{v}</code>) : <span className="text-muted">—</span>}</td>
                <td><span className="badge badge-gray">{t.usage_count}×</span></td>
                <td><div className="row" style={{ gap: 4 }}>
                  <button className="btn btn-ghost btn-xs" onClick={() => { navigator.clipboard.writeText(t.content); toast("Konten disalin!"); }}>📋</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => openEdit(t)}>✏️</button>
                  <button className="btn btn-danger btn-xs" onClick={() => del(t)}>🗑️</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title={editTpl ? "✏️ Edit Template" : "➕ Tambah Template"} onClose={() => setModal(false)} wide>
          <div className="form-group"><label className="form-label">Nama Template</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="misal: notif_order" /></div>
          <div className="form-group"><label className="form-label">Bot (opsional — kosong = global)</label>
            <select value={form.botId} onChange={e => setForm(p => ({ ...p, botId: e.target.value }))}>
              <option value="">— Global —</option>
              {bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Parse Mode</label>
            <select value={form.parseMode} onChange={e => setForm(p => ({ ...p, parseMode: e.target.value }))}>
              <option>HTML</option><option>Markdown</option><option>MarkdownV2</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Konten (gunakan {"{{variabel}}"})</label>
            <textarea rows={5} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder={"Halo <b>{{nama}}</b>!\nPesanan #{{order_id}} sudah diproses."} />
          </div>
          <div className="form-group"><label className="form-label">Variabel (pisah koma)</label>
            <input value={form.variables} onChange={e => setForm(p => ({ ...p, variables: e.target.value }))} placeholder="nama, order_id, total" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tracker Tab ───────────────────────────────────────────────────────────────
function TrackerTab({ trackers, events, loading, reload, api, toast, baseUrl }: { trackers: TrackerCfg[]; events: TrackerEvent[]; loading: boolean; reload: () => void; api: (p: string, o?: RequestInit) => Promise<Record<string, unknown>>; toast: (m: string, t?: "ok"|"err"|"info") => void; baseUrl: string }) {
  const [modal, setModal] = useState(false);
  const [snippet, setSnippet] = useState<TrackerCfg | null>(null);
  const [form, setForm] = useState({ name: "", botId: "", notifyEvents: "form_submit,js_error", origins: "*" });
  const [saving, setSaving] = useState(false);
  const [bots, setBots] = useState<Bot[]>([]);

  useEffect(() => {
    fetch("/api/admin/bots", { headers: { "x-admin-key": sessionStorage.getItem("gt_admin_key") ?? "" } }).then(r => r.json()).then(d => setBots(d.bots ?? [])).catch(() => null);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/tracker", {
        method: "POST", body: JSON.stringify({
          name: form.name, bot_id: form.botId || null,
          notify_events: form.notifyEvents.split(",").map(s => s.trim()).filter(Boolean),
          allowed_origins: form.origins.split(",").map(s => s.trim()).filter(Boolean),
        })
      });
      toast("Tracker dibuat!"); setModal(false); reload();
    } catch (e: unknown) { toast((e as Error).message, "err"); }
    finally { setSaving(false); }
  };

  const toggleTracker = async (t: TrackerCfg) => {
    try {
      const sql = sessionStorage.getItem("gt_admin_key") ?? "";
      await fetch(`/api/admin/tracker`, { method: "PATCH", headers: { "x-admin-key": sql, "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, enabled: !t.enabled }) });
      reload();
    } catch { /* noop */ }
  };

  const EVENT_COLORS: Record<string, string> = { page_view: "badge-blue", form_submit: "badge-yellow", click: "badge-gray", js_error: "badge-red", custom: "badge-purple" };

  if (loading) return <div className="loading"><span className="spin">⏳</span> Memuat tracker...</div>;
  return (
    <div>
      <div className="section-header">
        <span className="section-title">📡 Web Tracker <span className="badge badge-gray">{trackers.length}</span></span>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Tambah Tracker</button>
      </div>
      <p className="text-muted text-sm" style={{ marginBottom: 14 }}>Rekam semua aktivitas website frontend dan kirim notifikasi ke bot Telegram.</p>

      {trackers.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: 20 }}>
          <table>
            <thead><tr><th>Nama</th><th>Tracker Key</th><th>Bot Notif</th><th>Notify Events</th><th>Events Hari Ini</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{trackers.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.name}</td>
                <td><code style={{ fontSize: 11 }}>{t.tracker_key}</code></td>
                <td>{t.bot_name ? <span className="badge badge-blue">{t.bot_name}</span> : <span className="text-muted">—</span>}</td>
                <td>{t.notify_events.map(e => <span key={e} className={`badge ${EVENT_COLORS[e] ?? "badge-gray"}`} style={{ marginRight: 3 }}>{e}</span>)}</td>
                <td><span className="badge badge-yellow">{t.events_today}</span></td>
                <td><span className={`badge ${t.enabled ? "badge-green" : "badge-red"}`}>{t.enabled ? "Aktif" : "Off"}</span></td>
                <td><div className="row" style={{ gap: 4 }}>
                  <button className="btn btn-ghost btn-xs" onClick={() => setSnippet(t)}>{"</>"} Snippet</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => { navigator.clipboard.writeText(t.tracker_key); toast("Key disalin!"); }}>📋 Key</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => toggleTracker(t)}>{t.enabled ? "⛔" : "✅"}</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="section-header"><span className="section-title">📊 Event Terbaru</span></div>
        {events.length === 0 ? <div className="empty-state"><div className="icon">📡</div>Belum ada event.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tracker</th><th>Event</th><th>URL</th><th>IP</th><th>Data</th><th>Waktu</th></tr></thead>
              <tbody>{events.map(e => (
                <tr key={e.id}>
                  <td>{e.tracker_name ? <span className="badge badge-blue">{e.tracker_name}</span> : "—"}</td>
                  <td><span className={`badge ${EVENT_COLORS[e.event_type] ?? "badge-gray"}`}>{e.event_type}</span></td>
                  <td style={{ maxWidth: 160 }} className="text-sm"><span title={e.url ?? ""}>{e.url ? truncate(e.url, 40) : "—"}</span></td>
                  <td><code>{e.ip ?? "—"}</code></td>
                  <td style={{ maxWidth: 160 }}><code style={{ fontSize: 11 }}>{truncate(JSON.stringify(e.data), 50)}</code></td>
                  <td className="text-muted text-sm">{fmtShort(e.created_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title="➕ Tambah Tracker Baru" onClose={() => setModal(false)}>
          <div className="form-group"><label className="form-label">Nama Tracker</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="misal: Website Utama" /></div>
          <div className="form-group"><label className="form-label">Bot Notifikasi (opsional)</label>
            <select value={form.botId} onChange={e => setForm(p => ({ ...p, botId: e.target.value }))}>
              <option value="">— Tidak ada —</option>
              {bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Event yang Di-notify (pisah koma)</label>
            <input value={form.notifyEvents} onChange={e => setForm(p => ({ ...p, notifyEvents: e.target.value }))} placeholder="form_submit,js_error,click" /></div>
          <div className="form-group"><label className="form-label">Allowed Origins (pisah koma — * untuk semua)</label>
            <input value={form.origins} onChange={e => setForm(p => ({ ...p, origins: e.target.value }))} placeholder="https://example.com,https://www.example.com" /></div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Buat Tracker"}</button>
          </div>
        </Modal>
      )}

      {snippet && (
        <Modal title={`📋 JS Snippet — ${snippet.name}`} onClose={() => setSnippet(null)} wide>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>Pasang kode ini di {"<head>"} atau sebelum {"</body>"} website kamu:</p>
          <div className="copy-block">
            <div className="snippet-box">{makeSnippet(snippet.tracker_key, baseUrl)}</div>
            <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(makeSnippet(snippet.tracker_key, baseUrl)); toast("Snippet disalin!"); }}>📋 Salin</button>
          </div>
          <div className="card-sm" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", marginTop: 12, fontSize: 12 }}>
            ✅ Password & data sensitif otomatis dimasking jadi <code>***</code> sebelum dikirim ke server.
          </div>
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setSnippet(null)}>Tutup</button></div>
        </Modal>
      )}
    </div>
  );
}

// ─── Logs Tab ──────────────────────────────────────────────────────────────────
function LogsTab({ logs, loading, reload, api, toast }: { logs: ActivityLog[]; loading: boolean; reload: () => void; api: (p: string, o?: RequestInit) => Promise<Record<string, unknown>>; toast: (m: string, t?: "ok"|"err"|"info") => void }) {
  const [filter, setFilter] = useState("");
  const filtered = logs.filter(l => !filter || l.log_type.includes(filter) || l.action.includes(filter) || l.endpoint.includes(filter));
  const TYPE_BADGE: Record<string, string> = { api: "badge-blue", admin: "badge-purple", tracker: "badge-yellow", system: "badge-gray" };

  const clearOld = async () => {
    if (!confirm("Hapus log lebih dari 30 hari?")) return;
    try { const d = await api("/api/admin/logs?older_than_days=30", { method: "DELETE" }); toast(`${d.deleted} log dihapus.`); reload(); }
    catch (e: unknown) { toast((e as Error).message, "err"); }
  };

  if (loading) return <div className="loading"><span className="spin">⏳</span> Memuat log...</div>;
  return (
    <div>
      <div className="section-header">
        <span className="section-title">📝 Activity Logs <span className="badge badge-gray">{logs.length}</span></span>
        <div className="row">
          <input placeholder="Filter type/action/endpoint…" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 220 }} />
          <button className="btn btn-ghost btn-sm" onClick={reload}>🔄</button>
          <button className="btn btn-danger btn-sm" onClick={clearOld}>🗑️ Bersihkan 30d</button>
        </div>
      </div>
      {filtered.length === 0 ? <div className="empty-state card"><div className="icon">📝</div>Tidak ada log.</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Type</th><th>Aksi</th><th>Bot</th><th>Endpoint</th><th>Status</th><th>Durasi</th><th>IP</th><th>Waktu</th></tr></thead>
            <tbody>{filtered.map(l => (
              <tr key={l.id}>
                <td><span className={`badge ${TYPE_BADGE[l.log_type] ?? "badge-gray"}`}>{l.log_type}</span></td>
                <td><code style={{ fontSize: 11 }}>{l.action}</code></td>
                <td>{l.bot_name ? <span className="badge badge-blue" style={{ fontSize: 11 }}>{l.bot_name}</span> : <span className="text-muted">—</span>}</td>
                <td className="text-sm"><code>{l.method}</code> {truncate(l.endpoint, 30)}</td>
                <td><span className={`badge ${!l.status ? "badge-gray" : l.status < 300 ? "badge-green" : l.status < 500 ? "badge-yellow" : "badge-red"}`}>{l.status ?? "—"}</span></td>
                <td className="text-muted text-sm">{l.duration_ms != null ? `${l.duration_ms}ms` : "—"}</td>
                <td><code style={{ fontSize: 11 }}>{l.ip ?? "—"}</code></td>
                <td className="text-muted text-sm">{fmtShort(l.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Playground Tab ────────────────────────────────────────────────────────────
function PlaygroundTab({ bots, loadBots, api, toast }: { bots: Bot[]; loadBots: () => void; api: (p: string, o?: RequestInit) => Promise<Record<string, unknown>>; toast: (m: string, t?: "ok"|"err"|"info") => void }) {
  const [pTab, setPTab] = useState<"send"|"bulk"|"template">("send");
  const [form, setForm] = useState({ apiKey: "", message: "", chatId: "", parseMode: "" });
  const [bulkForm, setBulkForm] = useState({ apiKey: "", message: "", chatIds: "" });
  const [tplForm, setTplForm] = useState({ apiKey: "", templateName: "", vars: "" });
  const [result, setResult] = useState<string>("");
  const [sending, setSending] = useState(false);

  useEffect(() => { if (bots.length === 0) loadBots(); }, [bots.length, loadBots]);

  const call = async (path: string, body: Record<string, unknown>, key: string) => {
    setSending(true); setResult("");
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key }, body: JSON.stringify(body) });
      const d = await res.json();
      setResult(JSON.stringify(d, null, 2));
      if (d.ok) toast("Berhasil dikirim!"); else toast(d.error ?? "Error", "err");
    } catch (e: unknown) { toast((e as Error).message, "err"); }
    finally { setSending(false); }
  };

  return (
    <div>
      <div className="section-title" style={{ marginBottom: 16 }}>🧪 API Playground</div>
      <div className="tab-bar">
        {([["send","📤 Single Send"],["bulk","📦 Bulk Send"],["template","📋 Template Send"]] as const).map(([id, label]) => (
          <button key={id} className={`tab ${pTab === id ? "active" : ""}`} onClick={() => setPTab(id)}>{label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          {pTab === "send" && <>
            <div className="form-group"><label className="form-label">API Key Bot</label><input type="password" value={form.apiKey} onChange={e => setForm(p => ({ ...p, apiKey: e.target.value }))} placeholder="gt_…" /></div>
            <div className="form-group"><label className="form-label">Pesan</label><textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={4} placeholder="Halo dari Playground!" /></div>
            <div className="form-group"><label className="form-label">Chat ID Override (opsional)</label><input value={form.chatId} onChange={e => setForm(p => ({ ...p, chatId: e.target.value }))} placeholder="-100123456" /></div>
            <div className="form-group"><label className="form-label">Parse Mode</label><select value={form.parseMode} onChange={e => setForm(p => ({ ...p, parseMode: e.target.value }))}><option value="">Default</option><option>HTML</option><option>Markdown</option></select></div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={sending || !form.apiKey || !form.message} onClick={() => call("/api/telegram/send", { message: form.message, chatId: form.chatId || undefined, parse_mode: form.parseMode || undefined }, form.apiKey)}>
              {sending ? <span className="spin">⏳</span> : "📤 Kirim"}
            </button>
          </>}
          {pTab === "bulk" && <>
            <div className="form-group"><label className="form-label">API Key Bot</label><input type="password" value={bulkForm.apiKey} onChange={e => setBulkForm(p => ({ ...p, apiKey: e.target.value }))} placeholder="gt_…" /></div>
            <div className="form-group"><label className="form-label">Pesan</label><textarea value={bulkForm.message} onChange={e => setBulkForm(p => ({ ...p, message: e.target.value }))} rows={3} placeholder="Broadcast pesan ini!" /></div>
            <div className="form-group"><label className="form-label">Chat IDs (pisah koma/enter)</label><textarea value={bulkForm.chatIds} onChange={e => setBulkForm(p => ({ ...p, chatIds: e.target.value }))} rows={3} placeholder={"-100111\n-100222\n-100333"} /></div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={sending || !bulkForm.apiKey || !bulkForm.message || !bulkForm.chatIds} onClick={() => call("/api/telegram/bulk", { message: bulkForm.message, chatIds: bulkForm.chatIds.split(/[\n,]/).map(s => s.trim()).filter(Boolean) }, bulkForm.apiKey)}>
              {sending ? <span className="spin">⏳</span> : "📦 Bulk Send"}
            </button>
          </>}
          {pTab === "template" && <>
            <div className="form-group"><label className="form-label">API Key Bot</label><input type="password" value={tplForm.apiKey} onChange={e => setTplForm(p => ({ ...p, apiKey: e.target.value }))} placeholder="gt_…" /></div>
            <div className="form-group"><label className="form-label">Nama Template</label><input value={tplForm.templateName} onChange={e => setTplForm(p => ({ ...p, templateName: e.target.value }))} placeholder="nama_template" /></div>
            <div className="form-group"><label className="form-label">Variabel (JSON)</label><textarea value={tplForm.vars} onChange={e => setTplForm(p => ({ ...p, vars: e.target.value }))} rows={3} placeholder={'{"nama":"Budi","total":"50000"}'} /></div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={sending || !tplForm.apiKey || !tplForm.templateName} onClick={() => { let vars = {}; try { vars = JSON.parse(tplForm.vars || "{}"); } catch { toast("JSON vars tidak valid", "err"); return; } call("/api/telegram/send", { template: tplForm.templateName, vars }, tplForm.apiKey); }}>
              {sending ? <span className="spin">⏳</span> : "📋 Send Template"}
            </button>
          </>}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>📬 Response</div>
          {result ? <pre style={{ fontSize: 12, maxHeight: 400, overflow: "auto" }}>{result}</pre> : <div className="empty-state" style={{ padding: "40px 0" }}><div className="icon" style={{ fontSize: 28 }}>📭</div>Belum ada response.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Docs Tab ──────────────────────────────────────────────────────────────────
function DocsTab({ baseUrl }: { baseUrl: string }) {
  const B = baseUrl;
  const copy = (s: string) => { navigator.clipboard.writeText(s); };
  const Block = ({ code }: { code: string }) => (
    <div className="copy-block" style={{ marginBottom: 12 }}>
      <pre>{code}</pre>
      <button className="copy-btn" onClick={() => copy(code)}>📋</button>
    </div>
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="section-title" style={{ marginBottom: 4 }}>📖 API Documentation</div>
      <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Base URL: <code>{B}</code></p>

      {[
        { title: "1. Health Check", method: "GET", path: "/api/health", desc: "Cek status server dan database.", code: `curl ${B}/api/health` },
        { title: "2. Kirim Pesan (Single)", method: "POST", path: "/api/telegram/send", desc: "Kirim pesan ke bot Telegram. Dukung message/text/msg dan chatId/chat_id/to.", code: `curl -X POST ${B}/api/telegram/send \\\n  -H "x-api-key: gt_xxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"Halo!", "parse_mode":"HTML"}'` },
        { title: "3. Kirim Bulk", method: "POST", path: "/api/telegram/bulk", desc: "Kirim satu pesan ke banyak chat ID sekaligus (maks 50).", code: `curl -X POST ${B}/api/telegram/bulk \\\n  -H "x-api-key: gt_xxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"Broadcast!", "chatIds":["-100111","-100222"]}'` },
        { title: "4. Kirim via Template", method: "POST", path: "/api/telegram/send", desc: "Kirim pesan menggunakan template dengan variabel.", code: `curl -X POST ${B}/api/telegram/send \\\n  -H "x-api-key: gt_xxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"template":"nama_template","vars":{"nama":"Budi","total":"50000"}}'` },
        { title: "5. Frontend Tracker", method: "POST", path: "/api/tracker", desc: "Kirim event dari website frontend. Gunakan x-tracker-key atau query param ?k=KEY.", code: `fetch('${B}/api/tracker?k=TRACKER_KEY', {\n  method: 'POST',\n  headers: {'Content-Type':'application/json'},\n  body: JSON.stringify({\n    event: 'form_submit',\n    url: window.location.href,\n    data: {email:'user@test.com', password:'***'}\n  })\n})` },
        { title: "6. List Bots (Admin)", method: "GET", path: "/api/admin/bots", desc: "Daftar semua bot beserta statistik.", code: `curl ${B}/api/admin/bots \\\n  -H "x-admin-key: MASTER_API_KEY"` },
        { title: "7. Tambah Bot (Admin)", method: "POST", path: "/api/admin/bots", desc: "Buat bot baru. apiKey hanya muncul sekali.", code: `curl -X POST ${B}/api/admin/bots \\\n  -H "x-admin-key: MASTER_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"MyBot","botToken":"123:ABC","chatId":"-100xxx","rateLimit":60}'` },
        { title: "8. Test Bot (Admin)", method: "POST", path: "/api/admin/bots/:id/test", desc: "Verifikasi token bot valid dan kirim pesan test.", code: `curl -X POST ${B}/api/admin/bots/BOT_ID/test \\\n  -H "x-admin-key: MASTER_API_KEY" \\\n  -H "Content-Type: application/json" -d '{}'` },
        { title: "9. Statistik (Admin)", method: "GET", path: "/api/admin/stats", desc: "Ringkasan statistik dashboard.", code: `curl ${B}/api/admin/stats \\\n  -H "x-admin-key: MASTER_API_KEY"` },
        { title: "10. Riwayat Pesan (Admin)", method: "GET", path: "/api/admin/messages", desc: "Riwayat pesan dengan filter & paginasi.", code: `curl "${B}/api/admin/messages?limit=50&page=1&status=sent" \\\n  -H "x-admin-key: MASTER_API_KEY"` },
      ].map(doc => (
        <div key={doc.title} style={{ marginBottom: 24 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className={`badge ${doc.method === "GET" ? "badge-green" : doc.method === "DELETE" ? "badge-red" : "badge-blue"}`}>{doc.method}</span>
            <code style={{ fontSize: 14 }}>{doc.path}</code>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{doc.title}</span>
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: 8 }}>{doc.desc}</p>
          <Block code={doc.code} />
        </div>
      ))}
    </div>
  );
}
