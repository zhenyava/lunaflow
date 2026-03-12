import type { DailyRecord } from '../types';
import { APP_DATA_FILENAME, FOLDER_NAME } from '../constants';
import { prepareDataForStorage } from './storageService';

let cachedGoogleToken: string | null = null;
let tokenExpiration: number = 0;

/**
 * Fetches a valid Google Access Token from our Vercel API using the Clerk token.
 */
export const getValidAccessToken = async (getClerkToken: () => Promise<string | null>): Promise<string> => {
  // Use cached token if valid (with 5-minute buffer)
  if (cachedGoogleToken && Date.now() < tokenExpiration - 300000) {
    return cachedGoogleToken;
  }

  const clerkToken = await getClerkToken();
  if (!clerkToken) {
    throw new Error("Not authenticated with Clerk");
  }

  const response = await fetch('/api/get-drive-token', {
    headers: {
      'Authorization': `Bearer ${clerkToken}`
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized");
    }
    throw new Error(`Failed to get Google token: ${response.statusText}`);
  }

  const data = await response.json();
  cachedGoogleToken = data.accessToken;
  // Tokens from Clerk/Google usually last 1 hour. 
  // We'll set a conservative expiration of 50 minutes.
  tokenExpiration = Date.now() + 50 * 60 * 1000;
  
  return cachedGoogleToken!;
};

/**
 * Checks if the data file exists in Drive.
 */
export const ensureDriveFileExists = async (googleToken: string): Promise<string> => {
  try {
    // 1. Find or create the LunaFlow folder
    let folderId = '';
    const folderListUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    )}&fields=files(id, name)&spaces=drive`;

    const folderListResponse = await fetch(folderListUrl, {
      headers: { 'Authorization': `Bearer ${googleToken}` }
    });
    
    if (!folderListResponse.ok) {
        if (folderListResponse.status === 401) throw new Error("Unauthorized");
        throw new Error(`Folder list failed: ${folderListResponse.statusText}`);
    }

    const folderListData = await folderListResponse.json();
    const folders = folderListData.files;

    if (folders && folders.length > 0) {
      folderId = folders[0].id;
      console.log('Found existing folder:', folderId);
    } else {
      console.log('Creating new folder...');
      const createFolderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      const newFolder = await createFolderResponse.json();
      folderId = newFolder.id;
      console.log('Created new folder:', folderId);
    }

    // 2. Check if file exists inside the folder
    const fileListUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name = '${APP_DATA_FILENAME}' and '${folderId}' in parents and trashed = false`
    )}&fields=files(id, name)&spaces=drive&pageSize=1`;

    const fileListResponse = await fetch(fileListUrl, {
      headers: { 'Authorization': `Bearer ${googleToken}` }
    });
    const fileListData = await fileListResponse.json();
    const files = fileListData.files;
    
    if (files && files.length > 0) {
      console.log('Found existing file:', files[0].id);
      return files[0].id;
    }

    // 3. Create file in visible folder
    console.log('Creating new file...');
    const metadata = {
      name: APP_DATA_FILENAME,
      parents: [folderId],
      mimeType: 'application/json'
    };

    const initialData = prepareDataForStorage([]);
    const initialContent = JSON.stringify(initialData);
    const fileBlob = new Blob([initialContent], { type: 'application/json' });

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    const createResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${googleToken}` },
      body: form
    });
    
    if (!createResponse.ok) {
        throw new Error(`Failed to create file: ${createResponse.statusText}`);
    }

    const result = await createResponse.json();
    console.log('File created:', result.id);
    return result.id;
  } catch (error) {
    console.error("Error ensuring drive file exists:", error);
    throw error;
  }
};

/**
 * Uploads data to a specific File ID using PATCH
 */
export const uploadDriveData = async (fileId: string, events: DailyRecord[], googleToken: string): Promise<void> => {
  const data = prepareDataForStorage(events);
  const fileContent = JSON.stringify(data);
  
  try {
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
        if (response.status === 401) throw new Error("Unauthorized");
        throw new Error(`Upload failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Drive Upload Error", error);
    throw error;
  }
};

/**
 * Fetches data content from a specific File ID
 */
export const fetchDriveDataContent = async (fileId: string, googleToken: string): Promise<unknown> => {
    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { 'Authorization': `Bearer ${googleToken}` }
        });
        
        if (!response.ok) {
          if (response.status === 401) throw new Error("Unauthorized");
          throw new Error(`Fetch failed: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("Fetch Content Error", error);
        throw error;
    }
};

// Compatibility exports for migration
export const initializeGoogleApi = (_clientId: string, onInit: (success: boolean) => void) => {
  onInit(true);
};
export const signInToGoogle = async () => ({ access_token: '' });
export const restoreGapiSession = () => {};
export const revokeToken = () => {
  cachedGoogleToken = null;
  tokenExpiration = 0;
};
