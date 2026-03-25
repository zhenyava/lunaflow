import { describe, it, expect } from 'vitest';
import type { RemoteStorageProvider } from './RemoteStorageProviderInterface';

/**
 * A shared test suite to verify that any given RemoteStorageProvider
 * complies with the expected interface contract.
 * 
 * @param provider The instantiated provider to test.
 */
export function runProviderComplianceTests(provider: RemoteStorageProvider) {
  describe(`Compliance Tests: ${provider.name}`, () => {
    it('should have a valid id and name', () => {
      expect(typeof provider.id).toBe('string');
      expect(provider.id.length).toBeGreaterThan(0);
      expect(typeof provider.name).toBe('string');
      expect(provider.name.length).toBeGreaterThan(0);
    });

    it('should implement all required methods', () => {
      expect(typeof provider.initialize).toBe('function');
      expect(typeof provider.signIn).toBe('function');
      expect(typeof provider.signOut).toBe('function');
      expect(typeof provider.ensureFileExists).toBe('function');
      expect(typeof provider.fetchData).toBe('function');
      expect(typeof provider.uploadData).toBe('function');
      expect(typeof provider.isAuthenticated).toBe('function');
      expect(typeof provider.restoreSession).toBe('function');
      
      if (provider.handleCallback !== undefined) {
        expect(typeof provider.handleCallback).toBe('function');
      }
    });
  });
}
