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
