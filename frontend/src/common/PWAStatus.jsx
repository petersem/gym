import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Toasts for the service worker: a reload prompt when a new version is ready,
 * a brief "works offline" note on first install, and an offline banner.
 */
function PWAStatus() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!offlineReady) {
      return;
    }
    const timer = setTimeout(() => setOfflineReady(false), 3000);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady && online) {
    return null;
  }

  return (
    <div className="toast toast-center toast-top z-50">
      {!online && (
        <div role="status" className="alert alert-warning">
          You&apos;re offline. Showing saved guest content where available.
        </div>
      )}
      {offlineReady && (
        <div role="status" className="alert alert-info">
          App ready to work offline.
        </div>
      )}
      {needRefresh && (
        <div role="alert" className="alert alert-info">
          <span>A new version is available.</span>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => updateServiceWorker(true)}
          >
            Reload
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setNeedRefresh(false)}
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}

export default PWAStatus;
