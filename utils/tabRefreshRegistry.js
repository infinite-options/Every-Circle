/** Handlers registered by main tab screens for footer "tap again to refresh". */
const refreshHandlers = {};

export function registerTabRefreshHandler(screenName, handler) {
  refreshHandlers[screenName] = handler;
  return () => {
    if (refreshHandlers[screenName] === handler) {
      delete refreshHandlers[screenName];
    }
  };
}

export function triggerTabRefresh(screenName) {
  refreshHandlers[screenName]?.();
}
