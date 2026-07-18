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
