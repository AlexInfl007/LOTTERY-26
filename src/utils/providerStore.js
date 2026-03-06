let sharedProvider = null;

export function setSharedProvider(provider) {
  sharedProvider = provider || null;
}

export function getSharedProvider() {
  return sharedProvider;
}

export function clearSharedProvider() {
  sharedProvider = null;
}
