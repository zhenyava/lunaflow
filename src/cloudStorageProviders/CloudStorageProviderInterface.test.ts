import { describe, it, expect } from 'vitest';
import { parseCloudPath } from './CloudStorageProviderInterface';

describe('parseCloudPath', () => {
  it('parses a simple folder/file path', () => {
    expect(parseCloudPath('LunaFlow/data.json')).toEqual(['LunaFlow', 'data.json']);
  });

  it('uses last slash when path has multiple segments', () => {
    expect(parseCloudPath('a/b/c.json')).toEqual(['a/b', 'c.json']);
  });

  it('throws on path without a slash', () => {
    expect(() => parseCloudPath('noSlash')).toThrow('Invalid cloud path');
  });
});
