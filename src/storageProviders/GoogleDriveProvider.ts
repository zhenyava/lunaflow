import { CLOUD_STORAGE_FILENAME, CLOUD_STORAGE_FOLDER_NAME } from '../constants';
import type { RemoteStorageProvider } from './RemoteStorageProviderInterface';

interface GapiFileResult<T = unknown> {
  result: T;
}

/**
 * Google Drive implementation of RemoteStorageProvider.
 * Pure storage — no auth logic. Receives a token getter via constructor injection.
 * Maps logical fileIds (defined by DataStore) to Google Drive internal file IDs.
 */
export class GoogleDriveProvider implements RemoteStorageProvider {
  readonly id = 'google-drive';
  readonly name = 'Google Drive';
  private _driveFileIds = new Map<string, string>();
  private _getToken: () => Promise<{ access_token: string }>;

  constructor(getToken: () => Promise<{ access_token: string }>) {
    this._getToken = getToken;
  }

  async ensureFileExists(fileId: string): Promise<boolean> {
    try {
      const token = await this._getToken();

      // 1. Find or create the LunaFlow folder
      let folderId = '';
      const folderResponse: GapiFileResult<{ files: Array<{ id: string; name: string }> }> =
        await window.gapi.client.drive.files.list({
          q: `name = '${CLOUD_STORAGE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          spaces: 'drive',
        });

      const folders = folderResponse.result.files;
      if (folders && folders.length > 0) {
        folderId = folders[0].id;
      } else {
        const createFolderResponse: GapiFileResult<{ id: string }> =
          await window.gapi.client.drive.files.create({
            resource: { name: CLOUD_STORAGE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
            fields: 'id',
          });
        folderId = createFolderResponse.result.id;
      }

      // 2. Check if file exists inside the folder
      const response: GapiFileResult<{ files: Array<{ id: string; name: string }> }> =
        await window.gapi.client.drive.files.list({
          spaces: 'drive',
          fields: 'files(id, name)',
          q: `name = '${CLOUD_STORAGE_FILENAME}' and '${folderId}' in parents and trashed = false`,
          pageSize: 1,
        });

      const files = response.result.files;
      if (files && files.length > 0) {
        this._driveFileIds.set(fileId, files[0].id);
        return true;
      }

      // 3. Create file in the folder
      const metadata = {
        name: CLOUD_STORAGE_FILENAME,
        parents: [folderId],
        mimeType: 'application/json',
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(null)], { type: 'application/json' }));

      const createResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token.access_token}` },
          body: form,
        }
      );

      if (!createResponse.ok) {
        throw new Error(`Failed to create file: ${createResponse.statusText}`);
      }

      const result = await createResponse.json();
      this._driveFileIds.set(fileId, result.id);
      return true;
    } catch (error) {
      console.error('Error ensuring drive file exists:', error);
      return false;
    }
  }

  async fetchData(fileId: string): Promise<unknown> {
    try {
      await this._getToken();
      const driveId = this._driveFileIds.get(fileId)!;
      const fileResponse: GapiFileResult<unknown> = await window.gapi.client.drive.files.get({
        fileId: driveId,
        alt: 'media',
      });
      return fileResponse.result;
    } catch (error) {
      console.error('Fetch Content Error', error);
      throw error;
    }
  }

  async uploadData(fileId: string, data: unknown): Promise<void> {
    const token = await this._getToken();
    const driveId = this._driveFileIds.get(fileId)!;

    try {
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
    } catch (error) {
      console.error('Drive Upload Error', error);
      throw error;
    }
  }
}
