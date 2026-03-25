import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleDriveProvider } from './GoogleDriveProvider';
import type { DailyRecord, GoogleToken } from '../types';
import { runProviderComplianceTests } from './providerComplianceTests';

interface MockGapiResult {
  result: unknown;
}

describe('GoogleDriveProvider', () => {
  let provider: GoogleDriveProvider;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.stubGlobal('window', {
      ...window,
      location: {
        ...window.location,
        hash: '',
        pathname: '/',
        search: ''
      },
      gapi: {
        load: vi.fn((lib, cb) => cb()),
        client: {
          init: vi.fn().mockResolvedValue(undefined),
          getToken: vi.fn(),
          setToken: vi.fn(),
          drive: {
            files: {
              list: vi.fn(),
              create: vi.fn(),
              get: vi.fn(),
            }
          }
        }
      }
    });
    provider = new GoogleDriveProvider();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  // Run the shared compliance test suite
  runProviderComplianceTests(new GoogleDriveProvider());

  it('should have the correct name and id', () => {
    expect(provider.name).toBe('Google Drive');
    expect(provider.id).toBe('google-drive');
  });

  describe('initialize', () => {
    it('should initialize GAPI client', async () => {
      const onInit = vi.fn();
      
      // Mock script already present
      const script = document.createElement('script');
      script.src = "https://apis.google.com/js/api.js";
      document.body.appendChild(script);

      provider.initialize(onInit);
      
      // Wait for async initGapi to finish
      await vi.waitFor(() => {
        if (onInit.mock.calls.length === 0) throw new Error("Not called yet");
      });

      expect(window.gapi.load).toHaveBeenCalledWith('client', expect.any(Function));
      expect(onInit).toHaveBeenCalledWith(true);
      
      document.body.removeChild(script);
    });
  });

  describe('Auth Flow (ensureValidToken logic)', () => {
    it('should return existing token if valid', async () => {
      const validToken: GoogleToken = {
        access_token: 'valid_token',
        expires_in: 3600,
        expires_at: Date.now() + 10000,
        scope: 'scope',
        token_type: 'Bearer'
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(validToken));
      vi.mocked(window.gapi.client.getToken).mockReturnValue(validToken);

      // We trigger ensureValidToken by calling a method that uses it, like fetchData
      vi.mocked(window.gapi.client.drive.files.get).mockResolvedValue({ result: {} } as MockGapiResult);
      
      await provider.fetchData('file-id');
      
      expect(fetch).not.toHaveBeenCalledWith('/api/auth/refresh');
    });

    it('should refresh token if expired', async () => {
      const expiredToken: GoogleToken = {
        access_token: 'expired_token',
        expires_in: 3600,
        expires_at: Date.now() - 1000,
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
      
      vi.mocked(window.gapi.client.drive.files.get).mockResolvedValue({ result: {} } as MockGapiResult);

      await provider.fetchData('file-id');

      expect(fetch).toHaveBeenCalledWith('/api/auth/refresh');
      expect(localStorage.setItem).toHaveBeenCalledWith('LUNA_AUTH_TOKEN', expect.stringContaining('new_token'));
      expect(window.gapi.client.setToken).toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('should call logout API and cleanup local state', async () => {
      await provider.signOut();

      expect(fetch).toHaveBeenCalledWith('/api/auth/logout');
      expect(window.gapi.client.setToken).toHaveBeenCalledWith(null);
      expect(localStorage.removeItem).toHaveBeenCalledWith('LUNA_AUTH_TOKEN');
    });
  });

  describe('Drive API Operations', () => {
    it('should ensure drive file exists (found existing)', async () => {
      const validToken: GoogleToken = { 
        access_token: 't', 
        expires_at: Date.now() + 10000,
        expires_in: 3600,
        scope: 's',
        token_type: 'Bearer'
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(validToken));
      
      // 1. Mock finding the folder
      vi.mocked(window.gapi.client.drive.files.list).mockResolvedValueOnce({
        result: { files: [{ id: 'folder-id', name: 'LunaFlow' }] }
      } as MockGapiResult);
      
      // 2. Mock finding the file
      vi.mocked(window.gapi.client.drive.files.list).mockResolvedValueOnce({
        result: { files: [{ id: 'file-id', name: 'lunaflow_data.json' }] }
      } as MockGapiResult);

      const fileId = await provider.ensureFileExists();
      expect(fileId).toBe('file-id');
    });

    it('should fetch data from drive', async () => {
      const validToken: GoogleToken = { 
        access_token: 't', 
        expires_at: Date.now() + 10000,
        expires_in: 3600,
        scope: 's',
        token_type: 'Bearer'
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(validToken));
      
      const mockData = { records: [] };
      vi.mocked(window.gapi.client.drive.files.get).mockResolvedValue({
        result: mockData
      } as MockGapiResult);

      const data = await provider.fetchData('file-id');
      expect(data).toBe(mockData);
      expect(window.gapi.client.drive.files.get).toHaveBeenCalledWith({
        fileId: 'file-id',
        alt: 'media'
      });
    });

    it('should upload data to drive', async () => {
      const validToken: GoogleToken = { 
        access_token: 't', 
        expires_at: Date.now() + 10000,
        expires_in: 3600,
        scope: 's',
        token_type: 'Bearer'
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(validToken));
      
      vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

      const events: DailyRecord[] = [];
      await provider.uploadData('file-id', events);
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://www.googleapis.com/upload/drive/v3/files/file-id'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token exists', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('some-token');
      expect(provider.isAuthenticated()).toBe(true);
    });

    it('should return false when no token exists', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      expect(provider.isAuthenticated()).toBe(false);
    });
  });
});
