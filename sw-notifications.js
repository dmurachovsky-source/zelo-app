// Carregado pelo service worker do app (via importScripts).
// Trata os botões "Concluir" e "Fechar" das notificações do Zelo.

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const data = n.data || {};
  n.close();

  // Botão "Fechar": só some com a notificação.
  if (event.action === "close") return;

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // Botão "Concluir"
      if (event.action === "done" && data.kind && data.id) {
        if (all.length > 0) {
          // O app já está aberto (mesmo em segundo plano): ele marca como concluído sozinho.
          all.forEach((c) => c.postMessage({ type: "zelo-done", kind: data.kind, id: data.id }));
          return;
        }
        // App fechado: abre o Zelo já marcando como concluído.
        await self.clients.openWindow("/?done=" + encodeURIComponent(data.kind + ":" + data.id));
        return;
      }

      // Toque no corpo da notificação: abre/foca o app.
      if (all.length > 0) {
        await all[0].focus();
        return;
      }
      await self.clients.openWindow("/");
    })()
  );
});
