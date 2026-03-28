const dbCache = new Map<string, Promise<IDBDatabase>>();

export const openDB = (dbName: string, storeName: string): Promise<IDBDatabase> => {
  const cacheKey = `${dbName}:${storeName}`;
  if (!dbCache.has(cacheKey)) {
    dbCache.set(cacheKey, new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  }
  return dbCache.get(cacheKey)!;
};

export const read = async (dbName: string, storeName: string, key: string): Promise<unknown> => {
  const db = await openDB(dbName, storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
};

export const write = async (dbName: string, storeName: string, key: string, data: unknown): Promise<void> => {
  const db = await openDB(dbName, storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).put(data, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const closeDB = async (dbName: string, storeName: string): Promise<void> => {
  const cacheKey = `${dbName}:${storeName}`;
  const dbPromise = dbCache.get(cacheKey);
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbCache.delete(cacheKey);
  }
};
