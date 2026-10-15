import { describe, it, expect } from 'vitest';
import { emptyState, today } from '../../src/domain.js';
import { talkWithCoach } from './coach.js';

describe('WhatsApp Coach Autonomous Engine', () => {
  const mockState = {
    ...emptyState(),
    profile: {
      ...emptyState().profile,
      name: 'João',
      water: 2500,
      calories: 2200,
      trainTime: '18:00',
      mealTime: '12:30'
    }
  };

  it('detects water intake and returns water action', async () => {
    // If running in test environment with real Gemini API key
    if (!process.env.GEMINI_API_KEY && !process.env.VITE_GEMINI_API_KEY) {
      console.log('Skipping live Gemini test (no key in env)');
      return;
    }

    const reply = await talkWithCoach(mockState, 'Bebi 500ml de água agora');
    expect(reply.message).toBeTruthy();
    expect(reply.action?.type).toBe('WATER');
    expect(reply.action?.waterMl).toBe(500);
    expect(reply.message).not.toMatch(/^Olá/i);
    expect(reply.message).not.toMatch(/^Oi, tudo bem/i);
  });

  it('detects meal intake and returns meal action', async () => {
    if (!process.env.GEMINI_API_KEY && !process.env.VITE_GEMINI_API_KEY) return;

    const reply = await talkWithCoach(mockState, 'Almocei 180g de frango grelhado e 200g de arroz');
    expect(reply.message).toBeTruthy();
    expect(reply.action?.type).toBe('MEAL');
    expect(reply.action?.meal?.items.length).toBeGreaterThan(0);
  });
});
