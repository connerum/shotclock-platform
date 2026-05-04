// Heartbeat - Periodic heartbeat loop

import { loadIdentity } from './identity.js';
import { sendHeartbeat, isConnected } from './socket-client.js';

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let stopped = false;

export function startHeartbeat(): () => void {
  const interval = 30000; // 30 seconds
  
  console.log(`Starting heartbeat every ${interval / 1000} seconds`);
  
  heartbeatInterval = setInterval(() => {
    if (stopped) return;
    
    const identity = loadIdentity();
    if (!identity) {
      console.warn('No identity found, skipping heartbeat');
      return;
    }
    
    if (isConnected()) {
      sendHeartbeat(identity);
    } else {
      console.log('Skipping heartbeat - not connected');
    }
  }, interval);
  
  // Send initial heartbeat
  const identity = loadIdentity();
  if (identity) {
    sendHeartbeat(identity);
  }
  
  // Return stop function
  return () => {
    console.log('Stopping heartbeat');
    stopped = true;
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };
}

export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export function isHeartbeatRunning(): boolean {
  return heartbeatInterval !== null;
}
