import { test, expect } from 'vitest';
import { hash } from '../hashing';

test('hash function should return a string', () => {
    expect(typeof hash('test')).toBe('string');
});
