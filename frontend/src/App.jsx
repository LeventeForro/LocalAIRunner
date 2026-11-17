import { useState } from "react";
import HardwareMonitor from "./components/HardwareMonitor";
import ChatPanel from "./components/ChatPanel";
import HistoryTable from "./components/HistoryTable";
import {
  PanelLeftOpen,
  PanelRightOpen,
  Sparkles,
  CircleDot,
} from "lucide-react";

export default function App() {
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newChatTrigger, setNewChatTrigger] = useState(0);

  const handleNewChat = () => {
    setActiveSession(null);
    setNewChatTrigger((value) => value + 1);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={17} /></div>
          <div>
            <div className="brand-name">Local<span>AI</span>Runner</div>
            <div className="brand-caption">PRIVATE AI WORKSPACE</div>
          </div>
        </div>

        <div className="topbar-status">
          <span className="status-dot" />
          <span>Helyi környezet</span>
          <span className="status-divider" />
          <CircleDot size={13} />
          <span>Ollama kapcsolat</span>
        </div>

        <div className="topbar-actions">
          {!isLeftOpen && (
            <button className="icon-button" onClick={() => setIsLeftOpen(true)} title="Előzmények megnyitása">
              <PanelLeftOpen size={17} />
            </button>
          )}
          {!isRightOpen && (
            <button className="icon-button" onClick={() => setIsRightOpen(true)} title="Monitor megnyitása">
              <PanelRightOpen size={17} />
            </button>
          )}
          <span className="local-badge">LOCAL ONLY</span>
        </div>
      </header>

      <section className="workspace">
        {isLeftOpen && (
          <aside className="side-column history-column">
            <HistoryTable
              onCollapse={() => setIsLeftOpen(false)}
              onSelectChat={setActiveSession}
              refreshTrigger={refreshTrigger}
              onNewChat={handleNewChat}
            />
          </aside>
        )}

        <section className="chat-column">
          <ChatPanel
            activeSession={activeSession}
            newChatTrigger={newChatTrigger}
            onChatUpdated={() => setRefreshTrigger((value) => value + 1)}
          />
        </section>

        {isRightOpen && (
          <aside className="side-column monitor-column">
            <HardwareMonitor onCollapse={() => setIsRightOpen(false)} />
          </aside>
        )}
      </section>

      <footer className="app-footer">
        <span>LocalAIRunner <span className="footer-muted">/</span> privát AI-környezet</span>
        <span>Az adataid a saját gépeden maradnak.</span>
      </footer>
    </main>
  );
}
