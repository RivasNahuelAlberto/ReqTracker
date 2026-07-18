export function normalizeLockPayload(payload = {}) {
  const rawTargetType = payload?.targetType?.toString?.() || '';
  const rawTargetId = payload?.targetId?.toString?.() || '';
  const rawSessionId = payload?.sessionId?.toString?.() || '';
  const rawLockedBy = payload?.lockedBy?.toString?.() || '';

  const targetType = rawTargetType.trim();
  const targetId = rawTargetId.trim();
  const sessionId = rawSessionId.trim();
  const lockedBy = rawLockedBy.trim();

  return {
    targetType,
    targetId,
    sessionId,
    lockedBy,
    isValid: Boolean(targetType && targetId && sessionId)
  };
}

export function normalizeProjectLocks(locks) {
  if (!Array.isArray(locks)) return [];

  return locks
    .filter((lock) => lock && typeof lock === 'object')
    .map((lock) => ({
      ...lock,
      targetType: lock.targetType?.toString?.().trim() || '',
      targetId: lock.targetId?.toString?.().trim() || '',
      sessionId: lock.sessionId?.toString?.().trim() || '',
      lockedBy: lock.lockedBy?.toString?.().trim() || 'Usuario',
      lockedAt: lock.lockedAt || new Date()
    }))
    .filter((lock) => lock.targetType && lock.targetId && lock.sessionId);
}

export function getLockIdentity(lock = {}) {
  return `${lock?.targetType || ''}:${lock?.targetId || ''}:${lock?.sessionId || ''}`;
}
