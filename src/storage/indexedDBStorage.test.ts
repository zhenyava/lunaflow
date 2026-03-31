import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IndexedDBProvider } from './indexedDBStorage';

const DB_NAME = 'testDb';
const STORE_NAME = 'testStore';
const KEY = 'testKey';

describe('IndexedDBProvider', () => {
  let provider: IndexedDBProvider;

  beforeEach(() => {
    provider = new IndexedDBProvider(DB_NAME, STORE_NAME, KEY);
  });

  afterEach(async () => {
    await provider.close();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    vi.restoreAllMocks();
  });

  describe('read', () => {
    it('returns null when key does not exist', async () => {
      const result = await provider.read();
      expect(result).toBeNull();
    });

    it('returns the value previously written', async () => {
      await provider.write({ foo: 'bar' });
      const result = await provider.read();
      expect(result).toEqual({ foo: 'bar' });
    });

    it('round-trips a plain object', async () => {
      const data = { a: 1, b: 'hello', c: true };
      await provider.write(data);
      expect(await provider.read()).toEqual(data);
    });

    it('round-trips a string', async () => {
      await provider.write('hello');
      expect(await provider.read()).toBe('hello');
    });

    it('round-trips a number', async () => {
      await provider.write(42);
      expect(await provider.read()).toBe(42);
    });

    it('round-trips null', async () => {
      await provider.write(null);
      expect(await provider.read()).toBeNull();
    });
  });

  describe('write', () => {
    it('persists data readable by a subsequent read', async () => {
      await provider.write({ x: 99 });
      expect(await provider.read()).toEqual({ x: 99 });
    });

    it('overwrites the previously stored value', async () => {
      await provider.write({ version: 1 });
      await provider.write({ version: 2 });
      expect(await provider.read()).toEqual({ version: 2 });
    });
  });

  describe('close', () => {
    it('nullifies the internal db promise so a subsequent open creates a new connection', async () => {
      // Force a connection to open
      await provider.read();
      const openSpy = vi.spyOn(indexedDB, 'open');
      await provider.close();
      // After close, the next operation must re-open
      await provider.read();
      expect(openSpy).toHaveBeenCalledOnce();
    });

    it('read/write succeed after close', async () => {
      await provider.write({ before: true });
      await provider.close();
      await provider.write({ after: true });
      expect(await provider.read()).toEqual({ after: true });
    });

    it('is safe to call when never opened', async () => {
      await expect(provider.close()).resolves.toBeUndefined();
    });
  });

  describe('connection reuse', () => {
    it('opens the database only once across multiple reads', async () => {
      const openSpy = vi.spyOn(indexedDB, 'open');
      await provider.read();
      await provider.read();
      await provider.read();
      expect(openSpy).toHaveBeenCalledOnce();
    });

    it('opens the database only once across interleaved reads and writes', async () => {
      const openSpy = vi.spyOn(indexedDB, 'open');
      await provider.write({ n: 1 });
      await provider.read();
      await provider.write({ n: 2 });
      expect(openSpy).toHaveBeenCalledOnce();
    });
  });

  describe('error handling', () => {
    it('read rejects when the database fails to open', async () => {
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const req = {} as IDBOpenDBRequest;
        queueMicrotask(() => {
          req.onerror?.({ target: req } as unknown as Event);
        });
        return req;
      });
      const failingProvider = new IndexedDBProvider(DB_NAME, STORE_NAME, KEY);
      await expect(failingProvider.read()).rejects.toBeUndefined();
    });

    it('write rejects when the database fails to open', async () => {
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const req = {} as IDBOpenDBRequest;
        queueMicrotask(() => {
          req.onerror?.({ target: req } as unknown as Event);
        });
        return req;
      });
      const failingProvider = new IndexedDBProvider(DB_NAME, STORE_NAME, KEY);
      await expect(failingProvider.write({ data: 1 })).rejects.toBeUndefined();
    });
  });
});
