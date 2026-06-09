'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'courtcast:selectedDeviceIds';

type CommandResponse = {
  response: Response;
  data: any;
};

type SelectedDevicesContextValue = {
  selectedDeviceIds: string[];
  isHydrated: boolean;
  isSelected: (deviceId: string) => boolean;
  setDeviceSelected: (deviceId: string, selected: boolean) => void;
  clearSelection: () => void;
};

const SelectedDevicesContext = createContext<SelectedDevicesContextValue | null>(null);

export function SelectedDevicesProvider({ children }: { children: ReactNode }) {
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      setSelectedDeviceIds(normalizeDeviceIds(parsed));
    } catch {
      setSelectedDeviceIds([]);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selectedDeviceIds));
  }, [isHydrated, selectedDeviceIds]);

  const isSelected = useCallback((deviceId: string) => selectedDeviceIds.includes(deviceId), [selectedDeviceIds]);

  const setDeviceSelected = useCallback((deviceId: string, selected: boolean) => {
    setSelectedDeviceIds((current) => {
      const normalized = deviceId.trim();
      if (!normalized) return current;
      const existing = new Set(current);
      if (selected) {
        existing.add(normalized);
      } else {
        existing.delete(normalized);
      }
      return Array.from(existing);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedDeviceIds([]), []);

  const value = useMemo<SelectedDevicesContextValue>(() => ({
    selectedDeviceIds,
    isHydrated,
    isSelected,
    setDeviceSelected,
    clearSelection,
  }), [clearSelection, isHydrated, isSelected, selectedDeviceIds, setDeviceSelected]);

  return (
    <SelectedDevicesContext.Provider value={value}>
      {children}
    </SelectedDevicesContext.Provider>
  );
}

export function useSelectedDevices() {
  const context = useContext(SelectedDevicesContext);
  if (!context) {
    throw new Error('useSelectedDevices must be used within SelectedDevicesProvider');
  }
  return context;
}

export function useDeviceCommandTargets(deviceId: string) {
  const { selectedDeviceIds, isHydrated } = useSelectedDevices();
  const routeDeviceIsSelected = selectedDeviceIds.includes(deviceId);
  const isSyncActive = isHydrated && routeDeviceIsSelected && selectedDeviceIds.length > 1;
  const activeTargetDeviceIds = isSyncActive ? selectedDeviceIds : [deviceId];
  const syncInactiveReason = isHydrated && selectedDeviceIds.length > 1 && !routeDeviceIsSelected
    ? 'A multi-display selection is active, but this display is not selected. Commands on this page will only affect this display.'
    : null;

  return {
    selectedDeviceIds,
    activeTargetDeviceIds,
    isHydrated,
    isSyncActive,
    syncInactiveReason,
  };
}

export function useDeviceCommandDispatcher(deviceId: string) {
  const targets = useDeviceCommandTargets(deviceId);

  const sendCommand = useCallback(async (type: string, payload?: unknown): Promise<CommandResponse> => {
    const isSyncCommand = targets.isSyncActive && isSyncGameCommand(type);
    const response = await fetch(isSyncCommand ? '/api/devices/sync-command' : `/api/devices/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isSyncCommand
        ? {
            primaryDeviceId: deviceId,
            targetDeviceIds: targets.activeTargetDeviceIds,
            type,
            payload,
          }
        : { type, payload }),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }, [deviceId, targets.activeTargetDeviceIds, targets.isSyncActive]);

  return {
    ...targets,
    sendCommand,
  };
}

export function SyncTargetBanner({ deviceId }: { deviceId: string }) {
  const { activeTargetDeviceIds, isHydrated, isSyncActive, syncInactiveReason } = useDeviceCommandTargets(deviceId);

  if (!isHydrated) return null;

  if (isSyncActive) {
    return (
      <div className="mb-4 rounded-lg border border-blue-500/35 bg-blue-950/40 px-4 py-3 text-sm text-blue-100">
        Sync active for {activeTargetDeviceIds.length} selected displays:
        <span className="ml-2 font-mono text-blue-200">{activeTargetDeviceIds.join(', ')}</span>
      </div>
    );
  }

  if (syncInactiveReason) {
    return (
      <div className="mb-4 rounded-lg border border-orange-500/35 bg-orange-950/40 px-4 py-3 text-sm text-orange-100">
        {syncInactiveReason}
      </div>
    );
  }

  return null;
}

function normalizeDeviceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((deviceId) => {
    if (typeof deviceId !== 'string') return;
    const trimmed = deviceId.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    normalized.push(trimmed);
  });
  return normalized;
}

function isSyncGameCommand(type: string): boolean {
  return type === 'set_mode' || type === 'set_timer' || type === 'presentation';
}
