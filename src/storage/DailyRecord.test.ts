import { describe, it, expect } from 'vitest';
import { computeIsDeleted } from './DailyRecord';

describe('computeIsDeleted', () => {
  it('returns true for empty record', () => {
    expect(computeIsDeleted({})).toBe(true);
  });

  it('returns true when all fields are undefined', () => {
    expect(computeIsDeleted({ period: undefined, ovulation: undefined, symptoms: undefined })).toBe(true);
  });

  it('returns true when symptoms is empty object', () => {
    expect(computeIsDeleted({ symptoms: {} })).toBe(true);
  });

  it('returns false when period exists', () => {
    expect(computeIsDeleted({ period: {} })).toBe(false);
  });

  it('returns false when ovulation exists', () => {
    expect(computeIsDeleted({ ovulation: {} })).toBe(false);
  });

  it('returns false when symptoms has entries', () => {
    expect(computeIsDeleted({ symptoms: { mood: ['happy'] } })).toBe(false);
  });

  it('returns false when symptoms has key with empty array', () => {
    // Object.keys().length > 0 is true, so this counts as having symptoms
    expect(computeIsDeleted({ symptoms: { mood: [] } })).toBe(false);
  });
});
