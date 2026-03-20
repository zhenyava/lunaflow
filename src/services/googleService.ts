import type { DailyRecord, GoogleToken } from '../types';
import { APP_DATA_FILENAME, FOLDER_NAME } from '../constants';
import { prepareDataForStorage } from './storageService';

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
      permissions: {
        create: (params: Record<string, unknown>) => Promise<GapiFileResult<unknown>>;
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

let gapiInited = false;

// Initialize the Google API Client
export const initializeGoogleApi = (
  onInit: (success: boolean) => void
) => {
  const initGapi = async () => {
    try {
      await window.gapi.client.init({
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
      });
      gapiInited = true;
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
      if (!gapiInited) window.gapi.load('client', initGapi);
      else onInit(true);
  }
};

/**
 * Manually sets the token in GAPI client.
 */
export const restoreGapiSession = (token: GoogleToken) => {
    if (window.gapi && window.gapi.client) {
        window.gapi.client.setToken(token);
    }
};

/**
 * Initiates the backend-driven OAuth flow.
 * Note: This will cause a full page redirect.
 */
export const signInToGoogle = async (): Promise<void> => {
    window.location.href = '/api/auth/login';
    // Return a promise that never resolves so the caller waits for navigation
    return new Promise(() => {});
};

/**
 * Checks if the current token is expired and automatically refreshes it via the backend.
 * Called before any Drive API action.
 */
export const ensureValidToken = async (): Promise<GoogleToken> => {
  const storedStr = localStorage.getItem('LUNA_AUTH_TOKEN');
  if (!storedStr) throw new Error("No token found");

  const token: GoogleToken = JSON.parse(storedStr);
  const now = Date.now();

  // The buffer is already subtracted by the backend
  if (token.expires_at && token.expires_at > now) {
    // Make sure GAPI is in sync
    const currentGapiToken = window.gapi?.client?.getToken();
    if (!currentGapiToken || currentGapiToken.access_token !== token.access_token) {
        restoreGapiSession(token);
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

    localStorage.setItem('LUNA_AUTH_TOKEN', JSON.stringify(newToken));
    restoreGapiSession(newToken);

    if (window.dataLayer) {
      window.dataLayer.push({ event: 'google_drive_token_refresh' });
    }

    return newToken;
  } catch (error) {
    console.error("Token refresh error", error);
    // Token is fully dead, wipe it
    if (window.gapi && window.gapi.client) window.gapi.client.setToken(null);
    localStorage.removeItem('LUNA_AUTH_TOKEN');
    throw new Error("Unauthorized");
  }
};


/**
 * Checks if the data file exists in Drive.
 * If yes, returns the File ID.
 * If no, creates an empty file and returns the new File ID.
 */
export const ensureDriveFileExists = async (): Promise<string> => {
  try {
    const token = await ensureValidToken();

    // 1. Find or create the LunaFlow folder
    let folderId = '';
    const folderResponse = await window.gapi.client.drive.files.list({
      q: `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    const folders = folderResponse.result.files;
    if (folders && folders.length > 0) {
      folderId = folders[0].id;
    } else {
      const folderMetadata = {
        name: FOLDER_NAME,
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
};

/**
 * Uploads data to a specific File ID using PATCH
 */
export const uploadDriveData = async (fileId: string, events: DailyRecord[]): Promise<void> => {
  const token = await ensureValidToken();

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
};

export const fetchDriveDataContent = async (fileId: string): Promise<unknown> => {
    try {
        await ensureValidToken();
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

export const shareDriveFile = async (fileId: string, email: string, role: 'reader' | 'writer'): Promise<void> => {
    await ensureValidToken();
    try {
        await window.gapi.client.drive.permissions.create({
            fileId: fileId,
            sendNotificationEmail: true,
            resource: {
                type: 'user',
                role: role,
                emailAddress: email
            }
        });
    } catch (error) {
        console.error("Share Drive File Error", error);
        throw error;
    }
};

export const getSharedDriveFile = async (fileId: string): Promise<{ id: string; canEdit: boolean }> => {
    await ensureValidToken();
    try {
        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'id, capabilities'
        });
        
        const file = response.result as { id: string; capabilities?: { canEdit?: boolean } };
        return {
            id: file.id,
            canEdit: !!file.capabilities?.canEdit
        };
    } catch (error) {
        console.error("Get Shared Drive File Error", error);
        throw error;
    }
};

export const revokeToken = async () => {
    try {
        // Clear HttpOnly cookie on backend
        await fetch('/api/auth/logout');
        
        // Clear local state
        localStorage.removeItem('LUNA_AUTH_TOKEN');
        if (window.gapi && window.gapi.client) {
            window.gapi.client.setToken(null);
        }
    } catch(e) {
        console.warn("Error revoking token", e);
    }
}
