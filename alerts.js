// Regras de alerta por prioridade. Tudo baseado em "horários fixos do dia" (slots),
// assim o alerta do Zelo e o alerta da Agenda do Google caem nos mesmos horários.
//
//  baixa  → 1 vez por dia (09h)
//  média  → a cada 4h (09h, 13h, 17h, 21h)
//  alta   → de hora em hora (07h até 21h)
//
// Nada toca de madrugada: o primeiro slot é 07h e o último é 21h.

export const SLOT_HOURS = {
  baixa: [9],
  media: [9, 13, 17, 21],
  alta: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
};

export const CADENCE_TEXT = {
  baixa: "1x por dia",
  media: "a cada 4h",
  alta: "de hora em hora",
};

// Quantas horas à frente a Agenda do Google é "abastecida" de alertas.
export const WINDOW_HOURS = { baixa: 120, media: 72, alta: 24 };

const hoursFor = (p) => SLOT_HOURS[p] || SLOT_HOURS.media;

// Último horário de alerta de hoje que já passou (ou null se ainda não chegou o primeiro).
export function latestSlot(priority, now) {
  const hs = hoursFor(priority);
  for (let i = hs.length - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(hs[i], 0, 0, 0);
    if (d.getTime() <= now.getTime()) return d;
  }
  return null;
}

// Próximos horários de alerta (em milissegundos), dentro da janela.
export function upcomingSlots(priority, now, hoursAhead) {
  const hs = hoursFor(priority);
  const horizon = hoursAhead || WINDOW_HOURS[priority] || 24;
  const limit = now.getTime() + horizon * 3600000;
  const days = Math.ceil(horizon / 24) + 1;
  const out = [];
  for (let day = 0; day <= days; day++) {
    for (const h of hs) {
      const d = new Date(now);
      d.setDate(d.getDate() + day);
      d.setHours(h, 0, 0, 0);
      const ms = d.getTime();
      if (ms > now.getTime() + 60000 && ms <= limit) out.push(ms);
    }
  }
  return out.sort((a, b) => a - b);
}

// Notificação do sistema (aparece mesmo com a tela bloqueada, se o app estiver ativo),
// com os botões "Concluir" e "Fechar".
export async function showNativeAlert({ title, body, tag, data }) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options = {
    body,
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data,
    actions: [
      { action: "done", title: "✓ Concluir" },
      { action: "close", title: "Fechar" },
    ],
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return;
      }
    }
  } catch (e) {
    /* cai no fallback abaixo */
  }
  try {
    new Notification(title, { body, tag, icon: options.icon });
  } catch (e) {
    /* notificações bloqueadas neste ambiente */
  }
}
