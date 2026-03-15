import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * useSocket — React hook for Socket.IO real-time sync.
 *
 * Connects to the backend WebSocket server and listens for
 * task:change events. Calls onTaskChange when any connected
 * client makes a task mutation (create, update, move, delete).
 *
 * @param {function} onTaskChange — callback fired on task:change events
 */
export default function useSocket(onTaskChange) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
    });

    socket.on('task:change', (payload) => {
      console.log('[WS] task:change:', payload.action);
      onTaskChange?.(payload);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    return () => {
      socket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return socketRef;
}
