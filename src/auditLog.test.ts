import { describe, it, expect, beforeEach } from 'vitest';
import { getAuditLogs, recordAuditEntry, revertAuditEntry, reapplyAuditEntry, clearAuditLogs, type AuditLogEntry } from './auditLog';
import { emptyState, type AppState } from './domain';

describe('Audit Log Architecture & Revert', () => {
  beforeEach(() => {
    clearAuditLogs();
  });

  it('records an audit entry and retrieves it', () => {
    const stateA: AppState = emptyState();
    const stateB: AppState = {
      ...stateA,
      profile: { ...stateA.profile, calories: 2500 }
    };

    const entry: AuditLogEntry = {
      id: 'test-1',
      timestamp: new Date().toISOString(),
      prompt: 'Aumentar calorias para 2500',
      summary: 'Meta calórica atualizada para 2.500 kcal',
      source: 'jev_ai',
      jevDecision: {
        intent: 'diet_and_nutrition',
        confidence: 0.98
      },
      changes: [
        {
          category: 'diet_macros',
          icon: 'flame',
          label: 'Meta Calórica',
          description: 'Aumento de calorias diárias',
          before: '2.000 kcal',
          after: '2.500 kcal'
        }
      ],
      snapshotBefore: stateA,
      snapshotAfter: stateB,
      status: 'applied'
    };

    recordAuditEntry(entry);
    const logs = getAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('test-1');
    expect(logs[0].status).toBe('applied');
  });

  it('safely reverts an applied change back to snapshotBefore', () => {
    const stateA: AppState = emptyState();
    const stateB: AppState = {
      ...stateA,
      profile: { ...stateA.profile, calories: 2800 }
    };

    const entry: AuditLogEntry = {
      id: 'test-revert',
      timestamp: new Date().toISOString(),
      prompt: 'Aumentar calorias para 2800',
      summary: 'Alteração para 2.800 kcal',
      source: 'jev_ai',
      changes: [],
      snapshotBefore: stateA,
      snapshotAfter: stateB,
      status: 'applied'
    };

    recordAuditEntry(entry);

    // Current state is stateB; user calls revert
    const result = revertAuditEntry('test-revert', stateB);
    expect(result.success).toBe(true);
    expect(result.restoredState?.profile.calories).toBe(stateA.profile.calories);

    // Verify log entry status changed to reverted
    const logs = getAuditLogs();
    expect(logs[0].status).toBe('reverted');
    expect(logs[0].revertedAt).toBeDefined();

    // Trying to revert again fails
    const secondRevert = revertAuditEntry('test-revert', result.restoredState!);
    expect(secondRevert.success).toBe(false);
  });

  it('re-applies a reverted change back to snapshotAfter', () => {
    const stateA: AppState = emptyState();
    const stateB: AppState = {
      ...stateA,
      profile: { ...stateA.profile, calories: 3000 }
    };

    const entry: AuditLogEntry = {
      id: 'test-reapply',
      timestamp: new Date().toISOString(),
      prompt: 'Calorias para 3000',
      summary: 'Meta 3.000 kcal',
      source: 'jev_ai',
      changes: [],
      snapshotBefore: stateA,
      snapshotAfter: stateB,
      status: 'applied'
    };

    recordAuditEntry(entry);
    revertAuditEntry('test-reapply', stateB);

    const reapplyResult = reapplyAuditEntry('test-reapply', stateA);
    expect(reapplyResult.success).toBe(true);
    expect(reapplyResult.restoredState?.profile.calories).toBe(3000);

    const logs = getAuditLogs();
    expect(logs[0].status).toBe('applied');
  });
});
