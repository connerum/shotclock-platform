// Offline Mode - Offline detection and cached state serving

import { loadState, saveState, type DeviceState } from './state-store.js';

export class OfflineMode {
  private isOffline: boolean = false;
  private offlineState: DeviceState | null = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts = 5;
  
  constructor() {
    this.offlineState = loadState();
  }
  
  /**
   * Check if we should be in offline mode
   */
  checkOfflineStatus(isConnected: boolean): boolean {
    const wasOffline = this.isOffline;
    
    if (!isConnected) {
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.isOffline = true;
      }
    } else {
      this.reconnectAttempts = 0;
      this.isOffline = false;
    }
    
    if (this.isOffline && !wasOffline) {
      console.log('Entering offline mode');
      this.saveOfflineState();
    } else if (!this.isOffline && wasOffline) {
      console.log('Exiting offline mode');
    }
    
    return this.isOffline;
  }
  
  /**
   * Get the current state (cached if offline)
   */
  getState(): DeviceState {
    if (this.isOffline && this.offlineState) {
      return this.offlineState;
    }
    
    return loadState();
  }
  
  /**
   * Update state (also saves to offline cache if applicable)
   */
  updateState(state: Partial<DeviceState>): DeviceState {
    const newState = saveState(state);
    
    if (this.isOffline) {
      this.offlineState = newState;
    }
    
    return newState;
  }
  
  /**
   * Check if we're currently in offline mode
   */
  isInOfflineMode(): boolean {
    return this.isOffline;
  }
  
  /**
   * Save current state for offline use
   */
  saveOfflineState(): void {
    const state = loadState();
    this.offlineState = state;
    console.log('Saved state for offline use');
  }
  
  /**
   * Get cached state for when we come back online
   */
  getCachedState(): DeviceState | null {
    return this.offlineState;
  }
  
  /**
   * Clear offline cache
   */
  clearOfflineCache(): void {
    this.offlineState = null;
  }
  
  /**
   * Sync state when coming back online
   */
  async syncWhenOnline(): Promise<void> {
    if (!this.isOffline && this.offlineState) {
      // In production, would sync state with server
      console.log('Would sync offline state with server');
      this.offlineState = null;
    }
  }
  
  /**
   * Reset reconnect attempts
   */
  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }
}
