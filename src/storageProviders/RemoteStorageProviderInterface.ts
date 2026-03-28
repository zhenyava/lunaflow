/**
 * Interface representing a remote storage provider (e.g., Google Drive, Dropbox).
 * Owns only storage operations — auth is handled by a separate AuthProvider.
 */
export interface RemoteStorageProvider {
  /**
   * The unique identifier for the storage provider (e.g., 'google-drive').
   */
  readonly id: string;

  /**
   * The name of the storage provider (e.g., 'Google Drive').
   */
  readonly name: string;

  /**
   * Ensures the remote file exists, creating it if necessary.
   * The fileId is a logical key defined by DataStore; the provider maps it internally.
   * @param fileId Logical file identifier defined by DataStore.
   * @returns true on success, false on failure.
   */
  ensureFileExists(fileId: string): Promise<boolean>;

  /**
   * Fetches the data content from the remote storage.
   * @param fileId Logical file identifier defined by DataStore.
   * @returns The raw parsed data (usually a JSON object).
   */
  fetchData(fileId: string): Promise<unknown>;

  /**
   * Uploads data to the remote storage.
   * @param fileId Logical file identifier defined by DataStore.
   * @param data Serializable data to upload.
   */
  uploadData(fileId: string, data: unknown): Promise<void>;
}
