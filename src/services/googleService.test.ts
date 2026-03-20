import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ensureValidToken, revokeToken } from './googleService';
import type { GoogleToken } from '../types';

describe('googleService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal('window', {
      ...window,
      gapi: {
        client: {
          getToken: vi.fn(),
          setToken: vi.fn(),
        }
      }
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('ensureValidToken', () => {
    it('should return existing token if valid and not expiring', async () => {
      const validToken: GoogleToken = {
        access_token: 'valid_token',
        expires_in: 3600,
        expires_at: Date.now() + 10000, // 10s in future
        scope: 'scope',
        token_type: 'Bearer'
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(validToken));
      vi.mocked(window.gapi.client.getToken).mockReturnValue(validToken);

      const result = await ensureValidToken();
      expect(result).toEqual(validToken);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should refresh token if expired', async () => {
      const expiredToken: GoogleToken = {
        access_token: 'expired_token',
        expires_in: 3600,
        expires_at: Date.now() - 1000, // expired
        scope: 'scope',
        token_type: 'Bearer'
      };

      const newToken = {
        access_token: 'new_token',
        expires_in: 3570
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(expiredToken));
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => newToken
      } as Response);

      const result = await ensureValidToken();

      expect(fetch).toHaveBeenCalledWith('/api/auth/refresh');
      expect(result.access_token).toBe('new_token');
      expect(localStorage.setItem).toHaveBeenCalled();
      expect(window.gapi.client.setToken).toHaveBeenCalled();
    });

    it('should throw Unauthorized and cleanup if refresh fails with 401', async () => {
      const expiredToken: GoogleToken = {
        access_token: 'expired_token',
        expires_in: 3600,
        expires_at: Date.now() - 1000,
        scope: 'scope',
        token_type: 'Bearer'
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(expiredToken));
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401
      } as Response);

      await expect(ensureValidToken()).rejects.toThrow('Unauthorized');
      
      // Check correct cleanup order
      expect(window.gapi.client.setToken).toHaveBeenCalledWith(null);
      expect(localStorage.removeItem).toHaveBeenCalledWith('LUNA_AUTH_TOKEN');
    });
  });

  describe('revokeToken', () => {
    it('should call logout API and cleanup local state', async () => {
      await revokeToken();

      expect(fetch).toHaveBeenCalledWith('/api/auth/logout');
      expect(window.gapi.client.setToken).toHaveBeenCalledWith(null);
      expect(localStorage.removeItem).toHaveBeenCalledWith('LUNA_AUTH_TOKEN');
    });
  });
});
