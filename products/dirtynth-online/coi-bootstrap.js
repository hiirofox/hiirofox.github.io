(() => {
  if (window.crossOriginIsolated || !("serviceWorker" in navigator) || location.protocol === "file:") {
    return;
  }

  let reloading = false;
  const reloadForIsolation = () => {
    if (reloading) {
      return;
    }
    reloading = true;
    location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", reloadForIsolation);

  navigator.serviceWorker
    .register("coi-serviceworker.js", { scope: "./" })
    .then((registration) => {
      if (registration.active && !navigator.serviceWorker.controller) {
        reloadForIsolation();
      }
    })
    .catch((error) => {
      console.warn("Cross-origin isolation service worker registration failed.", error);
    });
})();
