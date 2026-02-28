import { describe, it, expect } from 'vitest';
import { normalizePath, getPathPrefixes, toFileUrl, fuzzyMatch, isDirectChild, getLastSegment } from './utils';

describe('normalizePath', () => {
  it('returns empty path for empty string', () => {
    expect(normalizePath('')).toEqual({ path: '', absolute: false });
  });

  it('returns empty path for whitespace-only input', () => {
    expect(normalizePath('   ')).toEqual({ path: '', absolute: false });
  });

  it('handles Unix absolute paths', () => {
    expect(normalizePath('/Users/john')).toEqual({ path: '/Users/john', absolute: true });
  });

  it('handles bare root /', () => {
    expect(normalizePath('/')).toEqual({ path: '/', absolute: true });
  });

  it('strips trailing slashes', () => {
    expect(normalizePath('/Users/john/')).toEqual({ path: '/Users/john', absolute: true });
    expect(normalizePath('/Users/john///')).toEqual({ path: '/Users/john', absolute: true });
  });

  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('C:\\Users\\john')).toEqual({ path: 'C:/Users/john', absolute: true });
  });

  it('handles Windows drive letters', () => {
    expect(normalizePath('C:/Users')).toEqual({ path: 'C:/Users', absolute: true });
    expect(normalizePath('D:')).toEqual({ path: 'D:', absolute: true });
  });

  it('strips file:// prefix for Unix paths', () => {
    expect(normalizePath('file:///Users/john')).toEqual({ path: '/Users/john', absolute: true });
  });

  it('strips file:// prefix for Windows paths', () => {
    expect(normalizePath('file:///C:/Users')).toEqual({ path: 'C:/Users', absolute: true });
  });

  it('strips file:// prefix case-insensitively', () => {
    expect(normalizePath('FILE:///Users/john')).toEqual({ path: '/Users/john', absolute: true });
  });

  it('handles UNC paths', () => {
    expect(normalizePath('//server/share')).toEqual({ path: '//server/share', absolute: true });
    expect(normalizePath('\\\\server\\share')).toEqual({ path: '//server/share', absolute: true });
  });

  it('identifies relative paths', () => {
    expect(normalizePath('Documents/file.txt')).toEqual({ path: 'Documents/file.txt', absolute: false });
    expect(normalizePath('./file.txt')).toEqual({ path: './file.txt', absolute: false });
  });

  it('trims whitespace from input', () => {
    expect(normalizePath('  /Users/john  ')).toEqual({ path: '/Users/john', absolute: true });
  });
});

describe('getPathPrefixes', () => {
  it('returns empty array for empty string', () => {
    expect(getPathPrefixes('')).toEqual([]);
  });

  it('returns single-element array for single-segment path', () => {
    expect(getPathPrefixes('/Users')).toEqual(['/Users']);
  });

  it('returns all prefixes for deep path', () => {
    expect(getPathPrefixes('/Users/john/Documents')).toEqual([
      '/Users',
      '/Users/john',
      '/Users/john/Documents',
    ]);
  });

  it('returns just root for bare /', () => {
    expect(getPathPrefixes('/')).toEqual(['/']);
  });

  it('handles Windows drive paths', () => {
    expect(getPathPrefixes('C:/Users/john')).toEqual([
      'C:',
      'C:/Users',
      'C:/Users/john',
    ]);
  });

  it('handles UNC paths (first prefix is //server/share)', () => {
    expect(getPathPrefixes('//server/share/folder')).toEqual([
      '//server/share',
      '//server/share/folder',
    ]);
  });

  it('handles UNC path with no subfolder', () => {
    expect(getPathPrefixes('//server/share')).toEqual(['//server/share']);
  });
});

describe('toFileUrl', () => {
  it('converts Unix absolute path', () => {
    expect(toFileUrl('/Users/john')).toBe('file:///Users/john');
  });

  it('converts Windows drive path', () => {
    expect(toFileUrl('C:/Users')).toBe('file:///C:/Users');
  });

  it('converts bare Windows drive with trailing slash', () => {
    expect(toFileUrl('C:')).toBe('file:///C:/');
  });

  it('converts UNC path', () => {
    expect(toFileUrl('//server/share')).toBe('file://server/share');
  });

  it('converts root path', () => {
    expect(toFileUrl('/')).toBe('file:///');
  });
});

describe('fuzzyMatch', () => {
  it('matches exact string', () => {
    const result = fuzzyMatch('abc', 'abc');
    expect(result.match).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('matches subsequence characters', () => {
    const result = fuzzyMatch('ac', 'abc');
    expect(result.match).toBe(true);
  });

  it('returns no match when characters are missing', () => {
    const result = fuzzyMatch('xyz', 'abc');
    expect(result.match).toBe(false);
  });

  it('returns no match when query is longer than target', () => {
    const result = fuzzyMatch('abcd', 'abc');
    expect(result.match).toBe(false);
  });

  it('is case insensitive', () => {
    const result = fuzzyMatch('ABC', 'abc');
    expect(result.match).toBe(true);
  });

  it('gives consecutive bonus for adjacent matches', () => {
    const consecutive = fuzzyMatch('ab', 'ab');
    const nonConsecutive = fuzzyMatch('ab', 'a_b');
    expect(consecutive.score).toBeGreaterThan(nonConsecutive.score);
  });

  it('gives path separator bonus for matches after /', () => {
    const afterSlash = fuzzyMatch('d', '/d');
    const midWord = fuzzyMatch('d', 'ad');
    expect(afterSlash.score).toBeGreaterThan(midWord.score);
  });

  it('gives start-of-string bonus', () => {
    const atStart = fuzzyMatch('a', 'abc');
    const midString = fuzzyMatch('b', 'abc');
    expect(atStart.score).toBeGreaterThan(midString.score);
  });

  it('handles empty query', () => {
    const result = fuzzyMatch('', 'abc');
    expect(result.match).toBe(true);
    expect(result.score).toBe(0);
  });
});

describe('isDirectChild', () => {
  it('returns true for direct child', () => {
    expect(isDirectChild('/Users', '/Users/john')).toBe(true);
  });

  it('returns false for grandchild', () => {
    expect(isDirectChild('/Users', '/Users/john/Documents')).toBe(false);
  });

  it('returns false for unrelated paths', () => {
    expect(isDirectChild('/Users', '/var/log')).toBe(false);
  });

  it('returns false for same path', () => {
    expect(isDirectChild('/Users', '/Users')).toBe(false);
  });

  it('returns false for prefix-only match (not a child)', () => {
    expect(isDirectChild('/Users/john', '/Users/johnny')).toBe(false);
  });

  it('returns false for root as parent (implementation uses parent + "/" prefix check)', () => {
    expect(isDirectChild('/', '/Users')).toBe(false);
  });

  it('handles Windows drive paths', () => {
    expect(isDirectChild('C:', 'C:/Users')).toBe(true);
    expect(isDirectChild('C:/Users', 'C:/Users/john')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(isDirectChild('  /Users  ', '  /Users/john  ')).toBe(true);
  });
});

describe('getLastSegment', () => {
  it('returns last segment of a path', () => {
    expect(getLastSegment('/Users/john/Documents')).toBe('Documents');
  });

  it('returns single segment', () => {
    expect(getLastSegment('/Users')).toBe('Users');
  });

  it('returns empty string for root', () => {
    expect(getLastSegment('/')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(getLastSegment('')).toBe('');
  });

  it('handles Windows drive paths', () => {
    expect(getLastSegment('C:/Users/john')).toBe('john');
  });

  it('handles bare drive letter', () => {
    expect(getLastSegment('C:')).toBe('C:');
  });

  it('trims whitespace', () => {
    expect(getLastSegment('  /Users/john  ')).toBe('john');
  });
});
