/**
 * Parses a cloud path like "FolderName/file.json" into [folderName, fileName].
 * Shared utility for all CloudStorageProvider implementations.
 */
export function parseCloudPath(path: string): [folderName: string, fileName: string] {
  const sep = path.lastIndexOf('/');
  if (sep === -1) throw new Error(`Invalid cloud path (expected "folder/file"): ${path}`);
  return [path.slice(0, sep), path.slice(sep + 1)];
}

/**
 * Interface representing a cloud storage provider (e.g., Google Drive, Dropbox).
 * Owns only storage operations — auth is handled by a separate AuthProvider.
 */
export interface CloudStorageProvider {
  /**
   * The unique identifier for the storage provider (e.g., 'google-drive').
   */
  readonly id: string;

  /**
   * The name of the storage provider (e.g., 'Google Drive').
   */
  readonly name: string;

  /**
   * Checks if the cloud file exists.
   * @param path Slash-separated cloud path (e.g. "FolderName/file.json").
   * @returns true if it exists, false otherwise.
   */
  checkFileExists(path: string): Promise<boolean>;

  /**
   * Downloads the file content from the cloud storage.
   * @param path Slash-separated cloud path (e.g. "FolderName/file.json").
   * @returns The raw parsed data (usually a JSON object).
   */
  downloadFile(path: string): Promise<unknown>;

  /**
   * Uploads data to the cloud storage.
   * @param path Slash-separated cloud path (e.g. "FolderName/file.json").
   * @param data Serializable data to upload.
   */
  uploadFile(path: string, data: unknown): Promise<void>;
}
