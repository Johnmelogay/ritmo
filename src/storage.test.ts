import { describe, expect, it } from 'vitest';
import { demoState, emptyState } from './domain';
import { readStoredState } from './storage';

function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
}
describe('production profile storage', () => {
  it('starts without fabricated records', () => {
    expect(readStoredState(memory(), 'ritmo-local-v1')).toEqual(emptyState());
  });
  it('archives the preview and replaces only the demo-marked profile', () => {
    const storage = memory();
    const preview = JSON.stringify(demoState());
    storage.setItem('local', preview);
    expect(readStoredState(storage, 'local')).toEqual(emptyState());
    expect(storage.getItem('local-demo-archive')).toBe(preview);
    expect(readStoredState(storage, 'local')).toEqual(emptyState());
  });
  it('preserves real profiles and never copies them to another account', () => {
    const storage = memory();
    const real = emptyState();
    real.profile.name = 'Meu perfil real';
    storage.setItem('account-a', JSON.stringify(real));
    expect(readStoredState(storage, 'account-a')).toEqual(real);
    expect(readStoredState(storage, 'account-b')).toEqual(emptyState());
    expect(storage.getItem('account-a-demo-archive')).toBeNull();
  });
});
