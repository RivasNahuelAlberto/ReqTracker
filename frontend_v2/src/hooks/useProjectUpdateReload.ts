import { useEffect, useRef } from 'react'
import { useAuth } from '../components/AuthContext'

type ReloadCallback = () => Promise<void> | void

export function useProjectUpdateReload(projectId: string, onProjectUpdated: ReloadCallback) {
  const { socket } = useAuth()
  const callbackRef = useRef<ReloadCallback>(onProjectUpdated)

  useEffect(() => {
    callbackRef.current = onProjectUpdated
  }, [onProjectUpdated])

  useEffect(() => {
    if (!socket || !projectId) return

    const handleUpdate = () => {
      callbackRef.current()
    }

    socket.on('projectUpdated', handleUpdate)
    socket.on('dataChanged', handleUpdate)

    return () => {
      socket.off('projectUpdated', handleUpdate)
      socket.off('dataChanged', handleUpdate)
    }
  }, [socket, projectId])
}
