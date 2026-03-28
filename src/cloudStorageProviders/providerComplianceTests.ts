import { describe, it, expect } from 'vitest';
import type { CloudStorageProvider } from './CloudStorageProviderInterface';

/**
 * A shared test suite to verify that any given CloudStorageProvider
 * complies with the expected interface contract.
 *
 * @param provider The instantiated provider to test.
 */
export function runProviderComplianceTests(provider: CloudStorageProvider) {
  describe(`Compliance Tests: ${provider.name}`, () => {
    it('should have a valid id and name', () => {
      expect(typeof provider.id).toBe('string');
      expect(provider.id.length).toBeGreaterThan(0);
      expect(typeof provider.name).toBe('string');
      expect(provider.name.length).toBeGreaterThan(0);
    });

    it('should implement all required methods', () => {
      expect(typeof provider.ensureFileExists).toBe('function');
      expect(typeof provider.fetchData).toBe('function');
      expect(typeof provider.uploadData).toBe('function');
    });
  });
}
