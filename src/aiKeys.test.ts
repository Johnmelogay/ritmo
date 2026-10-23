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
 it('validates audio and image MIME types properly including codecs', async () => {
  // @ts-expect-error server-only module in functions
  const { validateGatewayRequest } = await import('../functions/gateway.mjs');
  const baseRequest = (mimeType: string) => ({
   provider: 'gemini',
   body: {
     contents: [{
       parts: [
         { text: 'descreva refeição' },
         { inlineData: { mimeType, data: 'dGVzdA==' } }
       ]
     }]
   }
  });

  // Valid audio and image MIME types
  expect(() => validateGatewayRequest(baseRequest('audio/webm;codecs=opus'))).not.toThrow();
  expect(() => validateGatewayRequest(baseRequest('audio/webm'))).not.toThrow();
  expect(() => validateGatewayRequest(baseRequest('audio/mp4'))).not.toThrow();
  expect(() => validateGatewayRequest(baseRequest('audio/mp4;codecs=mp4a.40.2'))).not.toThrow();
  expect(() => validateGatewayRequest(baseRequest('audio/ogg;codecs=opus'))).not.toThrow();
  expect(() => validateGatewayRequest(baseRequest('image/jpeg'))).not.toThrow();
  expect(() => validateGatewayRequest(baseRequest('image/png'))).not.toThrow();
  expect(() => validateGatewayRequest(baseRequest('image/webp'))).not.toThrow();

  // Disallowed MIME types
  expect(() => validateGatewayRequest(baseRequest('application/javascript'))).toThrow();
  expect(() => validateGatewayRequest(baseRequest('text/html'))).toThrow();
 }, 15000);
});
