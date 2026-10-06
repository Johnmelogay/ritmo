import { describe, it, expect } from 'vitest';
import { getGeminiKey, getTypeSafeKey, getUsdaKey, getAiStatus, DEFAULT_GEMINI_API_KEY, DEFAULT_TYPESAFE_API_KEY } from './ai';
import { configured } from './firebase';

describe('Built-in Global API Keys & AI Provider Availability', () => {
  it('provides valid default Gemini and TypeSafe API keys for all users without manual input', () => {
    const geminiKey = getGeminiKey();
    expect(geminiKey).toBeTruthy();
    expect(geminiKey).toBe(DEFAULT_GEMINI_API_KEY);

    const typesafeKey = getTypeSafeKey();
    expect(typesafeKey).toBeTruthy();
    expect(typesafeKey).toBe(DEFAULT_TYPESAFE_API_KEY);

    const usdaKey = getUsdaKey();
    expect(usdaKey).toBeTruthy();
  });

  it('marks AI status as ready and active by default', () => {
    const status = getAiStatus();
    expect(status.gemini).toBe(true);
    expect(status.typesafe).toBe(true);
    expect(status.ready).toBe(true);
  });

  it('marks Firebase as configured out of the box', () => {
    expect(configured).toBe(true);
  });
});
