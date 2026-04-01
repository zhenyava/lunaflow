import type { AuthProvider } from './AuthProviderInterface';

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
export const LUNA_AUTH_TOKEN = 'lunaflow_auth_token';

export interface GoogleToken {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  expires_at?: number;
}

interface GapiClient {
  load: (lib: string, callback: () => void) => void;
  client: {
    init: (config: { discoveryDocs: string[] }) => Promise<void>;
    setToken: (token: GoogleToken | null) => void;
    getToken: () => GoogleToken | null;
    drive: {
      files: {
        list: (params: Record<string, unknown>) => Promise<{ result: { files: Array<{ id: string; name: string }> } }>;
        create: (params: Record<string, unknown>) => Promise<{ result: { id: string } }>;
        get: (params: Record<string, unknown>) => Promise<{ result: unknown }>;
      };
    };
  };
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gapi: GapiClient;
  }
}

export class GoogleAuthProvider implements AuthProvider {
  readonly id = 'google-auth';
  readonly name = 'Google';
  private _authListeners = new Set<(isAuthenticated: boolean) => void>();
  private _gapiInited = false;
  private _initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this._initPromise) return this._initPromise;
    this._initPromise = (async () => {
      this.handleCallback();
      await this.initGapi();
      this.restoreGapiSession();
    })();
    return this._initPromise;
  }

  private handleCallback(): void {
    if (window.location.hash.includes('access_token=')) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = params.get('access_token');
      const expiresInStr = params.get('expires_in');

      if (accessToken && expiresInStr) {
        const expiresIn = parseInt(expiresInStr, 10);
        const expiresAt = Date.now() + expiresIn * 1000;

        const token: GoogleToken = {
          access_token: accessToken,
          expires_in: expiresIn,
          scope: GOOGLE_SCOPES,
          token_type: 'Bearer',
          expires_at: expiresAt,
        };

        localStorage.setItem(LUNA_AUTH_TOKEN, JSON.stringify(token));
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }

  private initGapi(): Promise<void> {
    return new Promise((resolve) => {
      const doInit = async () => {
        try {
          await window.gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });
          this._gapiInited = true;
        } catch (e) {
          console.error('Error initializing GAPI client', e);
        }
        resolve();
      };

      if (!document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => window.gapi.load('client', doInit);
        document.body.appendChild(script);
      } else if (window.gapi) {
        if (!this._gapiInited) {
          window.gapi.load('client', doInit);
        } else {
          resolve();
        }
      } else {
        resolve();
      }
    });
  }

  async signIn(): Promise<void> {
    window.location.href = '/api/auth/login';
    return new Promise(() => {});
  }

  async signOut(): Promise<void> {
    try {
      await fetch('/api/auth/logout');
      localStorage.removeItem(LUNA_AUTH_TOKEN);
      if (window.gapi && window.gapi.client) {
        window.gapi.client.setToken(null);
      }
    } catch (e) {
      console.warn('Error revoking token', e);
    }
    this._authListeners.forEach(fn => fn(false));
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(LUNA_AUTH_TOKEN);
  }

  async getToken(): Promise<{ access_token: string }> {
    return this.ensureValidToken();
  }

  onAuthStateChange(fn: (isAuthenticated: boolean) => void): () => void {
    this._authListeners.add(fn);
    return () => this._authListeners.delete(fn);
  }

  private restoreGapiSession(): void {
    const storedStr = localStorage.getItem(LUNA_AUTH_TOKEN);
    if (!storedStr) return;
    const token: GoogleToken = JSON.parse(storedStr);
    if (window.gapi && window.gapi.client) {
      window.gapi.client.setToken(token);
    }
  }

  private async ensureValidToken(): Promise<GoogleToken> {
    const storedStr = localStorage.getItem(LUNA_AUTH_TOKEN);
    if (!storedStr) throw new Error('No token found');

    const token: GoogleToken = JSON.parse(storedStr);
    const now = Date.now();

    if (token.expires_at && token.expires_at > now) {
      const currentGapiToken = window.gapi?.client?.getToken();
      if (!currentGapiToken || currentGapiToken.access_token !== token.access_token) {
        this.restoreGapiSession();
      }
      return token;
    }

    try {
      const response = await fetch('/api/auth/refresh');
      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const data = await response.json();
      const expiresAt = Date.now() + data.expires_in * 1000;

      const newToken: GoogleToken = {
        ...token,
        access_token: data.access_token,
        expires_in: data.expires_in,
        expires_at: expiresAt,
      };

      localStorage.setItem(LUNA_AUTH_TOKEN, JSON.stringify(newToken));
      if (window.gapi && window.gapi.client) {
        window.gapi.client.setToken(newToken);
      }

      if (window.dataLayer) {
        window.dataLayer.push({ event: 'google_drive_token_refresh' });
      }

      return newToken;
    } catch (error) {
      console.error('Token refresh error', error);
      if (window.gapi && window.gapi.client) window.gapi.client.setToken(null);
      localStorage.removeItem(LUNA_AUTH_TOKEN);
      throw new Error('Unauthorized');
    }
  }
}
