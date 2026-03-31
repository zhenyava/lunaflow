import { describe, it, expect, vi } from 'vitest';
import { type StorageEnvelope, parseStorageEnvelope, EnvelopeMigrationService, isEnvelopesEqual } from './StorageEnvelope';
import { makePeriodRecord } from './DailyRecord';

describe('StorageEnvelope', () => {
  describe('isEnvelopesEqual', () => {
    it('returns true for identical envelopes', () => {
      const a: StorageEnvelope = {
        ver: 1,
        records: [makePeriodRecord('2024-01-01', 1000)]
      };
      const b: StorageEnvelope = {
        ver: 1,
        records: [makePeriodRecord('2024-01-01', 1000)]
      };
      expect(isEnvelopesEqual(a, b)).toBe(true);
    });

    it('returns false for different versions', () => {
      const a: StorageEnvelope = { ver: 1, records: [] };
      const b: StorageEnvelope = { ver: 2, records: [] };
      expect(isEnvelopesEqual(a, b)).toBe(false);
    });

    it('returns false for different number of records', () => {
      const a: StorageEnvelope = { ver: 1, records: [makePeriodRecord('2024-01-01')] };
      const b: StorageEnvelope = { ver: 1, records: [] };
      expect(isEnvelopesEqual(a, b)).toBe(false);
    });

    it('returns false for different record dates', () => {
      const a: StorageEnvelope = { ver: 1, records: [makePeriodRecord('2024-01-01', 1000)] };
      const b: StorageEnvelope = { ver: 1, records: [makePeriodRecord('2024-01-02', 1000)] };
      expect(isEnvelopesEqual(a, b)).toBe(false);
    });

    it('returns false for different record updatedAt', () => {
      const a: StorageEnvelope = { ver: 1, records: [makePeriodRecord('2024-01-01', 1000)] };
      const b: StorageEnvelope = { ver: 1, records: [makePeriodRecord('2024-01-01', 1001)] };
      expect(isEnvelopesEqual(a, b)).toBe(false);
    });

    it('returns false if records are in different order', () => {
      const r1 = makePeriodRecord('2024-01-01', 1000);
      const r2 = makePeriodRecord('2024-01-02', 1000);
      const a: StorageEnvelope = { ver: 1, records: [r1, r2] };
      const b: StorageEnvelope = { ver: 1, records: [r2, r1] };
      expect(isEnvelopesEqual(a, b)).toBe(false);
    });
  });

  describe('parseStorageEnvelope', () => {
    it('validates a correct envelope', () => {
      const record = makePeriodRecord('2024-01-01');
      const raw = { ver: 1, records: [record] };
      const result = parseStorageEnvelope(raw);
      expect(result).toEqual(raw);
    });

    it('returns null for malformed envelope', () => {
      expect(parseStorageEnvelope({ foo: 'bar' })).toBeNull();
      expect(parseStorageEnvelope({ ver: '1', records: [] })).toBeNull();
    });

    it('drops invalid records but keeps the envelope', () => {
      const valid = makePeriodRecord('2024-01-01');
      const invalid = { date: 'invalid-date' };
      const raw = { ver: 1, records: [valid, invalid] };
      const result = parseStorageEnvelope(raw);
      expect(result!.records).toHaveLength(1);
      expect(result!.records[0]).toEqual(valid);
    });
  });

  describe('EnvelopeMigrationService', () => {
    it('migrates records correctly', () => {
      const initial: StorageEnvelope = { ver: 1, records: [makePeriodRecord('2024-01-01')] };
      const migrationFn = vi.fn((env: StorageEnvelope) => ({
        ...env,
        records: [...env.records, makePeriodRecord('2024-01-02')]
      }));
      const service = new EnvelopeMigrationService(2, [() => ({ ver: 0, records: [] }), migrationFn]);
      
      const result = service.migrate(initial);
      
      expect(result.ver).toBe(2);
      expect(result.records).toHaveLength(2);
      expect(migrationFn).toHaveBeenCalled();
    });
  });
});
