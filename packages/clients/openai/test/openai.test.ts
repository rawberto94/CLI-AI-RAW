import { test, expect } from 'vitest';
import { OpenAIClient } from '../index';

test('OpenAIClient should be defined', () => {
    expect(OpenAIClient).toBeDefined();
});
