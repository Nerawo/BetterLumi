interface UpdateOptions {
  serviceWorkers: ServiceWorkerContainer;
  base: string;
  onAvailable: () => void;
  onError: () => void;
  reload: () => void;
}

/** Activation in another tab must never reload this tab without its own consent. */
export function watchForAppUpdate(options: UpdateOptions) {
  let disposed = false;
  let approved = false;
  let registration: ServiceWorkerRegistration | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const installing = new Set<ServiceWorker>();
  const available = () => { if (!disposed) options.onAvailable(); };
  const failed = () => { approved = false; if (!disposed) options.onError(); };
  const controllerChanged = () => {
    if (timeout) clearTimeout(timeout);
    if (disposed) return;
    if (approved) options.reload();
    else available();
  };
  const installed = () => {
    if (registration?.waiting) available();
  };
  const updateFound = () => {
    const worker = registration?.installing;
    if (worker) {
      installing.add(worker);
      worker.addEventListener('statechange', installed);
    }
  };
  options.serviceWorkers.addEventListener('controllerchange', controllerChanged);
  const ready = options.serviceWorkers.register(options.base + 'sw.js', {
    scope: options.base, updateViaCache: 'none',
  }).then(value => {
    if (disposed) return;
    registration = value;
    value.addEventListener('updatefound', updateFound);
    updateFound();
    installed();
  }).catch(failed);
  return {
    async applyUpdate() {
      await ready;
      if (disposed || !registration) { failed(); return; }
      approved = true;
      if (!registration.waiting) { options.reload(); return; }
      try {
        timeout = setTimeout(failed, 15000);
        registration.waiting.postMessage({type: 'SKIP_WAITING'});
      } catch { if (timeout) clearTimeout(timeout); failed(); }
    },
    dispose() {
      disposed = true;
      if (timeout) clearTimeout(timeout);
      options.serviceWorkers.removeEventListener('controllerchange', controllerChanged);
      registration?.removeEventListener('updatefound', updateFound);
      for (const worker of installing) worker.removeEventListener('statechange', installed);
    },
  };
}
