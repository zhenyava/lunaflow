import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCloudSync } from './useCloudSync';
import type { ICloudStorageProvider, CloudAuthToken } from '../cloudStorage';

function makeMockProvider(overrides: Partial<ICloudStorageProvider> = {}): ICloudStorageProvider {
  return {
    id: 'google-drive',
    displayName: 'Google Drive',
    initialize: vi.fn(() => Promise.resolve(true)),
    login: vi.fn(() => Promise.resolve()),
    restoreSession: vi.fn(() => Promise.resolve(null)),
    parseCallbackToken: vi.fn(() => null),
    ensureValidToken: vi.fn(() =>
      Promise.resolve({ accessToken: 'token', expiresAt: Date.now() + 3600000 } as CloudAuthToken)
    ),
    ensureFileExists: vi.fn(() => Promise.resolve('file-id')),
    uploadData: vi.fn(() => Promise.resolve()),
    fetchData: vi.fn(() => Promise.resolve([])),
    logout: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

const defaultMockProvider = makeMockProvider();

vi.mock('../cloudStorage', () => ({
  getActiveProviderId: vi.fn(() => 'google-drive'),
  getAllProviders: vi.fn(() => [defaultMockProvider]),
  getProvider: vi.fn(() => defaultMockProvider),
  setActiveProviderId: vi.fn(),
}));

import * as cloudStorage from '../cloudStorage';

describe('useCloudSync integration', () => {
  beforeEach(() => {
    vi.stubGlobal('location', {
      hash: '',
      pathname: '/',
      search: '',
    });
    vi.stubGlobal('history', { replaceState: vi.fn() });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    // Reset to default provider before each test
    vi.mocked(cloudStorage.getProvider).mockReturnValue(defaultMockProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call parseCallbackToken on mount', () => {
    renderHook(() => useCloudSync({ events: [], setEvents: vi.fn() }));
    expect(defaultMockProvider.parseCallbackToken).toHaveBeenCalled();
  });

  it('should call initialize on mount', async () => {
    renderHook(() => useCloudSync({ events: [], setEvents: vi.fn() }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(defaultMockProvider.initialize).toHaveBeenCalled();
  });

  it('should handle unauthorized error by logging out', async () => {
    const mockProvider = makeMockProvider({
      restoreSession: vi.fn(() =>
        Promise.resolve({ accessToken: 'valid', expiresAt: Date.now() + 100000 } as CloudAuthToken)
      ),
      ensureFileExists: vi.fn(() => Promise.resolve('file-id')),
      fetchData: vi.fn(() => Promise.reject({ status: 401 })),
    });
    vi.mocked(cloudStorage.getProvider).mockReturnValue(mockProvider);
    vi.mocked(cloudStorage.getAllProviders).mockReturnValue([mockProvider]);

    const { result } = renderHook(() =>
      useCloudSync({ events: [], setEvents: vi.fn() })
    );

    await waitFor(
      () => {
        expect(mockProvider.logout).toHaveBeenCalled();
      },
      { timeout: 500 }
    );

    expect(result.current.isAuthenticated).toBe(false);
  });
});
