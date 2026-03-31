import { describe, it, expect } from 'vitest';
import { EnvelopeMigrationService } from './StorageEnvelope';
import type { StorageEnvelope } from './StorageEnvelope';
import type { MigrationFunction } from './envelopeMigrations';

describe('EnvelopeMigrationService', () => {
  const migrations: MigrationFunction[] = [
    // v0 to v1 (unused)
    (env) => env,
    // v1 to v2
    (env) => ({
      ...env,
      records: env.records.map(r => ({ ...r, note: 'migrated' }))
    }),
    // v2 to v3
    (env) => ({
      ...env,
      records: env.records.map(r => ({ ...r, v3: true } as unknown as DailyRecord))
    })
  ];

  it('migrates through multiple versions', () => {
    const service = new EnvelopeMigrationService(3, migrations);
    const initial: StorageEnvelope = {
      ver: 1,
      records: [{ date: '2024-01-01', updatedAt: 123 }]
    };

    const result = service.migrate(initial);
    expect(result.ver).toBe(3);
    expect(result.records[0]).toMatchObject({
      date: '2024-01-01',
      note: 'migrated',
      v3: true
    });
  });

  it('stops early if target version reached', () => {
    const service = new EnvelopeMigrationService(2, migrations);
    const initial: StorageEnvelope = {
      ver: 1,
      records: [{ date: '2024-01-01', updatedAt: 123 }]
    };

    const result = service.migrate(initial);
    expect(result.ver).toBe(2);
    expect(result.records[0]).not.toHaveProperty('v3');
  });

  it('returns data as-is if version already current', () => {
    const service = new EnvelopeMigrationService(1, migrations);
    const initial: StorageEnvelope = {
      ver: 1,
      records: [{ date: '2024-01-01', updatedAt: 123 }]
    };

    const result = service.migrate(initial);
    expect(result).toBe(initial);
  });
});
