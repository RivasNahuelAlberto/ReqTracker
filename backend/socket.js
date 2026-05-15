let io = null;

export function setSocketIo(serverIo) {
  io = serverIo;
}

export function getSocketIo() {
  return io;
}

export function emitGlobalDataChanged(message = 'Hubo cambios en el sistema. Haz clic para recargar.') {
  if (!io) return;
  io.emit('dataChanged', {
    message,
    type: 'reload'
  });
}

export function emitProjectDataChanged(projectId, message = 'Los datos del proyecto han sido actualizados. Haz clic para recargar.') {
  if (!io || !projectId) return;
  io.to(projectId).emit('projectUpdated');
  io.to(projectId).emit('dataChanged', {
    message,
    type: 'reload'
  });
}

export function emitProjectNotification(projectId, notification) {
  if (!io || !projectId || !notification) return;
  io.to(projectId).emit('projectNotification', notification);
}

export function emitProjectAnalyticsUpdated(projectId, payload = {}) {
  if (!io || !projectId) return;
  io.to(projectId).emit('analytics:update', {
    message: payload.message || 'Analytics actualizado para este proyecto.',
    ...payload
  });
}

export function emitProjectGraphRecomputed(projectId, payload = {}) {
  if (!io || !projectId) return;
  io.to(projectId).emit('graph:recomputed', {
    message: payload.message || 'El grafo de proyecto ha sido recalculado.',
    ...payload
  });
}

export function emitProjectPredictionGenerated(projectId, payload = {}) {
  if (!io || !projectId) return;
  io.to(projectId).emit('prediction:generated', {
    message: payload.message || 'Se generó una nueva predicción analítica.',
    ...payload
  });
}

export function emitProjectSemanticDrift(projectId, payload = {}) {
  if (!io || !projectId) return;
  io.to(projectId).emit('semantic:drift', {
    message: payload.message || 'Se detectó drift semántico en el proyecto.',
    ...payload
  });
}

export function emitProjectRiskDetected(projectId, payload = {}) {
  if (!io || !projectId) return;
  io.to(projectId).emit('risk:detected', {
    message: payload.message || 'Se detectó riesgo crítico en el proyecto.',
    ...payload
  });
}

// ==================== ETAPA 9: Agent Analytics Events ====================

export function emitAgentReasoningUpdated(projectId, payload = {}) {
  if (!io || !projectId) return;
  io.to(projectId).emit('agent:reasoning:updated', {
    message: payload.message || 'Agent reasoning trace updated',
    ...payload
  });
}

export function emitAgentWarning(projectId, payload = {}) {
  if (!io || !projectId) return;
  io.to(projectId).emit('agent:warning', {
    message: payload.message || 'Agent warning detected',
    ...payload
  });
}

export function emitToolEfficiencyAnalysis(projectId, payload = {}) {
  if (!io || !projectId) return;
  io.to(projectId).emit('agent:tool:efficiency', {
    message: payload.message || 'Tool efficiency analysis completed',
    ...payload
  });
}

export function emitPlannerConfidenceScore(projectId, payload = {}) {
  if (!io || !projectId) return;
  io.to(projectId).emit('agent:planner:confidence', {
    message: payload.message || 'Planner confidence score updated',
    ...payload
  });
}

export function emitContextPollutionDetected(projectId, payload = {}) {
  if (!io || !projectId) return;
  io.to(projectId).emit('agent:context:pollution', {
    message: payload.message || 'Context pollution detected',
    ...payload
  });
}

export function emitHallucinationRiskAlert(projectId, payload = {}) {
  if (!io || !projectId) return;
  io.to(projectId).emit('agent:hallucination:risk', {
    message: payload.message || 'Hallucination risk estimated',
    ...payload
  });
}
