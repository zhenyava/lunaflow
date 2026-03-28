import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageProviderRegistry, ProviderDescriptor } from './StorageProviderRegistry';
import { STORAGE_PROVIDER_KEY } from '../constants';

describe('StorageProviderRegistry', () => {
  let registry: StorageProviderRegistry;
  const providerA: ProviderDescriptor = { id: 'provider-a', name: 'Provider A' };
  const providerB: ProviderDescriptor = { id: 'provider-b', name: 'Provider B' };

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    registry = new StorageProviderRegistry();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('defaults active provider to "google-drive"', () => {
    expect(registry.activeProviderId).toBe('google-drive');
  });

  it('reads active provider id from localStorage on construction', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('provider-b');
    const reg2 = new StorageProviderRegistry();
    expect(reg2.activeProviderId).toBe('provider-b');
  });

  describe('registering / getting providers', () => {
    it('registers and retrieves a provider', () => {
      registry.registerProvider(providerA);
      expect(registry.getProvider('provider-a')).toBe(providerA);
    });

    it('returns all registered providers', () => {
      registry.registerProvider(providerA);
      registry.registerProvider(providerB);
      const all = registry.getAllProviders();
      expect(all).toContain(providerA);
      expect(all).toContain(providerB);
      expect(all).toHaveLength(2);
    });
  });

  describe('setActiveProvider', () => {
    it('switches to the new provider and persists to localStorage', () => {
      registry.setActiveProvider('provider-b');
      expect(registry.activeProviderId).toBe('provider-b');
      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_PROVIDER_KEY, 'provider-b');
    });

    it('does nothing if switching to the same provider', () => {
      const listener = vi.fn();
      registry.subscribe(listener);
      registry.setActiveProvider('google-drive'); // already google-drive by default
      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies subscribers after switching', () => {
      const listener = vi.fn();
      registry.subscribe(listener);
      registry.setActiveProvider('provider-b');
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('subscribe / notify', () => {
    it('calls subscriber when notify is called', () => {
      const fn = vi.fn();
      registry.subscribe(fn);
      registry.notify();
      expect(fn).toHaveBeenCalledOnce();
    });

    it('returns an unsubscribe function', () => {
      const fn = vi.fn();
      const unsub = registry.subscribe(fn);
      unsub();
      registry.notify();
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
