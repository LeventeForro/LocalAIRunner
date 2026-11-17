import { useEffect, useState } from "react";
import {
  Activity, Cpu, Database, Gauge, MemoryStick, MonitorPlay,
  PanelRightClose, RefreshCw, Thermometer, Zap
} from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

const number = (value, suffix = "%") =>
  value === null || value === undefined ? "—" : `${Number(value).toFixed(0)}${suffix}`;

function MetricCard({ icon: Icon, label, value, detail, tone = "blue" }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-top">
        <span className="metric-icon"><Icon size={15} /></span>
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value">{value}</div>
      {detail && <div className="metric-detail">{detail}</div>}
    </div>
  );
}

export default function HardwareMonitor({ onCollapse }) {
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws;
    let retry;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket("ws://localhost:8000/ws/telemetry");

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) retry = window.setTimeout(connect, 3000);
      };
      ws.onerror = () => setConnected(false);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const point = {
            time: new Date().toLocaleTimeString("hu-HU", {
              hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
            }),
            cpu: Number(data.cpu_usage_pct ?? 0),
            gpu: Number(data.gpu_utilization_pct ?? 0),
          };
          setCurrentMetrics(data);
          setMetricsHistory((previous) => [...previous, point].slice(-24));
        } catch (error) {
          console.error("Hibás telemetria üzenet:", error);
        }
      };
    };

    connect();
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  const cpu = currentMetrics?.cpu_usage_pct;
  const ram = currentMetrics?.ram_percent;
  const gpu = currentMetrics?.gpu_utilization_pct;
  const temp = currentMetrics?.gpu_temp_celsius;

  return (
    <section className="panel monitor-panel">
      <div className="panel-heading">
        <div className="panel-title-wrap">
          <div className="panel-icon"><Activity size={16} /></div>
          <div>
            <h2>Hardver monitor</h2>
            <p>Valós idejű rendszeradatok</p>
          </div>
        </div>
        <div className="heading-actions">
          <span className={`connection-pill ${connected ? "is-connected" : ""}`}>
            <span className="status-dot" />{connected ? "Élő" : "Kapcsolódás"}
          </span>
          {onCollapse && (
            <button className="icon-button subtle" onClick={onCollapse} title="Panel összecsukása">
              <PanelRightClose size={15} />
            </button>
          )}
        </div>
      </div>

      {!currentMetrics ? (
        <div className="monitor-empty">
          <RefreshCw size={20} className="spin-slow" />
          <strong>Várakozás a telemetriára</strong>
          <span>Ellenőrizd, hogy a FastAPI szerver fut-e.</span>
        </div>
      ) : (
        <>
          <div className="metrics-grid">
            <MetricCard icon={Cpu} label="CPU terhelés" value={number(cpu)} tone="blue" />
            <MetricCard icon={MemoryStick} label="Memória" value={number(ram)} tone="violet" />
            <MetricCard icon={MonitorPlay} label="GPU terhelés" value={number(gpu)} tone="cyan" />
            <MetricCard icon={Thermometer} label="GPU hőmérséklet" value={number(temp, "°C")} tone="amber" />
          </div>

          <div className="chart-section">
            <div className="section-heading">
              <div>
                <h3>Erőforrás-használat</h3>
                <p>Utolsó minták</p>
              </div>
              <span className="chart-live"><span className="status-dot" /> LIVE</span>
            </div>
            <div className="chart-legend">
              <span><i className="legend-line cpu-line" /> CPU</span>
              <span><i className="legend-line gpu-line" /> GPU</span>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsHistory} margin={{ top: 8, right: 8, left: -25, bottom: 0 }}>
                  <CartesianGrid stroke="#273142" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "#778397", fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#778397", fontSize: 9 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#151d2a", border: "1px solid #344155", borderRadius: 10, color: "#e8edf5", fontSize: 11 }}
                    formatter={(value) => [`${Number(value).toFixed(1)}%`]}
                  />
                  <Line type="monotone" dataKey="cpu" name="CPU" stroke="#8b9cf6" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="gpu" name="GPU" stroke="#55c3c9" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="monitor-note">
            <Gauge size={14} />
            <span>A grafikon a beérkező telemetria alapján frissül.</span>
          </div>
        </>
      )}
    </section>
  );
}
