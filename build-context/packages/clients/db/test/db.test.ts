import { test, expect } from 'vitest';
import prisma from '../index';

test('Prisma client should be defined', () => {
    expect(prisma).toBeDefined();
});
