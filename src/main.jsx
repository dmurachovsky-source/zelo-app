import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

/* ------------------------------------------------------------------ */
/* 1) Polyfill do window.storage — troca o armazenamento do Claude    */
/*    pelo localStorage do navegador. Mesma interface, então o        */
/*    App.jsx não precisa mudar nada.                                 */
/* ------------------------------------------------------------------ */
window.storage = {
  async get(key) {
    const raw = localStorage.getItem("zelo:" + key);
    if (raw === null) return null;
    return { key, value: raw };
  },
  async set(key, value) {
    localStorage.setItem("zelo:" + key, value);
    return { key, value };
  },
  async delete(key) {
    localStorage.removeItem("zelo:" + key);
    return { key, deleted: true };
  },
  async list(prefix = "") {
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith("zelo:" + prefix))
      .map((k) => k.replace(/^zelo:/, ""));
    return { keys };
  },
};

/* ------------------------------------------------------------------ */
/* 2) Interceptor de fetch — toda chamada para api.anthropic.com      */
/*    ganha automaticamente a sua chave pessoal (guardada no          */
/*    navegador) e os cabeçalhos exigidos pra chamar direto do        */
/*    navegador. Assim o App.jsx também não precisa mudar nada.       */
/* ------------------------------------------------------------------ */
const ORIGINAL_FETCH = window.fetch.bind(window);
window.fetch = (url, options = {}) => {
  const isAnthropic = typeof url === "string" && url.startsWith("https://api.anthropic.com");
  if (isAnthropic) {
    const apiKey = localStorage.getItem("zelo-api-key") || "";
    options = {
      ...options,
      headers: {
        ...(options.headers || {}),
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
    };
  }
  return ORIGINAL_FETCH(url, options);
};

/* ------------------------------------------------------------------ */
/* 3) Tela simples de configuração da chave de API                    */
/* ------------------------------------------------------------------ */
function SettingsGate() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(localStorage.getItem("zelo-api-key") || "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem("zelo-api-key", key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <App />
      <button
        onClick={() => setOpen(true)}
        title="Configurar chave de API"
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "#3A3226",
          color: "#F8F4EA",
          border: "none",
          fontSize: 16,
          zIndex: 40,
          boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
        }}
      >
        ⚙️
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#F8F4EA", borderRadius: 16, padding: 20, maxWidth: 380, width: "100%" }}
          >
            <h3 style={{ fontFamily: "sans-serif", fontWeight: 700, marginBottom: 8 }}>Chave da API (Anthropic)</h3>
            <p style={{ fontSize: 13, color: "#7A6E5B", marginBottom: 10 }}>
              Cole aqui sua chave de console.anthropic.com. Ela fica salva só neste navegador/celular, nunca é enviada
              pra mais lugar nenhum além da própria Anthropic.
            </p>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-ant-..."
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #DCD3C1", marginBottom: 10, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setOpen(false)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #DCD3C1", background: "transparent" }}>
                Fechar
              </button>
              <button onClick={save} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "#7C8B6F", color: "white", fontWeight: 600 }}>
                {saved ? "Salvo!" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SettingsGate />
  </React.StrictMode>
);
