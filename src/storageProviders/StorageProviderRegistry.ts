import { STORAGE_PROVIDER_KEY } from '../constants';

export interface ProviderDescriptor {
  readonly id: string;
  readonly name: string;
}

/**
 * Pure catalog of available storage providers and which one is currently selected.
 * Does not hold provider instances or manage auth — that is CalendarApp's responsibility.
 */
export class StorageProviderRegistry {
  private _providers: Map<string, ProviderDescriptor> = new Map();
  private _activeProviderId: string;
  private _listeners = new Set<() => void>();

  constructor() {
    this._activeProviderId = localStorage.getItem(STORAGE_PROVIDER_KEY) ?? 'google-drive';
  }

  registerProvider(provider: ProviderDescriptor): void {
    this._providers.set(provider.id, provider);
  }

  getProvider(id: string): ProviderDescriptor | undefined {
    return this._providers.get(id);
  }

  getAllProviders(): ProviderDescriptor[] {
    return Array.from(this._providers.values());
  }

  get activeProviderId(): string {
    return this._activeProviderId;
  }

  setActiveProvider(id: string): void {
    if (id === this._activeProviderId) return;
    this._activeProviderId = id;
    localStorage.setItem(STORAGE_PROVIDER_KEY, id);
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  notify(): void {
    this._listeners.forEach(fn => fn());
  }
}
