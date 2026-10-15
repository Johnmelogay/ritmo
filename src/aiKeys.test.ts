import { describe, it, expect } from 'vitest';
import { getGeminiKey, getTypeSafeKey, getUsdaKey, getOpenAiKey, getAiStatus, DEFAULT_GEMINI_API_KEY, DEFAULT_TYPESAFE_API_KEY } from './ai';
import { configured } from './firebase';

describe('Private AI gateway security', () => {
 it('does not expose provider secrets or signed-out access', () => {
  expect(DEFAULT_GEMINI_API_KEY).toBe('');
  expect(DEFAULT_TYPESAFE_API_KEY).toBe('');
  expect(getGeminiKey()).toBe('');
  expect(getTypeSafeKey()).toBe('');
  expect(getUsdaKey()).toBe('');
  expect(getOpenAiKey()).toBe('');
 });
 it('never claims AI is ready for a signed-out user', () => {
  expect(getAiStatus().ready).toBe(false);
 });
 it('keeps only public Firebase configuration in the client', () => {
  expect(configured).toBe(true);
 });
});
