import type { CloudStorageProvider } from './CloudStorageProviderInterface';
import { parseCloudPath } from './CloudStorageProviderInterface';

interface GapiFileResult<T = unknown> {
  result: T;
}

/**
 * Google Drive implementation of CloudStorageProvider.
 * Pure storage — no auth logic. Receives a token getter via constructor injection.
 * Maps cloud paths to Google Drive internal file IDs.
 */
export class GoogleDriveProvider implements CloudStorageProvider {
  readonly id = 'google-drive';
  readonly name = 'Google Drive';
  private _idCache = new Map<string, string>();
  private _getToken: () => Promise<{ access_token: string }>;

  constructor(getToken: () => Promise<{ access_token: string }>) {
    this._getToken = getToken;
  }

  private async _ensureFolder(folderName: string, createIfMissing: boolean): Promise<string | null> {
    if (this._idCache.has(folderName)) {
      return this._idCache.get(folderName)!;
    }

    const folderResponse: GapiFileResult<{ files: Array<{ id: string; name: string }> }> =
      await window.gapi.client.drive.files.list({
        q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

    const folders = folderResponse.result.files;
    if (folders && folders.length > 0) {
      const folderId = folders[0].id;
      this._idCache.set(folderName, folderId);
      return folderId;
    }

    if (!createIfMissing) {
      return null;
    }

    const createFolderResponse: GapiFileResult<{ id: string }> =
      await window.gapi.client.drive.files.create({
        resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id',
      });
      
    const newFolderId = createFolderResponse.result.id;
    this._idCache.set(folderName, newFolderId);
    return newFolderId;
  }

  private async _resolveFileId(path: string): Promise<string | null> {
    if (this._idCache.has(path)) {
      return this._idCache.get(path)!;
    }

    await this._getToken();
    const [folderName, fileName] = parseCloudPath(path);

    const folderId = await this._ensureFolder(folderName, false);
    if (!folderId) {
      return null; // Folder doesn't exist, so file doesn't exist
    }

    const response: GapiFileResult<{ files: Array<{ id: string; name: string }> }> =
      await window.gapi.client.drive.files.list({
        spaces: 'drive',
        fields: 'files(id, name)',
        q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
        pageSize: 1,
      });

    const files = response.result.files;
    if (files && files.length > 0) {
      const fileId = files[0].id;
      this._idCache.set(path, fileId);
      return fileId;
    }

    return null;
  }

  async checkFileExists(path: string): Promise<boolean> {
    try {
      const id = await this._resolveFileId(path);
      return id !== null;
    } catch (error) {
      console.error('Error checking drive file exists:', error);
      return false;
    }
  }

  async downloadFile(path: string): Promise<unknown> {
    try {
      await this._getToken();
      const driveId = await this._resolveFileId(path);
      if (!driveId) {
        throw new Error(`File not found: ${path}`);
      }
      const fileResponse: GapiFileResult<unknown> = await window.gapi.client.drive.files.get({
        fileId: driveId,
        alt: 'media',
      });
      return fileResponse.result;
    } catch (error) {
      console.error('Download Content Error', error);
      throw error;
    }
  }

  async uploadFile(path: string, data: unknown): Promise<void> {
    try {
      const token = await this._getToken();
      const driveId = await this._resolveFileId(path);

      if (!driveId) {
        // File doesn't exist, we need to create it (and potentially the folder)
        const [folderName, fileName] = parseCloudPath(path);
        
        const folderId = await this._ensureFolder(folderName, true);

        const metadata = {
          name: fileName,
          parents: [folderId],
          mimeType: 'application/json',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));

        const createResponse = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token.access_token}` },
            body: form,
          }
        );

        if (!createResponse.ok) {
          if (createResponse.status === 401) throw new Error('Unauthorized');
          throw new Error(`Failed to create file: ${createResponse.statusText}`);
        }

        const result = await createResponse.json();
        this._idCache.set(path, result.id);
      } else {
        // Update existing file
        const response = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${driveId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          }
        );

        if (!response.ok) {
          if (response.status === 401) throw new Error('Unauthorized');
          throw new Error(`Upload failed: ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Drive Upload Error', error);
      throw error;
    }
  }
}
