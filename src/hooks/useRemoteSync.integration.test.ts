import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRemoteSync } from './useRemoteSync';
import type { RemoteStorageProvider } from '../storageProviders/RemoteStorageProviderInterface';

class MockStorageProvider implements RemoteStorageProvider {
  id = 'mock-provider';
  name = 'Mock Provider';
  
  initialize = vi.fn((onInit) => onInit(true));
  signIn = vi.fn(() => Promise.resolve());
  signOut = vi.fn(() => Promise.resolve());
  ensureFileExists = vi.fn(() => Promise.resolve('mock-file-id'));
  fetchData = vi.fn(() => Promise.resolve({ records: [] }));
  uploadData = vi.fn(() => Promise.resolve());
  isAuthenticated = vi.fn(() => true);
  restoreSession = vi.fn(() => Promise.resolve('mock-file-id'));
  handleCallback = vi.fn();
}

describe('useRemoteSync integration', () => {
  let provider: MockStorageProvider;

  beforeEach(() => {
    provider = new MockStorageProvider();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call handleCallback on mount', () => {
    renderHook(() => useRemoteSync({ events: [], setEvents: vi.fn(), provider }));
    expect(provider.handleCallback).toHaveBeenCalled();
  });

  it('should initialize the provider on mount', () => {
    renderHook(() => useRemoteSync({ events: [], setEvents: vi.fn(), provider }));
    expect(provider.initialize).toHaveBeenCalled();
  });

  it('should handle unauthorized error by logging out', async () => {
    const mockSetEvents = vi.fn();
    
    // Mock fetchData to fail with 401
    provider.fetchData.mockRejectedValue({ status: 401 });

    const { result } = renderHook(() => useRemoteSync({ events: [], setEvents: mockSetEvents, provider }));

    // Wait for the restore session effect
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(provider.signOut).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
