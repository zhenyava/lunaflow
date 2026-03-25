import type { ICloudStorageProvider, CloudAuthToken } from './ICloudStorageProvider';
import type { DailyRecord } from '../types';
import { prepareDataForStorage, parseAndMigrateData } from '../services/storageService';
import { AUTH_TOKEN_KEY, FOLDER_NAME, APP_DATA_FILENAME } from '../constants';

// Google-specific token shape (internal to this provider)
interface GoogleToken {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  expires_at?: number;
}

interface GapiFileResult<T = unknown> {
  result: T;
}

interface GapiClient {
  load: (lib: string, callback: () => void) => void;
  client: {
    init: (config: { discoveryDocs: string[] }) => Promise<void>;
    setToken: (token: GoogleToken | null) => void;
    getToken: () => GoogleToken | null;
    drive: {
      files: {
        list: (params: Record<string, unknown>) => Promise<GapiFileResult<{ files: Array<{ id: string; name: string }> }>>;
        create: (params: Record<string, unknown>) => Promise<GapiFileResult<{ id: string }>>;
        get: (params: Record<string, unknown>) => Promise<GapiFileResult<unknown>>;
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

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

export class GoogleDriveProvider implements ICloudStorageProvider {
  readonly id = 'google-drive';
  readonly displayName = 'Google Drive';

  private gapiInited = false;

  initialize(): Promise<boolean> {
    return new Promise((resolve) => {
      const initGapi = async () => {
        try {
          await window.gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });
          this.gapiInited = true;
          resolve(true);
        } catch (e: unknown) {
          console.error('Error initializing GAPI client', e);
          resolve(false);
        }
      };

      if (!document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => window.gapi.load('client', initGapi);
        document.body.appendChild(script);
      } else if (window.gapi) {
        if (!this.gapiInited) window.gapi.load('client', initGapi);
        else resolve(true);
      }
    });
  }

  login(): Promise<void> {
    window.location.href = '/api/auth/google/login';
    return new Promise(() => {});
  }

  parseCallbackToken(): CloudAuthToken | null {
    if (!window.location.hash.includes('access_token=')) return null;

    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get('access_token');
    const expiresInStr = params.get('expires_in');

    if (!accessToken || !expiresInStr) return null;

    const expiresIn = parseInt(expiresInStr, 10);
    const expiresAt = Date.now() + expiresIn * 1000;

    const token: GoogleToken = {
      access_token: accessToken,
      expires_in: expiresIn,
      scope: GOOGLE_SCOPES,
      token_type: 'Bearer',
      expires_at: expiresAt,
    };

    localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(token));
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    return { accessToken, expiresAt };
  }

  async restoreSession(): Promise<CloudAuthToken | null> {
    const storedStr = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!storedStr) return null;

    try {
      const token: GoogleToken = JSON.parse(storedStr);
      if (window.gapi?.client) {
        window.gapi.client.setToken(token);
      }
      return {
        accessToken: token.access_token,
        expiresAt: token.expires_at ?? 0,
      };
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      return null;
    }
  }

  async ensureValidToken(): Promise<CloudAuthToken> {
    const storedStr = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!storedStr) throw new Error('No token found');

    const token: GoogleToken = JSON.parse(storedStr);
    const now = Date.now();

    if (token.expires_at && token.expires_at > now) {
      const currentGapiToken = window.gapi?.client?.getToken();
      if (!currentGapiToken || currentGapiToken.access_token !== token.access_token) {
        window.gapi?.client?.setToken(token);
      }
      return { accessToken: token.access_token, expiresAt: token.expires_at };
    }

    // Token expired — refresh via backend
    try {
      const response = await fetch('/api/auth/google/refresh');
      if (!response.ok) throw new Error(`Refresh failed: ${response.status}`);

      const data = await response.json();
      const expiresAt = Date.now() + data.expires_in * 1000;

      const newToken: GoogleToken = {
        ...token,
        access_token: data.access_token,
        expires_in: data.expires_in,
        expires_at: expiresAt,
      };

      localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(newToken));
      window.gapi?.client?.setToken(newToken);

      if (window.dataLayer) {
        window.dataLayer.push({ event: 'google_drive_token_refresh' });
      }

      return { accessToken: newToken.access_token, expiresAt };
    } catch (error) {
      console.error('Token refresh error', error);
      window.gapi?.client?.setToken(null);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      throw new Error('Unauthorized');
    }
  }

  async ensureFileExists(): Promise<string> {
    try {
      const token = await this.ensureValidToken();

      // 1. Find or create the LunaFlow folder
      let folderId = '';
      const folderResponse = await window.gapi.client.drive.files.list({
        q: `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      const folders = folderResponse.result.files;
      if (folders && folders.length > 0) {
        folderId = folders[0].id;
      } else {
        const createFolderResponse = await window.gapi.client.drive.files.create({
          resource: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
          fields: 'id',
        });
        folderId = createFolderResponse.result.id;
      }

      // 2. Check if data file exists inside the folder
      const fileResponse = await window.gapi.client.drive.files.list({
        spaces: 'drive',
        fields: 'files(id, name)',
        q: `name = '${APP_DATA_FILENAME}' and '${folderId}' in parents and trashed = false`,
        pageSize: 1,
      });

      const files = fileResponse.result.files;
      if (files && files.length > 0) return files[0].id;

      // 3. Create initial empty file
      const initialContent = JSON.stringify(prepareDataForStorage([]));
      const file = new Blob([initialContent], { type: 'application/json' });
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: APP_DATA_FILENAME, parents: [folderId], mimeType: 'application/json' })], { type: 'application/json' }));
      form.append('file', file);

      const createResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.accessToken}` },
        body: form,
      });

      if (!createResponse.ok) throw new Error(`Failed to create file: ${createResponse.statusText}`);
      const result = await createResponse.json();
      return result.id;
    } catch (error) {
      console.error('Error ensuring drive file exists:', error);
      throw error;
    }
  }

  async uploadData(fileRef: string, records: DailyRecord[]): Promise<void> {
    const token = await this.ensureValidToken();
    const fileContent = JSON.stringify(prepareDataForStorage(records));

    try {
      const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileRef}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: fileContent,
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('Unauthorized');
        throw new Error(`Upload failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Drive Upload Error', error);
      throw error;
    }
  }

  async fetchData(fileRef: string): Promise<DailyRecord[]> {
    try {
      await this.ensureValidToken();
      const fileResponse = await window.gapi.client.drive.files.get({
        fileId: fileRef,
        alt: 'media',
      });
      const { records } = parseAndMigrateData(fileResponse.result);
      return records;
    } catch (error) {
      console.error('Fetch Content Error', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout');
      localStorage.removeItem(AUTH_TOKEN_KEY);
      window.gapi?.client?.setToken(null);
    } catch (e) {
      console.warn('Error revoking token', e);
    }
  }
}
