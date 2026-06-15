(function () {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function () {
      /* SW isteğe bağlı; hata durumunda uygulama normal çalışır */
    });
  });
})();
