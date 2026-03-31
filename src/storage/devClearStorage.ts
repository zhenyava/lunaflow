export async function devClearStorage(): Promise<void> {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('lunaflow'))
    .forEach((k) => localStorage.removeItem(k));

  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('lunaflow');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
