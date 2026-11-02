import { useState, useEffect, useRef } from "react";
import {
  Sun, Moon, CloudSun, CheckCircle2, Circle, Plus, Trash2, Wallet,
  Target, ListChecks, Bell, TrendingUp, TrendingDown, X, PiggyBank,
  Flame, Sparkles, Heart, Camera, Loader2, AlertTriangle, ShieldCheck, Clock, BellRing,
  Mic, NotebookPen, History, CalendarClock, Send, Lightbulb, PenTool, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid
} from "recharts";
import {
  isGoogleConnected, wasGoogleConnected, connectGoogle, disconnectGoogle, subscribeGoogle,
  getClientId, hasLocalClientId, setClientId, gcalAccount, gcalListEvents, gcalInsert, gcalDelete,
} from "./gcal.js";
import { CADENCE_TEXT, latestSlot, upcomingSlots, showNativeAlert } from "./alerts.js";

const COLORS = {
  bg: "#EDE6DA",
  card: "#F8F4EA",
  cardAlt: "#FBF8F1",
  ink: "#3A3226",
  inkSoft: "#7A6E5B",
  line: "#DCD3C1",
  sage: "#7C8B6F",
  sageDark: "#5C6B50",
  sageBg: "#E3E7DA",
  rose: "#C97B84",
  roseDark: "#A85560",
  roseBg: "#F3DEE0",
  butter: "#E0A93A",
  butterDark: "#B8841E",
  butterBg: "#F5E7C7",
  danger: "#B6533F",
  dangerBg: "#F0DAD3",
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmtBRL = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const PRIORITIES = {
  alta: { label: "Alta", color: COLORS.danger, bg: COLORS.dangerBg },
  media: { label: "Média", color: COLORS.butterDark, bg: COLORS.butterBg },
  baixa: { label: "Baixa", color: COLORS.sageDark, bg: COLORS.sageBg },
};

function Sticky({ children, tone = "rose", rotate = 0, style, ...rest }) {
  const tones = {
    rose: { bg: COLORS.roseBg, border: COLORS.rose },
    butter: { bg: COLORS.butterBg, border: COLORS.butter },
    sage: { bg: COLORS.sageBg, border: COLORS.sage },
  };
  const t = tones[tone];
  return (
    <div
      style={{
        background: t.bg,
        border: `1px solid ${t.border}55`,
        borderLeft: `4px solid ${t.border}`,
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 3px 10px rgba(58,50,38,0.08)",
        ...style,
      }}
      className="rounded-lg px-4 py-3"
      {...rest}
    >
      {children}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <p style={{ color: COLORS.inkSoft }} className="text-sm italic py-6 text-center">
      {text}
    </p>
  );
}

function SectionCard({ children }) {
  return (
    <div
      style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
      className="rounded-2xl p-5 sm:p-6 shadow-sm"
    >
      {children}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      style={{
        background: COLORS.cardAlt,
        border: `1px solid ${COLORS.line}`,
        color: COLORS.ink,
      }}
      className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 w-full"
      onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.sage}55`)}
      onBlur={(e) => (e.target.style.boxShadow = "none")}
    />
  );
}

function IconBtn({ onClick, children, title, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ color: danger ? COLORS.danger : COLORS.inkSoft }}
      className="p-1.5 rounded-md hover:bg-black/5 transition"
    >
      {children}
    </button>
  );
}

const DEFAULT_BUDGET = { monthlyLimit: null, entries: [], categories: ["Comida", "Festa", "Drogas", "Mimos"] };

const buildContext = (d) => {
  const pending = (d.tasks || []).filter((t) => !t.done).length;
  const goalsList = (d.goals || []).map((g) => g.text).join(", ");
  return `Tarefas pendentes: ${pending}. Metas atuais: ${goalsList || "nenhuma cadastrada"}.`;
};

const toISO = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear(), m = String(x.getMonth() + 1).padStart(2, "0"), day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const getSunday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; };
const dateRangeISO = (startOffset, endOffset) => {
  const base = new Date(); base.setHours(0, 0, 0, 0);
  const arr = [];
  for (let i = startOffset; i <= endOffset; i++) arr.push(toISO(addDays(base, i)));
  return arr;
};
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const buildCalendarItems = (d, { routines = true, tasks = true, goals = true, external = true } = {}) => {
  const items = [];
  if (routines) {
    dateRangeISO(-45, 45).forEach((iso) => {
      const weekday = new Date(iso + "T00:00:00").getDay();
      (d.routines || []).forEach((r) => {
        const days = r.days && r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6];
        if (days.includes(weekday)) {
          items.push({ date: iso, label: r.time ? `${r.time} · ${r.text}` : r.text, color: COLORS.sage, type: "Rotina" });
        }
      });
    });
  }
  if (tasks) {
    (d.tasks || []).forEach((t) => {
      const date = t.dueDate || (t.createdAt ? toISO(new Date(t.createdAt)) : null);
      if (date) items.push({ date, label: `${t.done ? "✓ " : ""}${t.text}`, color: COLORS.rose, type: "Tarefa" });
    });
  }
  if (goals) {
    (d.goals || []).forEach((g) => {
      if (g.deadline) items.push({ date: g.deadline, label: g.text, color: COLORS.butter, type: "Meta" });
    });
  }
  if (external) {
    (d.externalEvents || []).forEach((e) => {
      if (e.date) items.push({ date: e.date, label: e.time ? `${e.time} · ${e.title}` : e.title, color: "#8FA3B0", type: "Agenda" });
    });
  }
  return items;
};

function CalendarView({ items, defaultMode = "week" }) {
  const [mode, setMode] = useState(defaultMode);
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState(toISO(new Date()));

  const itemsByDate = {};
  items.forEach((it) => {
    if (!it.date) return;
    if (!itemsByDate[it.date]) itemsByDate[it.date] = [];
    itemsByDate[it.date].push(it);
  });

  const todayIso = toISO(new Date());

  const navigate = (dir) => {
    setAnchor((prev) => {
      const next = new Date(prev);
      if (mode === "week") next.setDate(next.getDate() + dir * 7);
      else next.setMonth(next.getMonth() + dir);
      return next;
    });
  };

  let days = [];
  if (mode === "week") {
    const sunday = getSunday(anchor);
    days = Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  } else {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = getSunday(first);
    days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }

  const label = mode === "week"
    ? `${days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
    : anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} style={{ border: `1px solid ${COLORS.line}` }} className="w-7 h-7 rounded-md text-sm">‹</button>
          <p className="text-sm font-medium capitalize" style={{ color: COLORS.ink }}>{label}</p>
          <button onClick={() => navigate(1)} style={{ border: `1px solid ${COLORS.line}` }} className="w-7 h-7 rounded-md text-sm">›</button>
        </div>
        <div className="flex gap-1">
          {["week", "month"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                background: mode === m ? COLORS.ink : "transparent",
                color: mode === m ? COLORS.card : COLORS.inkSoft,
                border: `1px solid ${mode === m ? COLORS.ink : COLORS.line}`,
              }}
              className="text-xs px-2.5 py-1 rounded-full"
            >
              {m === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((w) => (
          <p key={w} className="text-[10px] text-center font-medium" style={{ color: COLORS.inkSoft }}>{w}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const iso = toISO(d);
          const inMonth = mode === "week" || d.getMonth() === anchor.getMonth();
          const dayItems = itemsByDate[iso] || [];
          const isToday = iso === todayIso;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              onClick={() => setSelected(iso)}
              style={{
                background: isSelected ? COLORS.sageBg : COLORS.cardAlt,
                border: `1px solid ${isToday ? COLORS.sage : COLORS.line}`,
                opacity: inMonth ? 1 : 0.35,
              }}
              className={`rounded-lg p-1 ${mode === "week" ? "h-16" : "h-11"} flex flex-col items-center justify-start`}
            >
              <span className="text-xs" style={{ color: isToday ? COLORS.sageDark : COLORS.ink, fontWeight: isToday ? 700 : 400 }}>{d.getDate()}</span>
              <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                {dayItems.slice(0, 3).map((it, idx) => (
                  <span key={idx} style={{ background: it.color, width: 5, height: 5, borderRadius: "50%" }} />
                ))}
                {dayItems.length > 3 && <span className="text-[9px]" style={{ color: COLORS.inkSoft }}>+{dayItems.length - 3}</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium mb-1.5" style={{ color: COLORS.inkSoft }}>
          {new Date(selected + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
        <div className="flex flex-col gap-1">
          {(itemsByDate[selected] || []).length === 0 && (
            <p className="text-xs italic" style={{ color: COLORS.inkSoft }}>Nada marcado nesse dia.</p>
          )}
          {(itemsByDate[selected] || []).map((it, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md" style={{ background: COLORS.cardAlt }}>
              <span style={{ background: it.color, width: 6, height: 6, borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ color: COLORS.ink }}>{it.label}</span>
              <span className="ml-auto text-[10px] shrink-0" style={{ color: COLORS.inkSoft }}>{it.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function callZeloReflection(userText, contextStr) {
  const system = `Você é o Zelo, uma presença de apoio dentro do app pessoal do usuário — acolhedor, honesto e caloroso, como um amigo presente, mas sem fingir ser terapeuta. Use este contexto só quando for realmente útil, sem forçar: ${contextStr}
Regras: não dê diagnóstico; não substitua terapia ou ajuda médica; se o usuário mencionar risco de se machucar, pensamentos suicidas ou perigo imediato, deixe o tom leve de lado e, com cuidado, inclua a sugestão de ligar para o CVV (188, gratuito, 24h) ou para o 192 em emergência, e incentive buscar alguém de confiança agora. Responda em português do Brasil, em no máximo 2 parágrafos curtos.`;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: userText }],
    }),
  });
  const json = await response.json();
  return (json.content || []).map((b) => b.text || "").join("").trim();
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("rotina");
  const [name, setName] = useState("");
  const [nowTick, setNowTick] = useState(Date.now());
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const loaded = useRef(false);
  const [alertQueue, setAlertQueue] = useState([]);
  const [gConnected, setGConnected] = useState(isGoogleConnected());
  const [relayKick, setRelayKick] = useState(0);
  const relayBusy = useRef(false);
  const relayAgain = useRef(false);
  const doneParamHandled = useRef(false);

  // Conclui uma tarefa/rotina vinda de um alerta (botão "Concluir" / "Feito")
  const completeItem = (kind, id) => {
    setData((prev) => {
      if (!prev) return prev;
      const c = structuredClone(prev);
      if (kind === "task") {
        const t = c.tasks.find((x) => x.id === id);
        if (t) { t.done = true; t.lastAlertSlot = Date.now(); }
      } else {
        const r = c.routines.find((x) => x.id === id);
        const iso = todayISO();
        if (r && !r.completedDates.includes(iso)) r.completedDates.push(iso);
      }
      return c;
    });
    setAlertQueue((q) => q.filter((a) => !(a.kind === kind && a.id === id)));
  };
  const dismissAlert = (kind, id) => setAlertQueue((q) => q.filter((a) => !(a.kind === kind && a.id === id)));

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("zelo-data");
        const defaults = { routines: [], tasks: [], budget: DEFAULT_BUDGET, goals: [], userName: "", allergies: [], notes: [], externalEvents: [], externalEventsSyncedAt: null };
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setData({ ...defaults, ...parsed, budget: { ...DEFAULT_BUDGET, ...(parsed.budget || {}) } });
        } else {
          setData(defaults);
        }
      } catch (e) {
        setData({ routines: [], tasks: [], budget: DEFAULT_BUDGET, goals: [], userName: "", allergies: [], notes: [], externalEvents: [], externalEventsSyncedAt: null });
      } finally {
        setLoading(false);
        loaded.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current || !data) return;
    (async () => {
      try {
        await window.storage.set("zelo-data", JSON.stringify(data));
      } catch (e) {
        console.error("Falha ao salvar", e);
      }
    })();
  }, [data]);

  // Tick every minute to refresh "horas atrasada" badges and check hourly reminders
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Mantém o estado "Google conectado" em dia (login novo, desconectou, sessão expirou)
  useEffect(() => {
    const sync = () => setGConnected(isGoogleConnected());
    return subscribeGoogle(sync);
  }, []);
  useEffect(() => { setGConnected(isGoogleConnected()); }, [nowTick]);

  // Botão "Concluir" da notificação do sistema (app já aberto em segundo plano)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (e) => {
      const m = e.data;
      if (m && m.type === "zelo-done") completeItem(m.kind, m.id);
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  // Botão "Concluir" da notificação com o app fechado: o Zelo abre com ?done=tipo:id
  useEffect(() => {
    if (loading || !data || doneParamHandled.current) return;
    doneParamHandled.current = true;
    const param = new URLSearchParams(window.location.search).get("done");
    if (param && param.includes(":")) {
      const [kind, ...rest] = param.split(":");
      completeItem(kind, rest.join(":"));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loading, data]);

  // Motor de alertas:
  //  - tarefas: baixa 1x/dia, média a cada 4h, alta de hora em hora (até concluir)
  //  - rotinas: na hora marcada e depois de 30 em 30 min (até confirmar "Feito")
  useEffect(() => {
    if (!data) return;
    const now = new Date(nowTick);
    const todayIso = todayISO();
    const fresh = [];
    const taskSlots = {};
    const routineStates = {};
    const prioLabel = { baixa: "baixa", media: "média", alta: "alta" };

    data.tasks.forEach((t) => {
      if (t.done) return;
      const slot = latestSlot(t.priority, now);
      if (!slot) return;
      const last = t.lastAlertSlot || t.createdAt || 0;
      if (slot.getTime() > last) {
        taskSlots[t.id] = slot.getTime();
        fresh.push({ kind: "task", id: t.id, title: `Tarefa · prioridade ${prioLabel[t.priority] || "média"}`, body: t.text });
      }
    });

    data.routines.forEach((r) => {
      if (!r.time || r.completedDates.includes(todayIso)) return;
      const scheduledToday = r.days && r.days.length ? r.days.includes(now.getDay()) : true;
      if (!scheduledToday) return;
      const [hh, mm] = r.time.split(":").map(Number);
      const scheduled = new Date(now);
      scheduled.setHours(hh, mm, 0, 0);
      if (nowTick < scheduled.getTime()) return;
      const minutesLate = Math.floor((nowTick - scheduled.getTime()) / 60000);
      const slot = Math.min(4, Math.floor(minutesLate / 30)); // 0 = chegou a hora; 1..4 = cobranças de 30 em 30 min
      const prev = r.notifyState && r.notifyState.date === todayIso ? r.notifyState.count : -1;
      if (slot > prev) {
        routineStates[r.id] = { date: todayIso, count: slot };
        fresh.push({
          kind: "routine",
          id: r.id,
          title: slot === 0 ? "Rotina · está na hora" : "Rotina · já fez?",
          body: `${r.text} (previsto ${r.time})`,
        });
      }
    });

    if (fresh.length === 0) return;

    setData((prev) => {
      const c = structuredClone(prev);
      c.tasks.forEach((t) => { if (taskSlots[t.id]) t.lastAlertSlot = taskSlots[t.id]; });
      c.routines.forEach((r) => { if (routineStates[r.id]) r.notifyState = routineStates[r.id]; });
      return c;
    });
    setAlertQueue((q) => [...q.filter((a) => !fresh.some((f) => f.kind === a.kind && f.id === a.id)), ...fresh]);
    fresh.forEach((f) => showNativeAlert({ title: f.title, body: f.body, tag: `${f.kind}:${f.id}`, data: { kind: f.kind, id: f.id } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick, !!data]);

  // Reserva na Agenda do Google: agenda os próximos alertas de cada tarefa (funcionam com o app fechado)
  // e apaga os que sobraram quando a tarefa é concluída/removida/muda de prioridade.
  const relaySig = data
    ? data.tasks.map((t) => `${t.id}|${t.done ? 1 : 0}|${t.priority}`).join(",") + "#" + Math.floor(nowTick / 3600000) + "#" + (gConnected ? 1 : 0)
    : "";
  useEffect(() => {
    if (!data || !gConnected) return;
    if (relayBusy.current) { relayAgain.current = true; return; }
    relayBusy.current = true;
    (async () => {
      const nowMs = Date.now();
      const saveAlerts = (taskId, list) =>
        setData((prev) => {
          const c = structuredClone(prev);
          const x = c.tasks.find((k) => k.id === taskId);
          if (x) x.calAlerts = list;
          return c;
        });
      try {
        for (const t of data.tasks) {
          const existing = (t.calAlerts || []).filter((a) => a.at > nowMs);
          const desired = t.done ? [] : upcomingSlots(t.priority, new Date(nowMs));
          let kept = [...existing];
          let changed = existing.length !== (t.calAlerts || []).length;
          try {
            for (const a of existing.filter((x) => !desired.includes(x.at))) {
              await gcalDelete(a.id);
              kept = kept.filter((k) => k.id !== a.id);
              changed = true;
            }
            for (const ms of desired.filter((m) => !kept.some((a) => a.at === m))) {
              const id = await gcalInsert({
                title: `⏰ Zelo: ${t.text}`,
                description: `Tarefa de prioridade ${t.priority}. Abra o Zelo e toque em Concluir quando terminar.`,
                startISO: new Date(ms).toISOString(),
                minutes: 10,
              });
              kept.push({ id, at: ms });
              changed = true;
            }
          } finally {
            if (changed) saveAlerts(t.id, kept); // guarda o progresso mesmo se der erro no meio
          }
        }
      } catch (e) {
        // sessão do Google expirou ou sem internet: tenta de novo quando reconectar
      } finally {
        relayBusy.current = false;
        if (relayAgain.current) { relayAgain.current = false; setRelayKick((k) => k + 1); }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relaySig, relayKick]);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    } catch (e) {
      setNotifPermission("unsupported");
    }
  };

  if (loading || !data) {
    return (
      <div
        style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: "Karla, sans-serif" }}
        className="min-h-[500px] w-full flex items-center justify-center rounded-2xl"
      >
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>Preparando tudo pra você...</p>
      </div>
    );
  }

  const today = todayISO();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const GreetIcon = hour < 12 ? Sun : hour < 18 ? CloudSun : Moon;

  // ---- derived reminders ----
  const overdueTasks = data.tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today);
  const dueTodayTasks = data.tasks.filter((t) => !t.done && t.dueDate === today);
  const todayWeekday = new Date().getDay();
  const routinesForToday = (r) => {
    const days = r.days && r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6];
    return days.includes(todayWeekday);
  };
  const pendingRoutines = data.routines.filter((r) => routinesForToday(r) && !r.completedDates.includes(today));

  const daysUntil = (dueDateISO) => {
    const due = new Date(dueDateISO + "T00:00:00");
    const now = new Date(today + "T00:00:00");
    return Math.round((due - now) / 86400000);
  };
  const upcomingDeadlineTasks = data.tasks.filter((t) => !t.done && t.dueDate && [7, 3, 1].includes(daysUntil(t.dueDate)));

  const reminderCount = overdueTasks.length + dueTodayTasks.length + pendingRoutines.length + upcomingDeadlineTasks.length;

  const currentHM = new Date().toTimeString().slice(0, 5);
  const todayTimeline = [
    ...data.routines.filter(routinesForToday).map((r) => ({ key: `r-${r.id}`, id: r.id, kind: "routine", time: r.time, text: r.text, done: r.completedDates.includes(today) })),
    ...data.tasks.filter((t) => t.dueDate === today).map((t) => ({ key: `t-${t.id}`, id: t.id, kind: "task", time: t.dueTime, text: t.text, done: t.done })),
  ].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

  // ---- budget derived ----
  const entries = data.budget.entries;
  const income = entries.filter((e) => e.type === "receita").reduce((s, e) => s + Number(e.value), 0);
  const expense = entries.filter((e) => e.type === "despesa").reduce((s, e) => s + Number(e.value), 0);
  const balance = income - expense;
  const limit = data.budget.monthlyLimit;
  const limitPct = limit ? Math.min(100, Math.round((expense / limit) * 100)) : null;
  const categories = data.budget.categories || [];
  const categoryTotals = categories
    .map((cat) => ({
      name: cat,
      total: entries.filter((e) => e.type === "despesa" && e.category === cat).reduce((s, e) => s + Number(e.value), 0),
    }))
    .sort((a, b) => b.total - a.total);

  const pieColors = [COLORS.rose, COLORS.butter, COLORS.sage, "#8D7BA5", "#8FA3B0", "#A6785E"];
  const pieData = categoryTotals.filter((c) => c.total > 0).map((c) => ({ name: c.name, value: c.total }));

  const dailyMap = {};
  entries.forEach((e) => {
    if (!dailyMap[e.date]) dailyMap[e.date] = { date: e.date, Receita: 0, Despesa: 0 };
    dailyMap[e.date][e.type === "receita" ? "Receita" : "Despesa"] += Number(e.value);
  });
  const dailySeries = Object.values(dailyMap)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((d) => ({ ...d, label: fmtDate(d.date) }));

  const budgetTips = [];
  if (income > 0) {
    const savedPct = Math.round(((income - expense) / income) * 100);
    if (savedPct < 0) budgetTips.push(`Você gastou ${Math.abs(savedPct)}% a mais do que ganhou nesse período. Vale pausar novos gastos não essenciais até equilibrar.`);
    else if (savedPct < 10) budgetTips.push(`Você está guardando cerca de ${savedPct}% do que ganha. Tentar chegar perto de 20% já faz diferença com o tempo.`);
    else budgetTips.push(`Você está guardando por volta de ${savedPct}% do que ganha nesse período — segue assim.`);
  }
  const topCat = categoryTotals.find((c) => c.total > 0);
  if (topCat && expense > 0) {
    const pctOfExpense = Math.round((topCat.total / expense) * 100);
    budgetTips.push(`"${topCat.name}" é sua maior categoria de gasto (${pctOfExpense}% do total gasto). Vale olhar se dá pra ajustar algo ali.`);
  }
  if (limit && expense > limit) {
    budgetTips.push(`Você já passou do limite mensal em ${fmtBRL(expense - limit)}.`);
  }
  if (budgetTips.length === 0) {
    budgetTips.push("Assim que você lançar receitas e despesas, o Zelo começa a trazer sugestões personalizadas aqui.");
  }

  // ---- update helpers ----
  const update = (fn) => setData((prev) => fn(structuredClone(prev)));

  const addRoutine = (text, time, days) => {
    if (!text.trim()) return;
    update((d) => {
      d.routines.push({
        id: uid(),
        text: text.trim(),
        time: time || null,
        days: days && days.length ? days : [0, 1, 2, 3, 4, 5, 6],
        completedDates: [],
        calendarCreated: false,
      });
      return d;
    });
  };
  const markRoutineCalendarCreated = (id, eventId) =>
    update((d) => {
      const r = d.routines.find((x) => x.id === id);
      if (r) { r.calendarCreated = true; if (eventId) r.calEventId = eventId; }
      return d;
    });
  const saveExternalEvents = (events) =>
    update((d) => {
      d.externalEvents = events;
      d.externalEventsSyncedAt = Date.now();
      return d;
    });
  const toggleRoutine = (id) => {
    update((d) => {
      const r = d.routines.find((x) => x.id === id);
      const idx = r.completedDates.indexOf(today);
      if (idx >= 0) r.completedDates.splice(idx, 1);
      else r.completedDates.push(today);
      return d;
    });
    setAlertQueue((q) => q.filter((a) => !(a.kind === "routine" && a.id === id)));
  };
  const deleteRoutine = (id) => {
    const r = data.routines.find((x) => x.id === id);
    if (r && r.calEventId && isGoogleConnected()) gcalDelete(r.calEventId).catch(() => {});
    setAlertQueue((q) => q.filter((a) => !(a.kind === "routine" && a.id === id)));
    update((d) => {
      d.routines = d.routines.filter((x) => x.id !== id);
      return d;
    });
  };

  const addTask = (text, dueDate, dueTime, priority, remindHourly) => {
    if (!text.trim()) return;
    update((d) => {
      d.tasks.push({
        id: uid(),
        text: text.trim(),
        dueDate: dueDate || null,
        dueTime: dueTime || null,
        priority,
        done: false,
        remindHourly: true,
        createdAt: Date.now(),
        calAlerts: [],
        deadlineCalendarCreated: false,
      });
      return d;
    });
  };
  const markDeadlineCreated = (id) =>
    update((d) => {
      const t = d.tasks.find((x) => x.id === id);
      if (t) t.deadlineCalendarCreated = true;
      return d;
    });
  const toggleTask = (id) => {
    update((d) => {
      const t = d.tasks.find((x) => x.id === id);
      t.done = !t.done;
      t.lastAlertSlot = Date.now();
      return d;
    });
    setAlertQueue((q) => q.filter((a) => !(a.kind === "task" && a.id === id)));
  };
  const deleteTask = (id) => {
    const t = data.tasks.find((x) => x.id === id);
    if (t && t.calAlerts && t.calAlerts.length && isGoogleConnected()) {
      t.calAlerts.forEach((a) => { gcalDelete(a.id).catch(() => {}); });
    }
    setAlertQueue((q) => q.filter((a) => !(a.kind === "task" && a.id === id)));
    update((d) => {
      d.tasks = d.tasks.filter((x) => x.id !== id);
      return d;
    });
  };

  const addEntry = (desc, value, type, category) => {
    if (!desc.trim() || !value) return;
    update((d) => {
      d.budget.entries.unshift({
        id: uid(),
        desc: desc.trim(),
        value: Number(value),
        type,
        date: today,
        category: type === "despesa" ? category || "Outros" : null,
      });
      return d;
    });
  };
  const deleteEntry = (id) =>
    update((d) => {
      d.budget.entries = d.budget.entries.filter((x) => x.id !== id);
      return d;
    });
  const setLimitVal = (val) =>
    update((d) => {
      d.budget.monthlyLimit = val ? Number(val) : null;
      return d;
    });
  const addCategory = (text) => {
    if (!text.trim()) return;
    update((d) => {
      if (!d.budget.categories) d.budget.categories = [];
      const exists = d.budget.categories.some((c) => c.toLowerCase() === text.trim().toLowerCase());
      if (!exists) d.budget.categories.push(text.trim());
      return d;
    });
  };
  const removeCategory = (cat) =>
    update((d) => {
      d.budget.categories = d.budget.categories.filter((c) => c !== cat);
      return d;
    });

  const addGoal = (text, target, unit, deadline) => {
    if (!text.trim() || !target) return;
    update((d) => {
      d.goals.push({ id: uid(), text: text.trim(), target: Number(target), current: 0, unit: unit || "", deadline: deadline || null });
      return d;
    });
  };
  const bumpGoal = (id, delta) =>
    update((d) => {
      const g = d.goals.find((x) => x.id === id);
      g.current = Math.max(0, Math.min(g.target, g.current + delta));
      return d;
    });
  const deleteGoal = (id) =>
    update((d) => {
      d.goals = d.goals.filter((x) => x.id !== id);
      return d;
    });

  const addAllergy = (text) => {
    if (!text.trim()) return;
    update((d) => {
      if (!d.allergies) d.allergies = [];
      const exists = d.allergies.some((a) => a.toLowerCase() === text.trim().toLowerCase());
      if (!exists) d.allergies.push(text.trim());
      return d;
    });
  };
  const removeAllergy = (item) =>
    update((d) => {
      d.allergies = d.allergies.filter((a) => a !== item);
      return d;
    });

  const saveNote = (text, reply, drawing) =>
    update((d) => {
      if (!d.notes) d.notes = [];
      d.notes.push({ id: uid(), text: text || "", reply: reply || "", drawing: drawing || null, createdAt: Date.now(), followUps: [] });
      return d;
    });
  const saveFollowUp = (noteId, text, reply) =>
    update((d) => {
      const n = (d.notes || []).find((x) => x.id === noteId);
      if (n) {
        if (!n.followUps) n.followUps = [];
        n.followUps.push({ id: uid(), text, reply, createdAt: Date.now() });
      }
      return d;
    });

  const tabs = [
    { id: "rotina", label: "Rotina", icon: ListChecks },
    { id: "tarefas", label: "Tarefas", icon: CheckCircle2 },
    { id: "orcamento", label: "Orçamento", icon: Wallet },
    { id: "metas", label: "Metas", icon: Target },
    { id: "saude", label: "Saúde", icon: Heart },
    { id: "notas", label: "Ideias", icon: NotebookPen },
    { id: "pensamentos", label: "Pensamentos", icon: History },
  ];

  return (
    <div
      style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: "Karla, sans-serif" }}
      className="w-full min-h-[600px] rounded-2xl p-4 sm:p-8"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Karla:wght@400;500;600;700&display=swap');
        .zelo-display { font-family: 'Fraunces', serif; }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2" style={{ color: COLORS.sageDark }}>
            <GreetIcon size={18} />
            <span className="text-sm font-medium">
              {greeting}{data.userName ? `, ${data.userName}` : ""}
            </span>
          </div>
          <h1 className="zelo-display text-3xl sm:text-4xl font-semibold mt-1" style={{ color: COLORS.ink }}>
            Zelo cuida disso com você
          </h1>
          <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
        <div className="w-full sm:w-56">
          <label className="text-xs uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Como te chamo?</label>
          <TextInput
            placeholder="Seu nome"
            defaultValue={data.userName}
            onBlur={(e) => update((d) => { d.userName = e.target.value; return d; })}
          />
        </div>
      </div>

      {/* Reminders banner */}
      {reminderCount > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} style={{ color: COLORS.roseDark }} />
            <h2 className="text-sm font-semibold" style={{ color: COLORS.roseDark }}>
              {reminderCount} coisa{reminderCount > 1 ? "s" : ""} pedindo sua atenção
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {overdueTasks.map((t, i) => (
              <Sticky key={t.id} tone="rose" rotate={i % 2 ? -1.5 : 1.5} style={{ maxWidth: 220 }}>
                <p className="text-xs font-semibold" style={{ color: COLORS.roseDark }}>Atrasada</p>
                <p className="text-sm">{t.text}</p>
                <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>venceu em {fmtDate(t.dueDate)}</p>
              </Sticky>
            ))}
            {dueTodayTasks.map((t, i) => (
              <Sticky key={t.id} tone="butter" rotate={i % 2 ? 1.5 : -1.5} style={{ maxWidth: 220 }}>
                <p className="text-xs font-semibold" style={{ color: COLORS.butterDark }}>Vence hoje</p>
                <p className="text-sm">{t.text}</p>
              </Sticky>
            ))}
            {pendingRoutines.map((r, i) => (
              <Sticky key={r.id} tone="sage" rotate={i % 2 ? -1.5 : 1.5} style={{ maxWidth: 220 }}>
                <p className="text-xs font-semibold" style={{ color: COLORS.sageDark }}>Rotina de hoje</p>
                <p className="text-sm mb-2">{r.text}</p>
                <button
                  onClick={() => toggleRoutine(r.id)}
                  style={{ background: COLORS.sage, color: "white" }}
                  className="text-xs font-medium px-3 py-1 rounded-full"
                >
                  Feito
                </button>
              </Sticky>
            ))}
            {upcomingDeadlineTasks.map((t, i) => (
              <Sticky key={t.id} tone="butter" rotate={i % 2 ? -1.5 : 1.5} style={{ maxWidth: 220 }}>
                <p className="text-xs font-semibold" style={{ color: COLORS.butterDark }}>Faltam {daysUntil(t.dueDate)} dia{daysUntil(t.dueDate) > 1 ? "s" : ""}</p>
                <p className="text-sm">{t.text}</p>
                <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>prazo {fmtDate(t.dueDate)}{t.dueTime ? ` às ${t.dueTime}` : ""}</p>
              </Sticky>
            ))}
          </div>
        </div>
      )}

      {/* Linha do tempo de hoje — página inicial */}
      {todayTimeline.length > 0 && (
        <div className="mb-6">
          <SectionCard>
            <h3 className="zelo-display text-lg mb-3">Hoje, em ordem</h3>
            <div className="flex flex-col gap-1.5">
              {todayTimeline.map((it) => {
                const isNow = it.time && Math.abs(
                  (parseInt(it.time.slice(0, 2)) * 60 + parseInt(it.time.slice(3, 5))) -
                  (parseInt(currentHM.slice(0, 2)) * 60 + parseInt(currentHM.slice(3, 5)))
                ) <= 30 && !it.done;
                return (
                  <button
                    key={it.key}
                    onClick={() => (it.kind === "routine" ? toggleRoutine(it.id) : toggleTask(it.id))}
                    style={{
                      background: isNow ? COLORS.butterBg : it.done ? COLORS.sageBg : COLORS.cardAlt,
                      border: `1px solid ${isNow ? COLORS.butter : COLORS.line}`,
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-left"
                  >
                    <span className="text-xs font-mono w-11 shrink-0" style={{ color: isNow ? COLORS.butterDark : COLORS.inkSoft }}>
                      {it.time || "—"}
                    </span>
                    {it.done ? (
                      <CheckCircle2 size={17} style={{ color: COLORS.sageDark, flexShrink: 0 }} />
                    ) : (
                      <Circle size={17} style={{ color: COLORS.inkSoft, flexShrink: 0 }} />
                    )}
                    <span className={`text-sm flex-1 ${it.done ? "line-through" : ""}`} style={{ color: it.done ? COLORS.inkSoft : COLORS.ink }}>
                      {it.text}
                    </span>
                    <span
                      style={{ background: it.kind === "routine" ? COLORS.sageBg : COLORS.roseBg, color: it.kind === "routine" ? COLORS.sageDark : COLORS.roseDark }}
                      className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                    >
                      {it.kind === "routine" ? "rotina" : "tarefa"}
                    </span>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Status de conexões */}
      <div className="mb-6">
        <ConnectionStatus externalEvents={data.externalEvents} syncedAt={data.externalEventsSyncedAt} onSync={saveExternalEvents} gConnected={gConnected} notifPermission={notifPermission} onRequestNotifications={requestNotifications} />
      </div>

      {/* Calendário da semana — página inicial */}
      <div className="mb-6">
        <SectionCard>
          <h3 className="zelo-display text-lg mb-3">Sua semana</h3>
          <CalendarView items={buildCalendarItems(data)} defaultMode="week" />
        </SectionCard>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: active ? COLORS.ink : COLORS.card,
                color: active ? COLORS.card : COLORS.ink,
                border: `1px solid ${active ? COLORS.ink : COLORS.line}`,
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition"
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ---------- ROTINA ---------- */}
      {tab === "rotina" && (
        <SectionCard>
          <h3 className="zelo-display text-xl mb-1">Rotina diária</h3>
          <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
            Coisas que se repetem todo dia. Marque conforme for fazendo hoje.
          </p>

          <RoutineForm onAdd={addRoutine} />

          <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="mt-4 pt-4">
            <CalendarView items={buildCalendarItems(data, { tasks: false, goals: false })} defaultMode="week" />
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {data.routines.length === 0 && <EmptyState text="Nenhuma rotina cadastrada ainda. Adicione a primeira acima." />}
            {[...data.routines]
              .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
              .map((r) => {
              const done = r.completedDates.includes(today);
              const streak = r.completedDates.length;
              let minutesLate = null;
              if (r.time && !done) {
                const scheduledToday = r.days && r.days.length ? r.days.includes(new Date(nowTick).getDay()) : true;
                if (scheduledToday) {
                  const [hh, mm] = r.time.split(":").map(Number);
                  const scheduled = new Date(nowTick);
                  scheduled.setHours(hh, mm, 0, 0);
                  if (nowTick >= scheduled.getTime()) minutesLate = Math.floor((nowTick - scheduled.getTime()) / 60000);
                }
              }
              const routineTone = minutesLate === null ? null : minutesLate >= 90 ? "danger" : minutesLate >= 30 ? "butter" : "sage";
              return (
                <div
                  key={r.id}
                  style={{ background: done ? COLORS.sageBg : COLORS.cardAlt, border: `1px solid ${COLORS.line}` }}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 gap-2"
                >
                  <button onClick={() => toggleRoutine(r.id)} className="flex items-center gap-2.5 text-left flex-1 min-w-0">
                    {done ? (
                      <CheckCircle2 size={19} style={{ color: COLORS.sageDark }} />
                    ) : (
                      <Circle size={19} style={{ color: COLORS.inkSoft }} />
                    )}
                    {r.time && (
                      <span style={{ color: COLORS.sageDark }} className="text-xs font-mono shrink-0">{r.time}</span>
                    )}
                    <span className={`truncate ${done ? "line-through" : ""}`} style={{ color: done ? COLORS.inkSoft : COLORS.ink }}>
                      {r.text}
                    </span>
                    {r.days && r.days.length > 0 && r.days.length < 7 && (
                      <span className="text-[10px] shrink-0" style={{ color: COLORS.inkSoft }}>
                        {r.days.map((d) => WEEKDAY_LABELS[d]).join(" ")}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {streak > 0 && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: COLORS.butterDark }}>
                        <Flame size={13} /> {streak}
                      </span>
                    )}
                    {routineTone && (
                      <span
                        style={{
                          background: routineTone === "danger" ? COLORS.dangerBg : routineTone === "butter" ? COLORS.butterBg : COLORS.sageBg,
                          color: routineTone === "danger" ? COLORS.danger : routineTone === "butter" ? COLORS.butterDark : COLORS.sageDark,
                        }}
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${routineTone === "danger" ? "animate-pulse" : ""}`}
                      >
                        <Clock size={11} /> {minutesLate}min
                      </span>
                    )}
                    {!done && (
                      <button
                        onClick={() => toggleRoutine(r.id)}
                        style={{ background: COLORS.sage, color: "white" }}
                        className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
                      >
                        Feito
                      </button>
                    )}
                    <RoutineCalendarButton
                      routineText={r.text}
                      time={r.time}
                      days={r.days}
                      alreadyCreated={!!r.calendarCreated}
                      onDone={(eventId) => markRoutineCalendarCreated(r.id, eventId)}
                    />
                    <IconBtn onClick={() => deleteRoutine(r.id)} title="Remover" danger>
                      <Trash2 size={15} />
                    </IconBtn>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* ---------- TAREFAS ---------- */}
      {tab === "tarefas" && (
        <SectionCard>
          <h3 className="zelo-display text-xl mb-1">Tarefas</h3>
          <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
            Coisas pontuais, com ou sem prazo.
          </p>

          <TaskForm onAdd={addTask} />

          {notifPermission !== "granted" && notifPermission !== "unsupported" && (
            <button
              onClick={requestNotifications}
              style={{ background: COLORS.sageBg, color: COLORS.sageDark, border: `1px solid ${COLORS.sage}55` }}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mt-3"
            >
              <BellRing size={13} /> Ativar notificações com botões Concluir / Fechar
            </button>
          )}

          <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="mt-4 pt-4 mb-2">
            <CalendarView items={buildCalendarItems(data, { routines: false, goals: false })} defaultMode="week" />
          </div>

          <div className="mt-2 flex flex-col gap-2">
            {data.tasks.length === 0 && <EmptyState text="Nenhuma tarefa por aqui. Que tal adicionar uma?" />}
            {[...data.tasks]
              .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1))
              .map((t) => {
                const overdue = !t.done && t.dueDate && t.dueDate < today;
                const p = PRIORITIES[t.priority] || PRIORITIES.baixa;
                const cadence = CADENCE_TEXT[t.priority] || CADENCE_TEXT.media;
                return (
                  <div
                    key={t.id}
                    style={{
                      background: t.done ? COLORS.cardAlt : overdue ? COLORS.dangerBg : COLORS.cardAlt,
                      border: `1px solid ${overdue ? COLORS.danger + "66" : COLORS.line}`,
                    }}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 gap-2"
                  >
                    <button onClick={() => toggleTask(t.id)} className="flex items-center gap-2.5 text-left flex-1 min-w-0">
                      {t.done ? (
                        <CheckCircle2 size={19} style={{ color: COLORS.sageDark, flexShrink: 0 }} />
                      ) : (
                        <Circle size={19} style={{ color: COLORS.inkSoft, flexShrink: 0 }} />
                      )}
                      <span className="min-w-0">
                        <span className={`block truncate ${t.done ? "line-through" : ""}`} style={{ color: t.done ? COLORS.inkSoft : COLORS.ink }}>
                          {t.text}
                        </span>
                        {t.dueDate && (
                          <span className="text-xs" style={{ color: overdue ? COLORS.danger : COLORS.inkSoft }}>
                            {overdue ? "atrasada · " : "prazo "}{fmtDate(t.dueDate)}{t.dueTime ? ` às ${t.dueTime}` : ""}
                          </span>
                        )}
                      </span>
                    </button>
                    {!t.done && t.calAlerts && t.calAlerts.length > 0 && (
                      <span className="flex items-center gap-1 text-xs whitespace-nowrap" style={{ color: COLORS.sageDark }} title="Alertas já agendados no Google Agenda">
                        <CalendarClock size={12} /> {t.calAlerts.length} na agenda
                      </span>
                    )}
                    {t.dueDate && !t.done && <DeadlineReminderButton taskText={t.text} dueDate={t.dueDate} alreadyCreated={!!t.deadlineCalendarCreated} onDone={() => markDeadlineCreated(t.id)} />}
                    <span
                      style={{ background: p.bg, color: p.color }}
                      className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                      title={`Alerta ${cadence}`}
                    >
                      {p.label} · {cadence}
                    </span>
                    <IconBtn onClick={() => deleteTask(t.id)} title="Remover" danger>
                      <Trash2 size={15} />
                    </IconBtn>
                  </div>
                );
              })}
          </div>
        </SectionCard>
      )}

      {/* ---------- ORÇAMENTO ---------- */}
      {tab === "orcamento" && (
        <SectionCard>
          <h3 className="zelo-display text-xl mb-1">Orçamento</h3>
          <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
            Controle simples de entradas e saídas.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div style={{ background: COLORS.sageBg }} className="rounded-xl p-3">
              <p className="text-xs flex items-center gap-1" style={{ color: COLORS.sageDark }}><TrendingUp size={13} /> Receitas</p>
              <p className="text-lg font-semibold mt-0.5" style={{ color: COLORS.sageDark }}>{fmtBRL(income)}</p>
            </div>
            <div style={{ background: COLORS.roseBg }} className="rounded-xl p-3">
              <p className="text-xs flex items-center gap-1" style={{ color: COLORS.roseDark }}><TrendingDown size={13} /> Despesas</p>
              <p className="text-lg font-semibold mt-0.5" style={{ color: COLORS.roseDark }}>{fmtBRL(expense)}</p>
            </div>
            <div style={{ background: balance >= 0 ? COLORS.butterBg : COLORS.dangerBg }} className="rounded-xl p-3">
              <p className="text-xs flex items-center gap-1" style={{ color: balance >= 0 ? COLORS.butterDark : COLORS.danger }}><PiggyBank size={13} /> Saldo</p>
              <p className="text-lg font-semibold mt-0.5" style={{ color: balance >= 0 ? COLORS.butterDark : COLORS.danger }}>{fmtBRL(balance)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>Limite mensal de gastos (opcional):</label>
            <input
              type="number"
              defaultValue={limit || ""}
              placeholder="ex: 2000"
              onBlur={(e) => setLimitVal(e.target.value)}
              style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
              className="rounded-md px-2 py-1 text-sm w-28 outline-none"
            />
          </div>
          {limit && (
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-1" style={{ color: COLORS.inkSoft }}>
                <span>Gasto do período</span>
                <span>{limitPct}% de {fmtBRL(limit)}</span>
              </div>
              <div style={{ background: COLORS.line }} className="h-2 rounded-full overflow-hidden">
                <div
                  style={{ width: `${limitPct}%`, background: limitPct >= 100 ? COLORS.danger : limitPct >= 75 ? COLORS.butter : COLORS.sage }}
                  className="h-full rounded-full transition-all"
                />
              </div>
            </div>
          )}

          <div className="mb-6">
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: COLORS.inkSoft }}>Ganhos x Gastos</p>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries.length ? dailySeries : [{ label: "—", Receita: 0, Despesa: 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} width={36} />
                  <Tooltip
                    contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => fmtBRL(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Receita" fill={COLORS.sage} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesa" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {pieData.length > 0 && (
            <div className="mb-6">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: COLORS.inkSoft }}>Gastos por categoria</p>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {pieData.map((entry, i) => <Cell key={entry.name} fill={pieColors[i % pieColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtBRL(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={{ background: COLORS.sageBg, borderLeft: `4px solid ${COLORS.sage}` }} className="rounded-lg px-4 py-3 mb-6">
            <p className="text-xs font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: COLORS.sageDark }}>
              <Lightbulb size={14} /> Sugestões do Zelo
            </p>
            <ul className="flex flex-col gap-1">
              {budgetTips.map((tip, i) => (
                <li key={i} className="text-sm" style={{ color: COLORS.ink }}>• {tip}</li>
              ))}
            </ul>
          </div>

          <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="pt-4 mb-5">
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: COLORS.inkSoft }}>Categorias</p>
            <CategoryForm onAdd={addCategory} />
            <div className="flex flex-wrap gap-2 mt-3">
              {categories.length === 0 && (
                <p className="text-xs italic" style={{ color: COLORS.inkSoft }}>Nenhuma categoria ainda.</p>
              )}
              {categories.map((c) => (
                <span
                  key={c}
                  style={{ background: COLORS.butterBg, color: COLORS.butterDark, border: `1px solid ${COLORS.butter}55` }}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                >
                  {c}
                  <button onClick={() => removeCategory(c)}><X size={12} /></button>
                </span>
              ))}
            </div>

            {expense > 0 && categoryTotals.some((c) => c.total > 0) && (
              <div className="mt-4 flex flex-col gap-2">
                {categoryTotals.filter((c) => c.total > 0).map((c) => {
                  const pct = Math.round((c.total / expense) * 100);
                  return (
                    <div key={c.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: COLORS.ink }}>{c.name}</span>
                        <span style={{ color: COLORS.inkSoft }}>{fmtBRL(c.total)} · {pct}%</span>
                      </div>
                      <div style={{ background: COLORS.line }} className="h-1.5 rounded-full overflow-hidden">
                        <div style={{ width: `${pct}%`, background: COLORS.rose }} className="h-full rounded-full transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <EntryForm onAdd={addEntry} categories={categories} />

          <div className="mt-4 flex flex-col gap-1.5">
            {entries.length === 0 && <EmptyState text="Nenhum lançamento ainda." />}
            {entries.map((e) => (
              <div
                key={e.id}
                style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}` }}
                className="flex items-center justify-between rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {e.type === "receita" ? (
                    <TrendingUp size={15} style={{ color: COLORS.sageDark }} />
                  ) : (
                    <TrendingDown size={15} style={{ color: COLORS.roseDark }} />
                  )}
                  <span className="truncate text-sm">{e.desc}</span>
                  {e.category && (
                    <span style={{ background: COLORS.butterBg, color: COLORS.butterDark }} className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
                      {e.category}
                    </span>
                  )}
                  <span className="text-xs shrink-0" style={{ color: COLORS.inkSoft }}>{fmtDate(e.date)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-sm font-medium"
                    style={{ color: e.type === "receita" ? COLORS.sageDark : COLORS.roseDark }}
                  >
                    {e.type === "receita" ? "+" : "−"}{fmtBRL(e.value)}
                  </span>
                  <IconBtn onClick={() => deleteEntry(e.id)} title="Remover" danger>
                    <Trash2 size={14} />
                  </IconBtn>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ---------- METAS ---------- */}
      {tab === "metas" && (
        <SectionCard>
          <h3 className="zelo-display text-xl mb-1">Metas</h3>
          <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
            O que você está construindo aos poucos.
          </p>

          <GoalForm onAdd={addGoal} />

          <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="mt-4 pt-4 mb-2">
            <CalendarView items={buildCalendarItems(data, { routines: false, tasks: false })} defaultMode="week" />
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {data.goals.length === 0 && <EmptyState text="Nenhuma meta ainda. Defina a primeira acima." />}
            {data.goals.map((g) => {
              const pct = Math.round((g.current / g.target) * 100);
              const complete = pct >= 100;
              return (
                <div
                  key={g.id}
                  style={{ background: complete ? COLORS.butterBg : COLORS.cardAlt, border: `1px solid ${COLORS.line}` }}
                  className="rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {complete && <Sparkles size={14} style={{ color: COLORS.butterDark }} />}
                      {g.text}
                    </p>
                    <IconBtn onClick={() => deleteGoal(g.id)} title="Remover" danger>
                      <Trash2 size={14} />
                    </IconBtn>
                  </div>
                  {g.deadline && (
                    <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>até {fmtDate(g.deadline)}</p>
                  )}
                  <div className="mt-2">
                    <div style={{ background: COLORS.line }} className="h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, pct)}%`, background: complete ? COLORS.butter : COLORS.sage }}
                        className="h-full rounded-full transition-all"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs" style={{ color: COLORS.inkSoft }}>
                        {g.current}{g.unit} de {g.target}{g.unit} ({pct}%)
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => bumpGoal(g.id, -1)}
                          style={{ border: `1px solid ${COLORS.line}` }}
                          className="w-6 h-6 rounded-md text-xs"
                        >−</button>
                        <button
                          onClick={() => bumpGoal(g.id, 1)}
                          style={{ border: `1px solid ${COLORS.line}` }}
                          className="w-6 h-6 rounded-md text-xs"
                        >+</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* ---------- SAÚDE ---------- */}
      {tab === "saude" && (
        <SectionCard>
          <h3 className="zelo-display text-xl mb-1">Saúde</h3>
          <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
            Cadastre suas alergias e tire foto de remédios ou alimentos para checar antes de usar.
          </p>

          <div className="mb-5">
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: COLORS.inkSoft }}>Minhas alergias</p>
            <AllergyForm onAdd={addAllergy} />
            <div className="flex flex-wrap gap-2 mt-3">
              {(data.allergies || []).length === 0 && (
                <p className="text-xs italic" style={{ color: COLORS.inkSoft }}>Nenhuma alergia cadastrada ainda.</p>
              )}
              {(data.allergies || []).map((a) => (
                <span
                  key={a}
                  style={{ background: COLORS.roseBg, color: COLORS.roseDark, border: `1px solid ${COLORS.rose}55` }}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                >
                  {a}
                  <button onClick={() => removeAllergy(a)}><X size={12} /></button>
                </span>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="pt-5">
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: COLORS.inkSoft }}>Checar remédio ou alimento</p>
            <PhotoChecker allergies={data.allergies || []} />
          </div>

          <div style={{ background: COLORS.butterBg, borderLeft: `4px solid ${COLORS.butter}` }} className="rounded-lg px-3 py-2.5 mt-5 flex gap-2">
            <AlertTriangle size={16} style={{ color: COLORS.butterDark, flexShrink: 0, marginTop: 2 }} />
            <p className="text-xs" style={{ color: COLORS.butterDark }}>
              O Zelo identifica ingredientes e avisa sobre alergias cadastradas, mas não substitui orientação de farmacêutico ou médico, e não recomenda qual medicamento tomar. Em caso de reação alérgica ou emergência, procure atendimento imediato.
            </p>
          </div>
        </SectionCard>
      )}

      {/* ---------- IDEIAS ---------- */}
      {tab === "notas" && (
        <SectionCard>
          <h3 className="zelo-display text-xl mb-1">Ideias</h3>
          <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
            Um espaço pra desabafar, pensar alto ou soltar uma ideia. O Zelo lê e responde como quem se importa.
          </p>
          <NoteComposer contextStr={buildContext(data)} onSaved={saveNote} />
          <p className="text-xs mt-5" style={{ color: COLORS.inkSoft }}>
            Tudo que você escrever aqui fica guardado na aba <strong>Pensamentos</strong>, pra você voltar depois.
          </p>
        </SectionCard>
      )}

      {/* ---------- PENSAMENTOS ---------- */}
      {tab === "pensamentos" && (
        <SectionCard>
          <h3 className="zelo-display text-xl mb-1">Pensamentos</h3>
          <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
            Suas ideias anteriores. Volte em qualquer uma pra comentar algo novo ou revisitar o assunto.
          </p>
          <DrawingPad onSave={(caption, dataUrl) => saveNote(caption, "", dataUrl)} />
          <div className="flex flex-col gap-3">
            {(data.notes || []).length === 0 && <EmptyState text="Nenhuma nota ainda. Escreva a primeira na aba Notas." />}
            {[...(data.notes || [])].reverse().map((n) => (
              <NoteThread key={n.id} note={n} contextStr={buildContext(data)} onFollowUp={saveFollowUp} />
            ))}
          </div>
        </SectionCard>
      )}

      <AlertCenter queue={alertQueue} onDone={completeItem} onClose={dismissAlert} />
      <VoiceFab categories={categories} addEntry={addEntry} addCategory={addCategory} addTask={addTask} saveNote={saveNote} />
    </div>
  );
}

async function fetchGoogleEvents() {
  if (!isGoogleConnected()) await connectGoogle();
  return gcalListEvents(14);
}

function friendlyGoogleError(e) {
  const m = String((e && e.message) || e || "");
  if (m === "NO_CLIENT_ID") return "Falta colar o Client ID do Google (passo a passo no chat).";
  if (m.includes("popup_closed") || m.includes("popup_failed")) return "A janela do Google foi fechada ou bloqueada. Toque em Conectar de novo e permita o pop-up.";
  if (m.includes("access_denied")) return "Acesso negado. Confira se o seu e-mail foi adicionado como usuário de teste no Google Cloud.";
  if (m.includes("redirect_uri") || m.includes("origin")) return "O endereço do app não está liberado no Google Cloud (Origens JavaScript autorizadas).";
  return m || "Não consegui conectar agora.";
}

function ConnectionRow({ label, icon: Icon, tone, text, children }) {
  const colors = {
    idle: { bg: COLORS.cardAlt, fg: COLORS.inkSoft },
    connected: { bg: COLORS.sageBg, fg: COLORS.sageDark },
    disconnected: { bg: COLORS.dangerBg, fg: COLORS.danger },
    warn: { bg: COLORS.butterBg, fg: COLORS.butterDark },
  };
  const c = colors[tone] || colors.idle;
  return (
    <div style={{ background: c.bg }} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5">
      <Icon size={16} style={{ color: c.fg, flexShrink: 0 }} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold" style={{ color: c.fg }}>{label}</p>
        <p className="text-xs truncate" style={{ color: c.fg }}>{text}</p>
      </div>
      {children}
    </div>
  );
}

function GoogleRow({ connected }) {
  const [clientId, setClientIdState] = useState(getClientId());
  const [draft, setDraft] = useState("");
  const [account, setAccount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadAccount = async () => {
    try {
      const info = await gcalAccount();
      setAccount(info.account);
    } catch (e) {
      setAccount(null);
    }
  };
  useEffect(() => {
    if (connected) loadAccount();
    else setAccount(null);
  }, [connected]);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      await connectGoogle();
    } catch (e) {
      setError(friendlyGoogleError(e));
    } finally {
      setBusy(false);
    }
  };
  const saveClient = () => {
    setClientId(draft);
    setClientIdState(getClientId());
    setDraft("");
  };

  const hasClient = !!clientId;
  const tone = connected ? "connected" : hasClient && wasGoogleConnected() ? "warn" : "disconnected";
  const text = connected
    ? account || "conectado"
    : !hasClient
    ? "falta configurar (Client ID do Google)"
    : wasGoogleConnected()
    ? "sessão expirou — toque em Conectar"
    : "não conectado";

  return (
    <>
      <ConnectionRow label="Google Agenda" icon={CalendarClock} tone={tone} text={text}>
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : connected ? (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={loadAccount} title="Verificar de novo" className="p-1 rounded-md hover:bg-black/5"><RefreshCw size={13} /></button>
            <button onClick={() => disconnectGoogle()} title="Desconectar" className="p-1 rounded-md hover:bg-black/5"><X size={13} /></button>
          </div>
        ) : hasClient ? (
          <button onClick={connect} style={{ background: COLORS.sage, color: "white" }} className="text-xs font-medium px-3 py-1 rounded-full shrink-0">
            Conectar
          </button>
        ) : null}
      </ConnectionRow>
      {!hasClient && (
        <div className="flex gap-2">
          <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Cole aqui o Client ID do Google (termina em .apps.googleusercontent.com)" />
          <button onClick={saveClient} style={{ background: COLORS.ink, color: COLORS.card }} className="rounded-lg px-3 text-xs shrink-0">Salvar</button>
        </div>
      )}
      {hasClient && !connected && hasLocalClientId() && (
        <button
          onClick={() => { setClientId(""); setClientIdState(""); }}
          className="text-[11px] underline self-start"
          style={{ color: COLORS.inkSoft }}
        >
          trocar o Client ID
        </button>
      )}
      {error && <p className="text-xs" style={{ color: COLORS.danger }}>{error}</p>}
    </>
  );
}

function ConnectionStatus({ externalEvents, syncedAt, onSync, gConnected, notifPermission, onRequestNotifications }) {
  const [syncStatus, setSyncStatus] = useState("idle"); // idle|loading|error
  const [syncError, setSyncError] = useState("");

  const syncEvents = async () => {
    setSyncStatus("loading");
    setSyncError("");
    try {
      const events = await fetchGoogleEvents();
      onSync(events);
      setSyncStatus("idle");
    } catch (e) {
      setSyncError(friendlyGoogleError(e));
      setSyncStatus("error");
    }
  };

  const notifTone = notifPermission === "granted" ? "connected" : notifPermission === "denied" ? "disconnected" : "warn";
  const notifText =
    notifPermission === "granted" ? "ativadas (com botões Concluir / Fechar)" :
    notifPermission === "denied" ? "bloqueadas — libere nas configurações do navegador" :
    notifPermission === "unsupported" ? "este navegador não suporta" : "desativadas";

  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-3">
        <h3 className="zelo-display text-lg">Conexões</h3>
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>agenda e alertas</p>
      </div>
      <div className="flex flex-col gap-2">
        <GoogleRow connected={gConnected} />
        <ConnectionRow label="Microsoft / Outlook" icon={CalendarClock} tone="idle" text="em breve — precisa de uma configuração própria (Azure)" />
        <ConnectionRow label="Notificações do aparelho" icon={BellRing} tone={notifTone} text={notifText}>
          {notifPermission !== "granted" && notifPermission !== "denied" && notifPermission !== "unsupported" && (
            <button onClick={onRequestNotifications} style={{ background: COLORS.sage, color: "white" }} className="text-xs font-medium px-3 py-1 rounded-full shrink-0">
              Ativar
            </button>
          )}
        </ConnectionRow>
      </div>
      <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>
        O Zelo só pede acesso à sua Agenda quando você toca em Conectar — nunca sozinho ao abrir o app.
        Com o Google conectado, os alertas das tarefas também ficam agendados na Agenda e tocam mesmo com o app fechado.
      </p>

      <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="pt-3 mt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>
            Eventos já criados na sua Agenda (próximos 14 dias)
          </p>
          <button
            onClick={syncEvents}
            disabled={syncStatus === "loading"}
            style={{ color: COLORS.sageDark }}
            className="flex items-center gap-1 text-xs font-medium disabled:opacity-60"
          >
            {syncStatus === "loading" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Sincronizar
          </button>
        </div>
        {syncStatus === "error" && <p className="text-xs" style={{ color: COLORS.danger }}>{syncError}</p>}
        {syncedAt && (
          <p className="text-xs mb-1.5" style={{ color: COLORS.inkSoft }}>
            Última sincronização: {new Date(syncedAt).toLocaleString("pt-BR")}
          </p>
        )}
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {(!externalEvents || externalEvents.length === 0) && (
            <p className="text-xs italic" style={{ color: COLORS.inkSoft }}>
              {syncedAt ? "Nenhum evento encontrado nesse período." : "Toque em Sincronizar pra trazer o que já está na sua Agenda."}
            </p>
          )}
          {(externalEvents || []).map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md" style={{ background: COLORS.cardAlt }}>
              <span style={{ background: "#8FA3B0", width: 6, height: 6, borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ color: COLORS.ink }} className="truncate">{e.title}</span>
              <span className="ml-auto text-[10px] shrink-0" style={{ color: COLORS.inkSoft }}>
                {fmtDate(e.date)}{e.time ? ` ${e.time}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

async function createCalendarEvents(eventList) {
  // eventList: [{ iso, title, desc }]
  if (!isGoogleConnected()) await connectGoogle();
  for (const e of eventList) {
    await gcalInsert({ title: e.title, description: e.desc, startISO: e.iso, minutes: 15 });
  }
  return true;
}

function buildDeadlineEvents(taskText, dueDateISO) {
  const due = new Date(dueDateISO + "T09:00:00");
  const offsets = [7, 3, 1];
  return offsets
    .map((o) => { const d = new Date(due); d.setDate(d.getDate() - o); return { d, o }; })
    .filter(({ d }) => d.getTime() > Date.now())
    .map(({ d, o }) => ({
      iso: d.toISOString(),
      title: `Prazo chegando: ${taskText} · Zelo`,
      desc: `Faltam ${o} dia${o > 1 ? "s" : ""} para o prazo.`,
    }));
}

function DeadlineReminderButton({ taskText, dueDate, alreadyCreated, onDone }) {
  const [status, setStatus] = useState(alreadyCreated ? "done" : "idle");
  const create = async () => {
    setStatus("loading");
    try {
      const events = buildDeadlineEvents(taskText, dueDate);
      if (events.length > 0) await createCalendarEvents(events);
      setStatus("done");
      if (onDone) onDone();
    } catch (e) {
      setStatus("error");
    }
  };
  // Só cria sozinho se o Google já estiver conectado; senão espera um toque (o login do Google exige um toque).
  useEffect(() => { if (!alreadyCreated && isGoogleConnected()) create(); }, []);
  if (status === "done") {
    return (
      <span className="flex items-center gap-1 text-xs whitespace-nowrap" style={{ color: COLORS.butterDark }}>
        <CalendarClock size={12} /> prazos na agenda
      </span>
    );
  }
  return (
    <button
      onClick={create}
      disabled={status === "loading"}
      title="Criar lembretes 7, 3 e 1 dia antes do prazo"
      style={{ color: COLORS.inkSoft }}
      className="flex items-center gap-1 text-xs px-1.5 py-1 rounded-md hover:bg-black/5 disabled:opacity-60 whitespace-nowrap"
    >
      {status === "loading" ? <Loader2 size={12} className="animate-spin" /> : <CalendarClock size={12} />}
      {status === "error" ? "tentar de novo" : status === "loading" ? "" : "prazo"}
    </button>
  );
}

const RRULE_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

// Primeira ocorrência futura que cai num dos dias escolhidos
function nextOccurrence(time, days) {
  const [hh, mm] = (time || "08:00").split(":").map(Number);
  const allowed = days && days.length ? days : [0, 1, 2, 3, 4, 5, 6];
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(hh, mm, 0, 0);
    if (d.getTime() > now.getTime() && allowed.includes(d.getDay())) return d;
  }
  return new Date(now.getTime() + 3600000);
}

// Cria UM evento recorrente semanal (nos dias escolhidos). Devolve o id do evento.
async function createRoutineRecurringEvent(routineText, time, days) {
  if (!isGoogleConnected()) await connectGoogle();
  const start = nextOccurrence(time, days);
  const byday = (days && days.length ? days : [0, 1, 2, 3, 4, 5, 6]).map((d) => RRULE_DAY[d]).join(",");
  return gcalInsert({
    title: `Rotina: ${routineText}`,
    description: "Rotina do Zelo. Abra o app e toque em Feito.",
    startISO: start.toISOString(),
    minutes: 20,
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${byday}`],
    reminderMinutes: 0,
  });
}

function RoutineCalendarButton({ routineText, time, days, alreadyCreated, onDone }) {
  const [status, setStatus] = useState(alreadyCreated ? "done" : "idle");
  const create = async () => {
    setStatus("loading");
    try {
      const eventId = await createRoutineRecurringEvent(routineText, time, days);
      setStatus("done");
      if (onDone) onDone(eventId);
    } catch (e) {
      setStatus("error");
    }
  };
  useEffect(() => { if (!alreadyCreated && isGoogleConnected()) create(); }, []);
  if (status === "done") {
    return (
      <span className="flex items-center gap-1 text-xs whitespace-nowrap" style={{ color: COLORS.sageDark }}>
        <CalendarClock size={12} /> na agenda
      </span>
    );
  }
  return (
    <button
      onClick={create}
      disabled={status === "loading"}
      title="Criar evento recorrente no Google Agenda"
      style={{ color: COLORS.inkSoft }}
      className="flex items-center gap-1 text-xs px-1.5 py-1 rounded-md hover:bg-black/5 disabled:opacity-60 whitespace-nowrap"
    >
      {status === "loading" ? <Loader2 size={12} className="animate-spin" /> : <CalendarClock size={12} />}
      {status === "error" ? "tentar de novo" : status === "loading" ? "" : "agenda"}
    </button>
  );
}

// Alerta na tela: um para tarefas (rosa) e outro para rotinas (verde), com Fechar / Concluir
function AlertCenter({ queue, onDone, onClose }) {
  if (!queue || queue.length === 0) return null;
  const a = queue[0];
  const isTask = a.kind === "task";
  const accent = isTask ? COLORS.rose : COLORS.sage;
  const accentDark = isTask ? COLORS.roseDark : COLORS.sageDark;
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60, pointerEvents: "none" }} className="p-3 flex justify-center">
      <div
        style={{ background: COLORS.card, border: `2px solid ${accent}`, boxShadow: "0 10px 30px rgba(58,50,38,0.3)", pointerEvents: "auto" }}
        className="w-full max-w-md rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: accentDark }}>
            <BellRing size={13} /> {a.title}
          </p>
          {queue.length > 1 && <span className="text-xs" style={{ color: COLORS.inkSoft }}>+{queue.length - 1} aguardando</span>}
        </div>
        <p className="text-base font-medium mb-3" style={{ color: COLORS.ink }}>{a.body}</p>
        <div className="flex gap-2">
          <button
            onClick={() => onClose(a.kind, a.id)}
            style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft, flex: 1 }}
            className="rounded-xl py-3 text-sm font-medium"
          >
            Fechar
          </button>
          <button
            onClick={() => onDone(a.kind, a.id)}
            style={{ background: COLORS.sage, color: "white", flex: 2 }}
            className="rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 size={16} /> {isTask ? "Concluir" : "Feito"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteComposer({ contextStr, onSaved }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastReply, setLastReply] = useState("");

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const reply = await callZeloReflection(text, contextStr);
      setLastReply(reply);
      onSaved(text, reply);
      setText("");
    } catch (e) {
      setLastReply("Não consegui pensar nisso agora. Tenta de novo em instantes?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Desabafa aqui, pensa alto, ou só escreve o que tá passando pela cabeça..."
        rows={4}
        style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
        className="rounded-lg px-3 py-2 text-sm outline-none w-full resize-none"
      />
      <button
        onClick={submit}
        disabled={loading || !text.trim()}
        style={{ background: COLORS.sage, color: "white" }}
        className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        {loading ? "Pensando..." : "Compartilhar"}
      </button>
      {lastReply && !loading && (
        <div style={{ background: COLORS.sageBg, borderLeft: `4px solid ${COLORS.sage}` }} className="rounded-lg px-4 py-3 mt-4">
          <p className="text-xs font-semibold mb-1" style={{ color: COLORS.sageDark }}>Zelo</p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: COLORS.ink }}>{lastReply}</p>
        </div>
      )}
    </div>
  );
}

function NoteThread({ note, contextStr, onFollowUp }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const reply = await callZeloReflection(text, contextStr);
      onFollowUp(note.id, text, reply);
      setText("");
      setOpen(false);
    } catch (e) {
      // silencioso: usuário pode tentar de novo
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}` }} className="rounded-xl p-4">
      <p className="text-xs mb-1" style={{ color: COLORS.inkSoft }}>{new Date(note.createdAt).toLocaleString("pt-BR")}</p>
      {note.drawing && (
        <img src={note.drawing} alt="Desenho da ideia" className="rounded-lg mb-2 w-full" style={{ border: `1px solid ${COLORS.line}` }} />
      )}
      {note.text && <p className="text-sm mb-2" style={{ color: COLORS.ink }}>{note.text}</p>}
      {note.reply && (
        <div style={{ background: COLORS.sageBg, borderLeft: `3px solid ${COLORS.sage}` }} className="rounded-lg px-3 py-2 mb-2">
          <p className="text-xs font-semibold mb-0.5" style={{ color: COLORS.sageDark }}>Zelo</p>
          <p className="text-sm whitespace-pre-wrap">{note.reply}</p>
        </div>
      )}
      {(note.followUps || []).map((f) => (
        <div key={f.id} className="ml-3 mt-2 pl-3" style={{ borderLeft: `2px solid ${COLORS.line}` }}>
          <p className="text-xs mb-1" style={{ color: COLORS.inkSoft }}>{new Date(f.createdAt).toLocaleString("pt-BR")}</p>
          <p className="text-sm mb-1">{f.text}</p>
          {f.reply && (
            <div style={{ background: COLORS.sageBg, borderLeft: `3px solid ${COLORS.sage}` }} className="rounded-lg px-3 py-2">
              <p className="text-xs font-semibold mb-0.5" style={{ color: COLORS.sageDark }}>Zelo</p>
              <p className="text-sm whitespace-pre-wrap">{f.reply}</p>
            </div>
          )}
        </div>
      ))}
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-xs mt-2 font-medium" style={{ color: COLORS.sageDark }}>
          + revisitar / comentar
        </button>
      ) : (
        <div className="mt-2 flex gap-2">
          <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="O que mais você quer pensar sobre isso?" onKeyDown={(e) => e.key === "Enter" && submit()} />
          <button onClick={submit} disabled={loading} style={{ background: COLORS.ink, color: COLORS.card }} className="rounded-lg px-3 flex items-center disabled:opacity-60">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      )}
    </div>
  );
}

function VoiceFab({ categories, addEntry, addCategory, addTask, saveNote }) {
  const [status, setStatus] = useState("idle"); // idle|listening|thinking|confirm|unsupported|error
  const [kind, setKind] = useState("expense"); // expense|note|task
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [typedFallback, setTypedFallback] = useState("");
  const gotResultRef = useRef(false);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setStatus("unsupported"); return; }
    gotResultRef.current = false;
    setErrorMsg("");
    let rec;
    try {
      rec = new SR();
      rec.lang = "pt-BR";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        gotResultRef.current = true;
        const t = e.results[0][0].transcript;
        setTranscript(t);
        route(t);
      };
      rec.onerror = (e) => {
        gotResultRef.current = true;
        const map = {
          "not-allowed": "O navegador bloqueou o microfone aqui dentro do artefato. Isso costuma acontecer nesse ambiente — use o campo de texto abaixo como alternativa, ou tente abrir o link publicado do Zelo direto (fora do chat).",
          "service-not-allowed": "O microfone não está liberado aqui. Use o campo de texto abaixo por enquanto.",
          "no-speech": "Não peguei nenhum som. Tenta falar logo depois de tocar, ou usa o campo de texto abaixo.",
          "audio-capture": "Não encontrei microfone disponível nesse dispositivo. Usa o campo de texto abaixo.",
        };
        setErrorMsg(map[e.error] || "Não consegui ouvir agora. Usa o campo de texto abaixo.");
        setStatus("error");
      };
      rec.onend = () => {
        if (!gotResultRef.current) {
          setErrorMsg((prev) => prev || "Não peguei nada. Usa o campo de texto abaixo.");
          setStatus((s) => (s === "listening" ? "error" : s));
        }
      };
      setStatus("listening");
      setParsed(null);
      rec.start();
    } catch (err) {
      setErrorMsg("Esse navegador não deixou eu usar o microfone aqui. Usa o campo de texto abaixo.");
      setStatus("error");
    }
  };

  // Roteia pelo início da fala: "gasto"/"custo" → orçamento, "pensamento" → ideia, "incluir tarefa"/"tarefa" → tarefa
  const route = (text) => {
    const lower = text.trim().toLowerCase();
    if (lower.startsWith("pensamento")) {
      const noteText = text.trim().replace(/^pensamento\s*[:\-]?\s*/i, "").trim();
      setKind("note");
      setParsed({ text: noteText || text.trim() });
      setStatus("confirm");
      return;
    }
    if (lower.startsWith("incluir tarefa") || lower.startsWith("tarefa") || lower.startsWith("criar tarefa")) {
      interpretTask(text);
      return;
    }
    interpretExpense(text);
  };

  const interpretExpense = async (text) => {
    setStatus("thinking");
    setKind("expense");
    try {
      const prompt = `Extraia um lançamento financeiro da fala do usuário. Categorias existentes: ${categories.join(", ") || "nenhuma"}. Fala: "${text}". Responda APENAS com JSON, sem markdown: {"desc": "descrição curta", "value": numero, "type": "despesa" ou "receita", "category": "uma categoria existente que combine, ou uma nova sugestão curta se nenhuma encaixar"}.`;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const json = await response.json();
      const raw = (json.content || []).map((b) => b.text || "").join("");
      const clean = raw.replace(/```json|```/g, "").trim();
      setParsed(JSON.parse(clean));
      setStatus("confirm");
    } catch (e) {
      setErrorMsg("Não consegui entender o gasto. Tenta de novo ou digita abaixo.");
      setStatus("error");
    }
  };

  const interpretTask = async (text) => {
    setStatus("thinking");
    setKind("task");
    try {
      const prompt = `Extraia uma tarefa do comando de voz do usuário. Hoje é ${todayISO()} (formato AAAA-MM-DD). Comando: "${text}". Responda APENAS com JSON, sem markdown: {"text": "descrição curta da tarefa, sem a palavra 'tarefa' no início", "date": "AAAA-MM-DD, ou null se não foi dita nenhuma data", "time": "HH:MM, ou null se não foi dito nenhum horário"}.`;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const json = await response.json();
      const raw = (json.content || []).map((b) => b.text || "").join("");
      const clean = raw.replace(/```json|```/g, "").trim();
      setParsed(JSON.parse(clean));
      setStatus("confirm");
    } catch (e) {
      setErrorMsg("Não consegui entender a tarefa. Tenta de novo ou digita abaixo.");
      setStatus("error");
    }
  };

  const confirm = () => {
    if (!parsed) return;
    if (kind === "expense") {
      if (parsed.type === "despesa" && parsed.category && !categories.includes(parsed.category)) addCategory(parsed.category);
      addEntry(parsed.desc, parsed.value, parsed.type, parsed.category);
    } else if (kind === "task") {
      addTask(parsed.text, parsed.date, parsed.time, "media", false);
    } else if (kind === "note") {
      saveNote(parsed.text, "", null);
    }
    reset();
  };

  const reset = () => { setStatus("idle"); setTranscript(""); setParsed(null); setErrorMsg(""); setTypedFallback(""); };

  const submitTyped = () => {
    if (!typedFallback.trim()) return;
    setTranscript(typedFallback);
    route(typedFallback);
  };

  return (
    <>
      <button
        onClick={start}
        style={{ background: COLORS.ink, color: COLORS.card, boxShadow: "0 6px 16px rgba(58,50,38,0.25)" }}
        className={`fixed bottom-5 right-5 w-14 h-14 rounded-full flex items-center justify-center z-40 ${status === "listening" ? "animate-pulse" : ""}`}
        title="Falar com o Zelo"
      >
        <Mic size={22} />
      </button>

      {status !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(58,50,38,0.35)" }}
          onClick={() => status !== "thinking" && reset()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
            className="rounded-2xl p-5 w-full max-w-sm"
          >
            {status === "listening" && (
              <div className="text-center">
                <p className="text-sm mb-2" style={{ color: COLORS.inkSoft }}>🎙️ Te escutando...</p>
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>
                  "gasto com uber, 50, transporte"<br />
                  "pensamento... queria testar uma horta em casa"<br />
                  "incluir tarefa consulta no dia 10/09 às 14h"
                </p>
              </div>
            )}
            {status === "thinking" && (
              <p className="text-sm text-center flex items-center justify-center gap-2" style={{ color: COLORS.inkSoft }}>
                <Loader2 size={15} className="animate-spin" /> Entendendo o que você disse...
              </p>
            )}
            {(status === "unsupported" || status === "error") && (
              <div>
                <p className="text-sm mb-3" style={{ color: COLORS.danger }}>
                  {errorMsg || "Seu navegador não suporta entrada por voz aqui."}
                </p>
                <p className="text-xs mb-1.5" style={{ color: COLORS.inkSoft }}>Ou digite o que você falaria:</p>
                <div className="flex gap-2">
                  <TextInput
                    value={typedFallback}
                    onChange={(e) => setTypedFallback(e.target.value)}
                    placeholder='ex: "gasto com uber, 50, transporte"'
                    onKeyDown={(e) => e.key === "Enter" && submitTyped()}
                  />
                  <button onClick={submitTyped} style={{ background: COLORS.ink, color: COLORS.card }} className="rounded-lg px-3 flex items-center shrink-0">
                    <Send size={15} />
                  </button>
                </div>
              </div>
            )}
            {status === "confirm" && parsed && kind === "expense" && (
              <div>
                <p className="text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: COLORS.roseDark }}>Gasto/receita</p>
                <p className="text-xs mb-3 italic" style={{ color: COLORS.inkSoft }}>Você disse: "{transcript}"</p>
                <div className="flex flex-col gap-2">
                  <TextInput value={parsed.desc || ""} onChange={(e) => setParsed({ ...parsed, desc: e.target.value })} />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={parsed.value}
                      onChange={(e) => setParsed({ ...parsed, value: e.target.value })}
                      style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
                      className="rounded-lg px-2 py-2 text-sm outline-none w-24"
                    />
                    <select
                      value={parsed.type}
                      onChange={(e) => setParsed({ ...parsed, type: e.target.value })}
                      style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
                      className="rounded-lg px-2 py-2 text-sm outline-none"
                    >
                      <option value="despesa">Despesa</option>
                      <option value="receita">Receita</option>
                    </select>
                    <TextInput value={parsed.category || ""} onChange={(e) => setParsed({ ...parsed, category: e.target.value })} placeholder="categoria" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={reset} style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }} className="flex-1 rounded-lg py-2 text-sm">Cancelar</button>
                  <button onClick={confirm} style={{ background: COLORS.sage, color: "white" }} className="flex-1 rounded-lg py-2 text-sm font-medium">Adicionar</button>
                </div>
              </div>
            )}
            {status === "confirm" && parsed && kind === "task" && (
              <div>
                <p className="text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: COLORS.roseDark }}>Nova tarefa</p>
                <p className="text-xs mb-3 italic" style={{ color: COLORS.inkSoft }}>Você disse: "{transcript}"</p>
                <div className="flex flex-col gap-2">
                  <TextInput value={parsed.text || ""} onChange={(e) => setParsed({ ...parsed, text: e.target.value })} />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={parsed.date || ""}
                      onChange={(e) => setParsed({ ...parsed, date: e.target.value })}
                      style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
                      className="rounded-lg px-2 py-2 text-sm outline-none flex-1"
                    />
                    <input
                      type="time"
                      value={parsed.time || ""}
                      onChange={(e) => setParsed({ ...parsed, time: e.target.value })}
                      style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
                      className="rounded-lg px-2 py-2 text-sm outline-none w-24"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={reset} style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }} className="flex-1 rounded-lg py-2 text-sm">Cancelar</button>
                  <button onClick={confirm} style={{ background: COLORS.sage, color: "white" }} className="flex-1 rounded-lg py-2 text-sm font-medium">Criar tarefa</button>
                </div>
              </div>
            )}
            {status === "confirm" && parsed && kind === "note" && (
              <div>
                <p className="text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: COLORS.roseDark }}>Novo pensamento</p>
                <textarea
                  value={parsed.text || ""}
                  onChange={(e) => setParsed({ ...parsed, text: e.target.value })}
                  rows={4}
                  style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
                  className="rounded-lg px-3 py-2 text-sm outline-none w-full resize-none"
                />
                <div className="flex gap-2 mt-4">
                  <button onClick={reset} style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }} className="flex-1 rounded-lg py-2 text-sm">Cancelar</button>
                  <button onClick={confirm} style={{ background: COLORS.sage, color: "white" }} className="flex-1 rounded-lg py-2 text-sm font-medium">Guardar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DrawingPad({ onSave }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [color, setColor] = useState(COLORS.ink);
  const [caption, setCaption] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = 320;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = COLORS.cardAlt;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, [open]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => { drawingRef.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = COLORS.cardAlt;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSave(caption, dataUrl);
    clear();
    setCaption("");
    setOpen(false);
  };

  const palette = [COLORS.ink, COLORS.rose, COLORS.sage, COLORS.butter];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ border: `1px dashed ${COLORS.line}`, color: COLORS.inkSoft }}
        className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm w-full justify-center mb-5"
      >
        <PenTool size={15} /> Desenhar uma ideia à mão
      </button>
    );
  }

  return (
    <div style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}` }} className="rounded-xl p-3 mb-5">
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg touch-none"
        style={{ border: `1px solid ${COLORS.line}`, height: 320 }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex items-center gap-2 mt-2">
        {palette.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{ background: c, border: color === c ? `2px solid ${COLORS.ink}` : "1px solid transparent" }}
            className="w-6 h-6 rounded-full"
          />
        ))}
        <button onClick={clear} style={{ color: COLORS.inkSoft }} className="text-xs ml-2 underline">limpar</button>
      </div>
      <div className="mt-2">
        <TextInput placeholder="Uma legenda pra essa ideia (opcional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={() => setOpen(false)} style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }} className="flex-1 rounded-lg py-2 text-sm">Cancelar</button>
        <button onClick={save} style={{ background: COLORS.sage, color: "white" }} className="flex-1 rounded-lg py-2 text-sm font-medium">Guardar desenho</button>
      </div>
    </div>
  );
}

function AllergyForm({ onAdd }) {
  const [text, setText] = useState("");
  const submit = () => { onAdd(text); setText(""); };
  return (
    <div className="flex gap-2">
      <TextInput placeholder="ex: Dipirona, Amendoim, Lactose..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <button onClick={submit} style={{ background: COLORS.ink, color: COLORS.card }} className="rounded-lg px-3 flex items-center"><Plus size={16} /></button>
    </div>
  );
}

function PhotoChecker({ allergies }) {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFile = (file) => {
    if (!file) return;
    setResult(null);
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      setImage({ base64, mediaType: file.type, previewUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!image) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const prompt = `Você está vendo a foto de um rótulo de remédio ou embalagem de alimento. Responda APENAS com um JSON válido, sem markdown, sem texto extra, no formato exato:
{"itemName": "nome do produto", "type": "medicamento" ou "alimento" ou "desconhecido", "activeSubstances": ["princípios ativos, se remédio"], "ingredients": ["ingredientes, se alimento"], "notes": "observação curta se o rótulo estiver ilegível ou incompleto"}
Se não conseguir identificar o produto pela imagem, retorne itemName como "Não identificado" e explique em notes.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });
      const respJson = await response.json();
      const text = (respJson.content || []).map((b) => b.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      const allTerms = [...(parsed.activeSubstances || []), ...(parsed.ingredients || [])];
      const matches = [];
      allergies.forEach((allergy) => {
        const found = allTerms.some((term) =>
          term.toLowerCase().includes(allergy.toLowerCase()) || allergy.toLowerCase().includes(term.toLowerCase())
        );
        if (found) matches.push(allergy);
      });

      setResult({ ...parsed, matches });
    } catch (e) {
      setError("Não consegui analisar essa imagem agora. Tente novamente com uma foto mais nítida do rótulo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label
          style={{ background: COLORS.cardAlt, border: `1px dashed ${COLORS.line}`, color: COLORS.inkSoft }}
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm cursor-pointer"
        >
          <Camera size={16} />
          {image ? "Trocar foto" : "Escolher foto"}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        </label>
        {image && (
          <img src={image.previewUrl} alt="Prévia" className="h-16 w-16 object-cover rounded-lg" style={{ border: `1px solid ${COLORS.line}` }} />
        )}
        {image && (
          <button
            onClick={analyze}
            disabled={loading}
            style={{ background: COLORS.sage, color: "white" }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            {loading ? "Analisando..." : "Analisar"}
          </button>
        )}
      </div>

      {error && <p className="text-xs mt-3" style={{ color: COLORS.danger }}>{error}</p>}

      {result && (
        <div className="mt-4">
          {result.matches.length > 0 ? (
            <div style={{ background: COLORS.dangerBg, borderLeft: `4px solid ${COLORS.danger}` }} className="rounded-lg px-4 py-3 mb-3">
              <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: COLORS.danger }}>
                <AlertTriangle size={15} /> Atenção: contém algo da sua lista de alergias
              </p>
              <p className="text-sm mt-1" style={{ color: COLORS.danger }}>
                Encontrado: {result.matches.join(", ")}. Não use sem confirmar com um profissional.
              </p>
            </div>
          ) : (
            <div style={{ background: COLORS.sageBg, borderLeft: `4px solid ${COLORS.sage}` }} className="rounded-lg px-4 py-3 mb-3">
              <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: COLORS.sageDark }}>
                <ShieldCheck size={15} /> Nada da sua lista de alergias identificado
              </p>
            </div>
          )}

          <div style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}` }} className="rounded-lg p-3">
            <p className="text-sm font-medium">{result.itemName}</p>
            <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>{result.type}</p>
            {(result.activeSubstances || []).length > 0 && (
              <p className="text-xs" style={{ color: COLORS.ink }}>
                <span style={{ color: COLORS.inkSoft }}>Princípios ativos: </span>
                {result.activeSubstances.join(", ")}
              </p>
            )}
            {(result.ingredients || []).length > 0 && (
              <p className="text-xs mt-1" style={{ color: COLORS.ink }}>
                <span style={{ color: COLORS.inkSoft }}>Ingredientes: </span>
                {result.ingredients.join(", ")}
              </p>
            )}
            {result.notes && <p className="text-xs mt-2 italic" style={{ color: COLORS.inkSoft }}>{result.notes}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function RoutineForm({ onAdd }) {
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);

  const toggleDay = (d) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const submit = () => {
    if (days.length === 0) return;
    onAdd(text, time, days);
    setText("");
    setTime("");
    setDays([0, 1, 2, 3, 4, 5, 6]);
  };

  return (
    <div>
      <div className="flex gap-2">
        <TextInput placeholder="ex: Tomar água, alongar, revisar agenda..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }} className="rounded-lg px-2 py-2 text-sm outline-none w-28" />
        <button onClick={submit} style={{ background: COLORS.ink, color: COLORS.card }} className="rounded-lg px-3 flex items-center"><Plus size={16} /></button>
      </div>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className="text-xs mr-1" style={{ color: COLORS.inkSoft }}>Repete:</span>
        {WEEKDAY_LABELS.map((label, i) => {
          const active = days.includes(i);
          return (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              style={{
                background: active ? COLORS.sage : COLORS.cardAlt,
                color: active ? "white" : COLORS.inkSoft,
                border: `1px solid ${active ? COLORS.sage : COLORS.line}`,
              }}
              className="text-xs w-8 h-7 rounded-md"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskForm({ onAdd }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState("media");
  const submit = () => {
    onAdd(text, due, dueTime, priority, true);
    setText(""); setDue(""); setDueTime(""); setPriority("media");
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1"><TextInput placeholder="O que precisa ser feito?" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }} className="rounded-lg px-2 py-2 text-sm outline-none" />
        <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }} className="rounded-lg px-2 py-2 text-sm outline-none w-24" />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }} className="rounded-lg px-2 py-2 text-sm outline-none">
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
        </select>
        <button onClick={submit} style={{ background: COLORS.ink, color: COLORS.card }} className="rounded-lg px-3 flex items-center justify-center"><Plus size={16} /></button>
      </div>
      <p className="text-xs" style={{ color: COLORS.inkSoft }}>
        🔔 Alertas até você concluir — baixa: {CADENCE_TEXT.baixa} (9h) · média: {CADENCE_TEXT.media} · alta: {CADENCE_TEXT.alta} (das 7h às 21h).
      </p>
    </div>
  );
}

function EntryForm({ onAdd, categories }) {
  const [desc, setDesc] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState("despesa");
  const [category, setCategory] = useState(categories?.[0] || "");
  const submit = () => { onAdd(desc, value, type, category); setDesc(""); setValue(""); };
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="flex-1"><TextInput placeholder="Descrição (ex: mercado, salário...)" value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
      <input type="number" placeholder="Valor" value={value} onChange={(e) => setValue(e.target.value)} style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }} className="rounded-lg px-2 py-2 text-sm outline-none w-28" />
      <select value={type} onChange={(e) => setType(e.target.value)} style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }} className="rounded-lg px-2 py-2 text-sm outline-none">
        <option value="despesa">Despesa</option>
        <option value="receita">Receita</option>
      </select>
      {type === "despesa" && (
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }} className="rounded-lg px-2 py-2 text-sm outline-none">
          {(categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
          {(!categories || categories.length === 0) && <option value="Outros">Outros</option>}
        </select>
      )}
      <button onClick={submit} style={{ background: COLORS.ink, color: COLORS.card }} className="rounded-lg px-3 flex items-center justify-center"><Plus size={16} /></button>
    </div>
  );
}

function CategoryForm({ onAdd }) {
  const [text, setText] = useState("");
  const submit = () => { onAdd(text); setText(""); };
  return (
    <div className="flex gap-2">
      <TextInput placeholder="Nova categoria (ex: Transporte)" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <button onClick={submit} style={{ background: COLORS.ink, color: COLORS.card }} className="rounded-lg px-3 flex items-center"><Plus size={16} /></button>
    </div>
  );
}

function GoalForm({ onAdd }) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [deadline, setDeadline] = useState("");
  const submit = () => { onAdd(text, target, unit, deadline); setText(""); setTarget(""); setUnit(""); setDeadline(""); };
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="flex-1"><TextInput placeholder="Meta (ex: Ler livros, Poupar, Correr km)" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
      <input type="number" placeholder="Alvo" value={target} onChange={(e) => setTarget(e.target.value)} style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }} className="rounded-lg px-2 py-2 text-sm outline-none w-20" />
      <input placeholder="unid." value={unit} onChange={(e) => setUnit(e.target.value)} style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }} className="rounded-lg px-2 py-2 text-sm outline-none w-20" />
      <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, color: COLORS.ink }} className="rounded-lg px-2 py-2 text-sm outline-none" />
      <button onClick={submit} style={{ background: COLORS.ink, color: COLORS.card }} className="rounded-lg px-3 flex items-center justify-center"><Plus size={16} /></button>
    </div>
  );
}
