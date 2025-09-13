import { test, expect } from 'vitest';
import { ingestionQueue } from '../index';

test('BullMQ queue should be defined', () => {
    expect(ingestionQueue).toBeDefined();
});
