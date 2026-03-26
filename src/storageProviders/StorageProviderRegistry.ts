import type { RemoteStorageProvider } from './RemoteStorageProviderInterface';
import { googleDriveProvider } from './GoogleDriveProvider';

class StorageProviderRegistry {
  private providers: Map<string, RemoteStorageProvider> = new Map();

  constructor() {
    // Pre-register default providers
    this.registerProvider(googleDriveProvider);
  }

  registerProvider(provider: RemoteStorageProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): RemoteStorageProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      console.warn(`Storage provider with id '${id}' not found. Falling back to google-drive.`);
      return this.providers.get('google-drive')!;
    }
    return provider;
  }

  getAllProviders(): RemoteStorageProvider[] {
    return Array.from(this.providers.values());
  }
}

export const storageProviderRegistry = new StorageProviderRegistry();
