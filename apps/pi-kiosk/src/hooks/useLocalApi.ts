// useLocalApi hook - Polls /local/state, /local/config

import { useState, useEffect, useCallback } from 'react';
import type { TimerState, DeviceMode, DisplayProfile } from '@shotclock/shared/types';

interface LocalApiState {
  mode?: DeviceMode;
  timerState?: TimerState;
}

interface LocalApiConfig {
  displayProfile: DisplayProfile;
  calibrationData?: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    timestamp: number;
  };
}

interface UseLocalApiResult {
  state: LocalApiState | null;
  config: LocalApiConfig | null;
  pairingCode: string | null;
  timeRemaining: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const API_BASE = 'http://127.0.0.1:3001';
const POLL_INTERVAL = 1000;

export function useLocalApi(): UseLocalApiResult {
  const [state, setState] = useState<LocalApiState | null>(null);
  const [config, setConfig] = useState<LocalApiConfig | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch state
      const stateRes = await fetch(`${API_BASE}/local/state`);
      if (stateRes.ok) {
        const data = await stateRes.json();
        setState(data.state);
      }

      // Fetch config
      const configRes = await fetch(`${API_BASE}/local/config`);
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig({ displayProfile: data.displayProfile, calibrationData: data.calibrationData });
      }

      // Fetch pairing code
      const codeRes = await fetch(`${API_BASE}/local/pairing-code`);
      if (codeRes.ok) {
        const data = await codeRes.json();
        setPairingCode(data.code);
        setTimeRemaining(data.timeRemaining);
      }

      setError(null);
      setIsLoading(false);
    } catch {
      // Silently handle connection errors (agent might not be running)
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    const interval = setInterval(fetchData, POLL_INTERVAL);
    
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    state,
    config,
    pairingCode,
    timeRemaining,
    isLoading,
    error,
    refresh: fetchData,
  };
}
