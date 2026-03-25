import type { ICloudStorageProvider } from './ICloudStorageProvider';
import { GoogleDriveProvider } from './googleDriveProvider';

const providers = new Map<string, ICloudStorageProvider>();
const PROVIDER_STORAGE_KEY = 'lunaflow_cloud_provider';

export function registerProvider(provider: ICloudStorageProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): ICloudStorageProvider | undefined {
  return providers.get(id);
}

export function getAllProviders(): ICloudStorageProvider[] {
  return Array.from(providers.values());
}

export function getActiveProviderId(): string | null {
  return localStorage.getItem(PROVIDER_STORAGE_KEY);
}

export function setActiveProviderId(id: string): void {
  localStorage.setItem(PROVIDER_STORAGE_KEY, id);
}

export function initializeRegistry(): void {
  registerProvider(new GoogleDriveProvider());
}
