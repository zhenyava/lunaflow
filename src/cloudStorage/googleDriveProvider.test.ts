import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleDriveProvider } from './googleDriveProvider';
import { AUTH_TOKEN_KEY } from '../constants';

// Helper to set window.gapi without replacing the entire window object
function stubGapi() {
  (window as unknown as Record<string, unknown>).gapi = {
    client: {
      getToken: vi.fn(),
      setToken: vi.fn(),
    },
  };
}

describe('GoogleDriveProvider', () => {
  let provider: GoogleDriveProvider;

  beforeEach(() => {
    provider = new GoogleDriveProvider();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    stubGapi();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('ensureValidToken', () => {
    it('should return existing token if valid and not expiring', async () => {
      const validToken = {
        access_token: 'valid_token',
        expires_in: 3600,
        expires_at: Date.now() + 10000,
        scope: 'scope',
        token_type: 'Bearer',
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(validToken));
      vi.mocked(window.gapi.client.getToken).mockReturnValue(validToken);

      const result = await provider.ensureValidToken();
      expect(result.accessToken).toBe('valid_token');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should refresh token if expired', async () => {
      const expiredToken = {
        access_token: 'expired_token',
        expires_in: 3600,
        expires_at: Date.now() - 1000,
        scope: 'scope',
        token_type: 'Bearer',
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(expiredToken));
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new_token', expires_in: 3570 }),
      } as Response);

      const result = await provider.ensureValidToken();

      expect(fetch).toHaveBeenCalledWith('/api/auth/google/refresh');
      expect(result.accessToken).toBe('new_token');
      expect(localStorage.setItem).toHaveBeenCalled();
      expect(window.gapi.client.setToken).toHaveBeenCalled();
    });

    it('should throw Unauthorized and cleanup if refresh fails', async () => {
      const expiredToken = {
        access_token: 'expired_token',
        expires_in: 3600,
        expires_at: Date.now() - 1000,
        scope: 'scope',
        token_type: 'Bearer',
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(expiredToken));
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response);

      await expect(provider.ensureValidToken()).rejects.toThrow('Unauthorized');

      expect(window.gapi.client.setToken).toHaveBeenCalledWith(null);
      expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
    });
  });

  describe('logout', () => {
    it('should call logout API and cleanup local state', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

      await provider.logout();

      expect(fetch).toHaveBeenCalledWith('/api/auth/logout');
      expect(window.gapi.client.setToken).toHaveBeenCalledWith(null);
      expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
    });
  });

  describe('parseCallbackToken', () => {
    it('should return null if no access_token in hash', () => {
      vi.stubGlobal('location', { hash: '', pathname: '/', search: '' });
      expect(provider.parseCallbackToken()).toBeNull();
    });

    it('should parse token from URL hash and clear it', () => {
      vi.stubGlobal('location', {
        hash: '#access_token=abc123&expires_in=3570',
        pathname: '/calendar/',
        search: '',
      });
      vi.stubGlobal('history', { replaceState: vi.fn() });

      const token = provider.parseCallbackToken();

      expect(token).not.toBeNull();
      expect(token!.accessToken).toBe('abc123');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        AUTH_TOKEN_KEY,
        expect.stringContaining('abc123')
      );
      expect(window.history.replaceState).toHaveBeenCalled();
    });
  });
});
