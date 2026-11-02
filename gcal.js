// Integração DIRETA com o Google Agenda (sem passar pelo Claude).
// Usa o login do Google (Google Identity Services) e a API REST do Calendar.
// Os dados ficam só no navegador do usuário (localStorage).

const CLIENT_ID_KEY = "zelo-google-client-id";
const TOKEN_KEY = "zelo-google-token";
const WAS_CONNECTED_KEY = "zelo-google-was-connected";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const API = "https://www.googleapis.com/calendar/v3";

const listeners = new Set();
const notify = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
export function subscribeGoogle(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// O Client ID pode vir do Vercel (variável VITE_GOOGLE_CLIENT_ID, vale pra todos os aparelhos)
// ou ter sido colado dentro do app (fica só naquele navegador).
export const getClientId = () => localStorage.getItem(CLIENT_ID_KEY) || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
export const hasLocalClientId = () => !!localStorage.getItem(CLIENT_ID_KEY);
export function setClientId(id) {
  localStorage.setItem(CLIENT_ID_KEY, (id || "").trim());
  notify();
}

function readToken() {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    if (t && t.access_token && t.expires_at > Date.now() + 60000) return t;
  } catch (e) {
    /* token inválido */
  }
  return null;
}

export const isGoogleConnected = () => !!readToken();
export const wasGoogleConnected = () => localStorage.getItem(WAS_CONNECTED_KEY) === "1";

export function disconnectGoogle() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WAS_CONNECTED_KEY);
  notify();
}

let gisPromise = null;
function loadGIS() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error("Não consegui carregar o login do Google. Confira a internet."));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

// Precisa ser chamado a partir de um toque/clique do usuário (senão o navegador bloqueia o popup).
export async function connectGoogle() {
  const clientId = getClientId();
  if (!clientId) throw new Error("NO_CLIENT_ID");
  await loadGIS();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (!resp || resp.error) {
          reject(new Error((resp && (resp.error_description || resp.error)) || "Falha no login do Google"));
          return;
        }
        const token = {
          access_token: resp.access_token,
          expires_at: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
        };
        localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
        localStorage.setItem(WAS_CONNECTED_KEY, "1");
        notify();
        resolve(token);
      },
      error_callback: (err) => reject(new Error((err && err.type) || "popup_closed")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

async function gfetch(path, options = {}) {
  const token = readToken();
  if (!token) throw new Error("NEEDS_AUTH");
  const res = await fetch(API + path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: "Bearer " + token.access_token,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    notify();
    throw new Error("NEEDS_AUTH");
  }
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((json.error && json.error.message) || "Erro " + res.status);
    err.status = res.status;
    throw err;
  }
  return json;
}

// Qual conta do Google está respondendo (o nome do calendário principal costuma ser o e-mail).
export async function gcalAccount() {
  const data = await gfetch(
    "/calendars/primary/events?maxResults=1&timeMin=" + encodeURIComponent(new Date().toISOString())
  );
  return { account: (data && data.summary) || "conta conectada", timeZone: data && data.timeZone };
}

const pad = (n) => String(n).padStart(2, "0");
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Eventos existentes na agenda (ignora os que o próprio Zelo criou, pra não duplicar).
export async function gcalListEvents(days = 14) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  const q =
    "/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=250" +
    "&timeMin=" + encodeURIComponent(from.toISOString()) +
    "&timeMax=" + encodeURIComponent(to.toISOString());
  const data = await gfetch(q);
  return ((data && data.items) || [])
    .filter((e) => e.status !== "cancelled")
    .filter((e) => !(e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.zelo === "1"))
    .map((e) => {
      if (e.start && e.start.dateTime) {
        const d = new Date(e.start.dateTime);
        return { title: e.summary || "(sem título)", date: localDate(d), time: localTime(d) };
      }
      return { title: e.summary || "(sem título)", date: (e.start && e.start.date) || "", time: null };
    })
    .filter((e) => e.date);
}

// Cria um evento (com alerta na hora de início). Devolve o id do evento.
export async function gcalInsert({ title, description, startISO, minutes = 10, recurrence = null, reminderMinutes = 0 }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = new Date(startISO);
  const end = new Date(start.getTime() + minutes * 60000);
  const body = {
    summary: title,
    description: description || "Criado pelo Zelo",
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: reminderMinutes }] },
    extendedProperties: { private: { zelo: "1" } },
  };
  if (recurrence) body.recurrence = recurrence;
  const created = await gfetch("/calendars/primary/events", { method: "POST", body: JSON.stringify(body) });
  return created.id;
}

export async function gcalDelete(id) {
  try {
    await gfetch("/calendars/primary/events/" + encodeURIComponent(id), { method: "DELETE" });
  } catch (e) {
    if (e && (e.status === 404 || e.status === 410)) return; // já não existe
    throw e;
  }
}
