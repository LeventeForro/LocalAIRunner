import { useEffect, useState } from "react";
import {
  Clock, Database, Edit2, MessageSquarePlus, MoreHorizontal,
  PanelLeftClose, RefreshCw, Trash2, Check, X, Zap
} from "lucide-react";

export default function HistoryTable({ onCollapse, onSelectChat, refreshTrigger, onNewChat }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/history");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setHistory(await response.json());
    } catch (error) {
      console.error("Az előzmények betöltése nem sikerült:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, [refreshTrigger]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const handleDelete = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm("Biztosan törlöd ezt a beszélgetést?")) return;
    try {
      const response = await fetch(`http://localhost:8000/history/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setHistory((items) => items.filter((item) => item.id !== id));
      onNewChat?.();
    } catch (error) {
      console.error("A beszélgetés törlése nem sikerült:", error);
      window.alert("Nem sikerült törölni a beszélgetést.");
    }
    setOpenMenuId(null);
  };

  const saveRename = async (id, event) => {
    event?.stopPropagation();
    const title = editTitle.trim();
    if (!title) return;
    try {
      const response = await fetch(`http://localhost:8000/history/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setHistory((items) => items.map((item) => item.id === id ? { ...item, title } : item));
    } catch (error) {
      console.error("Az átnevezés nem sikerült:", error);
      window.alert("Nem sikerült átnevezni a beszélgetést.");
    }
    setEditingId(null);
  };

  const openChat = (run) => {
    if (editingId) return;
    let messages;
    try {
      messages = JSON.parse(run.prompt);
      if (!Array.isArray(messages)) throw new Error("A prompt nem üzenetlista");
    } catch {
      messages = [{ role: "user", content: run.prompt }];
    }
    onSelectChat?.({ id: run.id, model: run.model_name, messages });
  };

  return (
    <section className="panel history-panel">
      <div className="panel-heading">
        <div className="panel-title-wrap">
          <div className="panel-icon"><Database size={16} /></div>
          <div>
            <h2>Előzmények</h2>
            <p>Korábbi beszélgetések</p>
          </div>
        </div>
        <div className="heading-actions">
          <button className="icon-button subtle" onClick={fetchHistory} title="Frissítés">
            <RefreshCw size={15} />
          </button>
          {onCollapse && (
            <button className="icon-button subtle" onClick={onCollapse} title="Panel összecsukása">
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>
      </div>

      <button className="new-chat-button" onClick={onNewChat}>
        <MessageSquarePlus size={16} />
        Új beszélgetés
      </button>

      <div className="history-list">
        {loading ? (
          <div className="history-placeholder">Előzmények betöltése…</div>
        ) : history.length === 0 ? (
          <div className="history-placeholder">
            <Database size={22} />
            <strong>Még nincs előzmény</strong>
            <span>Az új beszélgetéseid itt jelennek majd meg.</span>
          </div>
        ) : history.map((run) => {
          let avgTps = Number(run.tps || 0);
          let avgLat = Number(run.latency_ms || 0);
          try {
            const messages = JSON.parse(run.prompt);
            const assistantMessages = messages.filter((message) => message.role === "assistant" && message.metrics);
            if (assistantMessages.length) {
              avgTps = assistantMessages.reduce((sum, message) => sum + Number(message.metrics.tps || 0), 0) / assistantMessages.length;
              avgLat = assistantMessages.reduce((sum, message) => sum + Number(message.metrics.latency_ms || 0), 0) / assistantMessages.length;
            }
          } catch { /* Régi, egyszerű prompt formátum. */ }

          return (
            <article className="history-item" key={run.id} onClick={() => openChat(run)}>
              <div className="history-item-top">
                <span className="model-name">{run.model_name || "Helyi modell"}</span>
                <span className="history-time"><Clock size={11} />{new Date(run.created_at).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>

              {editingId === run.id ? (
                <div className="rename-row" onClick={(event) => event.stopPropagation()}>
                  <input
                    autoFocus value={editTitle} onChange={(event) => setEditTitle(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && saveRename(run.id, event)}
                    aria-label="Beszélgetés címe"
                  />
                  <button className="tiny-action confirm" onClick={(event) => saveRename(run.id, event)}><Check size={13} /></button>
                  <button className="tiny-action" onClick={() => setEditingId(null)}><X size={13} /></button>
                </div>
              ) : (
                <p className="history-title">{run.title || "Beszélgetés"}</p>
              )}

              <div className="history-item-bottom">
                <span><Zap size={11} /> {avgTps > 0 ? `${avgTps.toFixed(1)} tok/s` : "— tok/s"}</span>
                <span>{avgLat > 0 ? `${(avgLat / 1000).toFixed(2)} s` : "—"}</span>
              </div>

              <div className="history-menu-wrap" onClick={(event) => event.stopPropagation()}>
                <button className="history-menu-trigger" onClick={() => setOpenMenuId(openMenuId === run.id ? null : run.id)} aria-label="Beszélgetés műveletei">
                  <MoreHorizontal size={16} />
                </button>
                {openMenuId === run.id && (
                  <div className="history-menu">
                    <button onClick={() => {
                      setEditTitle(run.title || "Beszélgetés");
                      setEditingId(run.id);
                      setOpenMenuId(null);
                    }}><Edit2 size={13} /> Átnevezés</button>
                    <button className="danger-action" onClick={(event) => handleDelete(run.id, event)}><Trash2 size={13} /> Törlés</button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <div className="history-footnote">A beszélgetések helyben tárolódnak.</div>
    </section>
  );
}
