import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRemoteSync } from './useRemoteSync';
import type { RemoteStorageProvider } from '../storageProviders/RemoteStorageProviderInterface';

class MockStorageProvider implements RemoteStorageProvider {
  id = 'mock-provider';
  name = 'Mock Provider';
  initialize = vi.fn((onInit: (success: boolean) => void) => onInit(true));
  signIn = vi.fn(() => Promise.resolve());
  signOut = vi.fn(() => Promise.resolve());
  ensureFileExists = vi.fn(() => Promise.resolve('mock-file-id'));
  fetchData = vi.fn(() => Promise.resolve({ ver: 2, records: [] }));
  uploadData = vi.fn(() => Promise.resolve());
  isAuthenticated = vi.fn(() => false);
  restoreSession = vi.fn(() => Promise.resolve(null));
  handleCallback = vi.fn();
}

describe('useRemoteSync - offline detection', () => {
  let provider: MockStorageProvider;

  beforeEach(() => {
    provider = new MockStorageProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with idle status when online', () => {
    const { result, unmount } = renderHook(() =>
      useRemoteSync({ events: [], setEvents: vi.fn(), provider })
    );
    expect(result.current.syncState.status).toBe('idle');
    unmount();
  });

  it('sets syncState to offline when offline event fires', () => {
    const { result, unmount } = renderHook(() =>
      useRemoteSync({ events: [], setEvents: vi.fn(), provider })
    );

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.syncState.status).toBe('offline');
    unmount();
  });

  it('clears offline status when online event fires after being offline', () => {
    const { result, unmount } = renderHook(() =>
      useRemoteSync({ events: [], setEvents: vi.fn(), provider })
    );

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.syncState.status).toBe('offline');

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.syncState.status).toBe('idle');
    unmount();
  });
});
