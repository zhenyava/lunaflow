import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleDriveProvider } from './GoogleDriveProvider';
import { runProviderComplianceTests } from './providerComplianceTests';
import { CLOUD_STORAGE_FILENAME, CLOUD_STORAGE_FOLDER_NAME } from '../constants';

interface MockGapiResult<T = unknown> {
  result: T;
}

describe('GoogleDriveProvider', () => {
  let provider: GoogleDriveProvider;
  let mockGetToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetToken = vi.fn(async () => ({ access_token: 'test_token' }));
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('window', {
      ...window,
      gapi: {
        client: {
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
    provider = new GoogleDriveProvider(mockGetToken);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  // Run the shared compliance test suite
  runProviderComplianceTests(new GoogleDriveProvider(async () => ({ access_token: 't' })));

  it('should have the correct name and id', () => {
    expect(provider.name).toBe('Google Drive');
    expect(provider.id).toBe('google-drive');
  });

  describe('Drive API Operations', () => {
    const FILE_ID = 'test-file-id';

    it('should ensure drive file exists (found existing)', async () => {
      // 1. Mock finding the folder
      vi.mocked(window.gapi.client.drive.files.list).mockResolvedValueOnce({
        result: { files: [{ id: 'folder-id', name: CLOUD_STORAGE_FOLDER_NAME }] }
      } as MockGapiResult<{ files: { id: string; name: string; }[] }>);

      // 2. Mock finding the file
      vi.mocked(window.gapi.client.drive.files.list).mockResolvedValueOnce({
        result: { files: [{ id: 'drive-file-id', name: CLOUD_STORAGE_FILENAME }] }
      } as MockGapiResult<{ files: { id: string; name: string; }[] }>);

      const ok = await provider.ensureFileExists(FILE_ID);
      expect(ok).toBe(true);
      expect(mockGetToken).toHaveBeenCalled();
    });

    it('should create folder and file if missing', async () => {
      // 1. No folder found
      vi.mocked(window.gapi.client.drive.files.list).mockResolvedValueOnce({
        result: { files: [] }
      } as MockGapiResult<{ files: any[] }>);

      // 2. Mock folder creation
      vi.mocked(window.gapi.client.drive.files.create).mockResolvedValueOnce({
        result: { id: 'new-folder-id' }
      } as MockGapiResult<{ id: string }>);

      // 3. No file found in folder
      vi.mocked(window.gapi.client.drive.files.list).mockResolvedValueOnce({
        result: { files: [] }
      } as MockGapiResult<{ files: any[] }>);

      // 4. Mock file creation via fetch upload
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'new-file-id' })
      } as Response);

      const ok = await provider.ensureFileExists(FILE_ID);
      expect(ok).toBe(true);
      expect(window.gapi.client.drive.files.create).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('upload/drive/v3/files?uploadType=multipart'),
        expect.any(Object)
      );
    });

    it('should fetch data from drive', async () => {
      // We must call ensureFileExists first to populate _driveFileIds
      vi.mocked(window.gapi.client.drive.files.list).mockResolvedValue({
        result: { files: [{ id: 'drive-file-id', name: CLOUD_STORAGE_FILENAME }] }
      } as MockGapiResult<{ files: any[] }>);
      await provider.ensureFileExists(FILE_ID);

      const mockData = { records: [] };
      vi.mocked(window.gapi.client.drive.files.get).mockResolvedValue({
        result: mockData
      } as MockGapiResult);

      const data = await provider.fetchData(FILE_ID);
      expect(data).toBe(mockData);
      expect(window.gapi.client.drive.files.get).toHaveBeenCalledWith({
        fileId: 'drive-file-id',
        alt: 'media'
      });
    });

    it('should upload data to drive', async () => {
      // Populate _driveFileIds
      vi.mocked(window.gapi.client.drive.files.list).mockResolvedValue({
        result: { files: [{ id: 'drive-file-id', name: CLOUD_STORAGE_FILENAME }] }
      } as MockGapiResult<{ files: any[] }>);
      await provider.ensureFileExists(FILE_ID);

      vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

      const data = { foo: 'bar' };
      await provider.uploadData(FILE_ID, data);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://www.googleapis.com/upload/drive/v3/files/drive-file-id'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(data)
        })
      );
    });

    it('should return false if ensureFileExists fails', async () => {
      vi.mocked(window.gapi.client.drive.files.list).mockRejectedValue(new Error('Network error'));
      const ok = await provider.ensureFileExists(FILE_ID);
      expect(ok).toBe(false);
    });
  });
});
