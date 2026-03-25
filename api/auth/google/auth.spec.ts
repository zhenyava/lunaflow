import { describe, it, expect, vi, beforeEach } from 'vitest';
import loginHandler from './login';
import callbackHandler from './callback';
import refreshHandler from './refresh';
import logoutHandler from '../logout';
import { createRequest, createResponse } from 'node-mocks-http';
import { getIronSession, IronSession } from 'iron-session';
import { SessionData } from '../../utils/session.js';

vi.mock('iron-session', () => ({
  getIronSession: vi.fn(),
}));

describe('Backend Auth Handlers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars';
  });

  describe('GET /api/auth/login', () => {
    it('should redirect to Google OAuth URL', async () => {
      const req = createRequest({ method: 'GET', headers: { host: 'localhost:3000' } });
      const res = createResponse();
      
      // Mock res.redirect which node-mocks-http provides
      res.redirect = vi.fn();

      await loginHandler(req, res);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('accounts.google.com'));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('client_id=test-client-id'));
    });
  });

  describe('GET /api/auth/callback', () => {
    it('should exchange code for tokens and set session', async () => {
      const req = createRequest({ 
        method: 'GET', 
        query: { code: 'test-code' },
        headers: { host: 'localhost:3000' }
      });
      const res = createResponse();
      res.redirect = vi.fn();

      const mockSession = { save: vi.fn() } as unknown as IronSession<SessionData>;
      vi.mocked(getIronSession).mockResolvedValue(mockSession);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'acc-token',
          refresh_token: 'ref-token',
          expires_in: 3600
        })
      } as Response);

      await callbackHandler(req, res);

      expect(fetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', expect.anything());
      expect(mockSession).toHaveProperty('refreshToken', 'ref-token');
      expect(mockSession.save).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('#access_token=acc-token'));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('expires_in=3570')); // 3600 - 30
    });
  });

  describe('GET /api/auth/refresh', () => {
    it('should return new access token if refresh token exists in session', async () => {
      const req = createRequest({ method: 'GET' });
      const res = createResponse();

      const mockSession = { refreshToken: 'stored-ref-token', save: vi.fn() } as unknown as IronSession<SessionData>;
      vi.mocked(getIronSession).mockResolvedValue(mockSession);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-acc-token',
          expires_in: 3600
        })
      } as Response);

      await refreshHandler(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.access_token).toBe('new-acc-token');
      expect(data.expires_in).toBe(3570);
      expect(mockSession.save).toHaveBeenCalled();
    });

    it('should return 401 if no refresh token in session', async () => {
      const req = createRequest({ method: 'GET' });
      const res = createResponse();

      vi.mocked(getIronSession).mockResolvedValue({} as unknown as IronSession<SessionData>);

      await refreshHandler(req, res);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/logout', () => {
    it('should destroy the session', async () => {
      const req = createRequest({ method: 'GET' });
      const res = createResponse();

      const mockSession = { destroy: vi.fn() } as unknown as IronSession<SessionData>;
      vi.mocked(getIronSession).mockResolvedValue(mockSession);

      await logoutHandler(req, res);

      expect(mockSession.destroy).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });
  });
});
