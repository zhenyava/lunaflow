export interface LocalStorageProvider {
  read(): Promise<unknown>;
  write(data: unknown): Promise<void>;
}
