import type { DailyRecord, GoogleToken } from '../types';
import { APP_DATA_FILENAME, STORAGE_FOLDER_NAME } from '../constants';
import { prepareDataForStorage } from '../services/storageService';
import type { RemoteStorageProvider } from './RemoteStorageProviderInterface';

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
const LUNA_AUTH_TOKEN = 'lunaflow_auth_token';

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

/**
 * Google Drive implementation of the RemoteStorageProvider.
 */
export class GoogleDriveProvider implements RemoteStorageProvider {
  readonly id = 'google-drive';
  readonly name = 'Google Drive';
  private gapiInited = false;

  handleCallback(): void {
    if (window.location.hash.includes('access_token=')) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = params.get('access_token');
      const expiresInStr = params.get('expires_in');
      
      if (accessToken && expiresInStr) {
        const expiresIn = parseInt(expiresInStr, 10);
        const expiresAt = Date.now() + (expiresIn * 1000);
        
        const token: GoogleToken = {
          access_token: accessToken,
          expires_in: expiresIn,
          scope: GOOGLE_SCOPES,
          token_type: 'Bearer',
          expires_at: expiresAt
        };
        
        localStorage.setItem(LUNA_AUTH_TOKEN, JSON.stringify(token));
        
        // Clean the URL hash
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }

  initialize(onInit: (success: boolean) => void): void {
    const initGapi = async () => {
      try {
        await window.gapi.client.init({
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        });
        this.gapiInited = true;
        onInit(true);
      } catch (e: unknown) {
        console.error("Error initializing GAPI client", e);
        onInit(false);
      }
    };

    // Load GAPI script if not present
    if (!document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
        const script1 = document.createElement('script');
        script1.src = "https://apis.google.com/js/api.js";
        script1.onload = () => window.gapi.load('client', initGapi);
        document.body.appendChild(script1);
    } else if (window.gapi) {
        if (!this.gapiInited) window.gapi.load('client', initGapi);
        else onInit(true);
    }
  }

  async signIn(): Promise<void> {
    window.location.href = '/api/auth/login';
    // Return a promise that never resolves so the caller waits for navigation
    return new Promise(() => {});
  }

  async signOut(): Promise<void> {
    try {
        // Clear HttpOnly cookie on backend
        await fetch('/api/auth/logout');
        
        // Clear local state
        localStorage.removeItem(LUNA_AUTH_TOKEN);
        if (window.gapi && window.gapi.client) {
            window.gapi.client.setToken(null);
        }
    } catch(e) {
        console.warn("Error revoking token", e);
    }
  }

  async ensureFileExists(): Promise<string> {
    try {
      const token = await this.ensureValidToken();

      // 1. Find or create the LunaFlow folder
      let folderId = '';
      const folderResponse = await window.gapi.client.drive.files.list({
        q: `name = '${STORAGE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      const folders = folderResponse.result.files;
      if (folders && folders.length > 0) {
        folderId = folders[0].id;
      } else {
        const folderMetadata = {
          name: STORAGE_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        };
        const createFolderResponse = await window.gapi.client.drive.files.create({
          resource: folderMetadata,
          fields: 'id'
        });
        folderId = createFolderResponse.result.id;
      }

      // 2. Check if file exists inside the folder
      const response = await window.gapi.client.drive.files.list({
        spaces: 'drive',
        fields: 'files(id, name)',
        q: `name = '${APP_DATA_FILENAME}' and '${folderId}' in parents and trashed = false`,
        pageSize: 1
      });

      const files = response.result.files;
      if (files && files.length > 0) {
        return files[0].id;
      }

      // 3. Create file in visible folder
      const metadata = {
        name: APP_DATA_FILENAME,
        parents: [folderId],
        mimeType: 'application/json'
      };

      const initialData = prepareDataForStorage([]);
      const initialContent = JSON.stringify(initialData);
      const file = new Blob([initialContent], { type: 'application/json' });

      const accessToken = token.access_token;
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const createResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        body: form
      });
      
      if (!createResponse.ok) {
          throw new Error(`Failed to create file: ${createResponse.statusText}`);
      }

      const result = await createResponse.json();
      return result.id;
    } catch (error) {
      console.error("Error ensuring drive file exists:", error);
      throw error;
    }
  }

  async fetchData(fileId: string): Promise<unknown> {
    try {
        await this.ensureValidToken();
        const fileResponse = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        return fileResponse.result; // Returns raw parsed JSON
    } catch (error) {
        console.error("Fetch Content Error", error);
        throw error;
    }
  }

  async uploadData(fileId: string, events: DailyRecord[]): Promise<void> {
    const token = await this.ensureValidToken();

    const data = prepareDataForStorage(events);
    const fileContent = JSON.stringify(data);
    const accessToken = token.access_token;
    
    try {
      const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: fileContent
      });

      if (!response.ok) {
          if (response.status === 401) {
               throw new Error("Unauthorized");
          }
          throw new Error(`Upload failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Drive Upload Error", error);
      throw error;
    }
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem(LUNA_AUTH_TOKEN);
    return !!token;
  }

  async restoreSession(): Promise<string | null> {
    try {
      const storedTokenStr = localStorage.getItem(LUNA_AUTH_TOKEN);
      if (storedTokenStr) {
        const token: GoogleToken = JSON.parse(storedTokenStr);
        this.restoreGapiSession(token);
        
        // Return file ID if session restoration is successful
        const fileId = await this.ensureFileExists();
        return fileId;
      }
    } catch (error) {
      console.error('Google session restoration failed', error);
      localStorage.removeItem(LUNA_AUTH_TOKEN);
    }
    return null;
  }

  /**
   * Internal helper to manually set the token in GAPI client.
   */
  private restoreGapiSession(token: GoogleToken) {
    if (window.gapi && window.gapi.client) {
        window.gapi.client.setToken(token);
    }
  }

  /**
   * Internal helper to check if the current token is expired and automatically refreshes it via the backend.
   */
  private async ensureValidToken(): Promise<GoogleToken> {
    const storedStr = localStorage.getItem(LUNA_AUTH_TOKEN);
    if (!storedStr) throw new Error("No token found");

    const token: GoogleToken = JSON.parse(storedStr);
    const now = Date.now();

    // The buffer is already subtracted by the backend
    if (token.expires_at && token.expires_at > now) {
      // Make sure GAPI is in sync
      const currentGapiToken = window.gapi?.client?.getToken();
      if (!currentGapiToken || currentGapiToken.access_token !== token.access_token) {
          this.restoreGapiSession(token);
      }
      return token;
    }

    // Token is expired or about to expire, fetch a new one
    try {
      const response = await fetch('/api/auth/refresh');
      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const data = await response.json();
      const expiresAt = Date.now() + (data.expires_in * 1000);
      
      const newToken: GoogleToken = {
        ...token,
        access_token: data.access_token,
        expires_in: data.expires_in,
        expires_at: expiresAt
      };

      localStorage.setItem(LUNA_AUTH_TOKEN, JSON.stringify(newToken));
      this.restoreGapiSession(newToken);

      if (window.dataLayer) {
        window.dataLayer.push({ event: 'google_drive_token_refresh' });
      }

      return newToken;
    } catch (error) {
      console.error("Token refresh error", error);
      // Token is fully dead, wipe it
      if (window.gapi && window.gapi.client) window.gapi.client.setToken(null);
      localStorage.removeItem(LUNA_AUTH_TOKEN);
      throw new Error("Unauthorized");
    }
  }
}

// Export a singleton instance
export const googleDriveProvider = new GoogleDriveProvider();
