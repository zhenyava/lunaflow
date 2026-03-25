import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRemoteSync } from './useRemoteSync';
import * as googleService from '../services/googleService';
import { googleDriveProvider } from '../storageProviders/GoogleDriveProvider';

vi.mock('../services/googleService', () => ({
  initializeGoogleApi: vi.fn((onInit) => onInit(true)),
  signInToGoogle: vi.fn(),
  ensureDriveFileExists: vi.fn(() => Promise.resolve('file-id')),
  uploadDriveData: vi.fn(() => Promise.resolve()),
  fetchDriveDataContent: vi.fn(() => Promise.resolve({ records: [] })),
  revokeToken: vi.fn(() => Promise.resolve()),
  restoreGapiSession: vi.fn(),
  ensureValidToken: vi.fn(() => Promise.resolve()),
}));

describe('useRemoteSync integration', () => {
  beforeEach(() => {
    vi.stubGlobal('location', {
      ...window.location,
      hash: '',
      pathname: '/',
      search: ''
    });
    vi.stubGlobal('history', {
      replaceState: vi.fn()
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should parse access_token from URL hash on mount', async () => {
    // Mock hash fragment
    vi.stubGlobal('location', {
      ...window.location,
      hash: '#access_token=test_token&expires_in=3570'
    });

    renderHook(() => useRemoteSync({ events: [], setEvents: vi.fn(), provider: googleDriveProvider }));

    expect(localStorage.setItem).toHaveBeenCalledWith('LUNA_AUTH_TOKEN', expect.stringContaining('test_token'));
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('should handle unauthorized error by logging out (Scenario 3)', async () => {
    const mockSetEvents = vi.fn();
    
    // Simulate being logged in
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({
      access_token: 'valid',
      expires_at: Date.now() + 100000
    }));
    
    // Mock fetchDriveDataContent to fail with 401
    vi.mocked(googleService.fetchDriveDataContent).mockRejectedValue({ status: 401 });

    const { result } = renderHook(() => useRemoteSync({ events: [], setEvents: mockSetEvents, provider: googleDriveProvider }));

    // Wait for the restore session effect
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(googleService.revokeToken).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
