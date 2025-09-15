import { test, expect } from 'vitest';
import { hash } from '../src/hashing';

test('hash function should return a string', () => {
    expect(typeof hash('test')).toBe('string');
});
