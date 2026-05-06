import { useState, useEffect } from 'react';
import { useLocalApi } from './hooks/useLocalApi';
import { useDisplayProfile } from './hooks/useDisplayProfile';
import SetupMode from './modes/SetupMode';
import PairingMode from './modes/PairingMode';
import OfflineMode from './modes/OfflineMode';
import ShotClockMode from './modes/ShotClockMode';
import VolleyballMode from './modes/VolleyballMode';
import WrestlingMode from './modes/WrestlingMode';
import MediaMode from './modes/MediaMode';
import CalibrationMode from './modes/CalibrationMode';
import BlankMode from './modes/BlankMode';
import ViewportCanvas from './components/ViewportCanvas';

type KioskMode = 'setup' | 'pairing' | 'offline' | 'basketball' | 'wrestling' | 'volleyball' | 'shot-clock' | 'media' | 'calibration' | 'blank';

interface ShotClockState {
  mode?: { type: string };
  timerState?: {
    shotClock: number;
    gameClock: number;
    homeScore: number;
    awayScore: number;
    homeSets?: number;
    awaySets?: number;
    period?: number;
    isRunning: boolean;
    isPaused?: boolean;
    lastUpdated?: number;
  };
}

export default function App() {
  const { state, config, isLoading } = useLocalApi();
  const displayProfile = useDisplayProfile(config?.displayProfile ?? null);
  const [currentMode, setCurrentMode] = useState<KioskMode>('pairing');

  useEffect(() => {
    if (state?.mode?.type) {
      setCurrentMode(state.mode.type as KioskMode);
    }
  }, [state?.mode]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-4xl font-mono mb-4">Loading...</div>
          <div className="text-gray-500">Shotclock Kiosk</div>
        </div>
      </div>
    );
  }

  const renderMode = () => {
    switch (currentMode) {
      case 'setup':
        return <SetupMode setupAp={config?.setupAp} />;
      case 'pairing':
        return <PairingMode />;
      case 'offline':
        return <OfflineMode />;
      case 'basketball':
        return <ShotClockMode state={state as ShotClockState | undefined} />;
      case 'wrestling':
        return <WrestlingMode state={state as ShotClockState | undefined} />;
      case 'volleyball':
        return <VolleyballMode state={state as ShotClockState | undefined} />;
      case 'shot-clock':
        return <ShotClockMode state={state as ShotClockState | undefined} />;
      case 'media':
        return <MediaMode />;
      case 'calibration':
        return <CalibrationMode />;
      case 'blank':
        return <BlankMode />;
      default:
        return <ShotClockMode state={state as ShotClockState | undefined} />;
    }
  };

  return (
    <ViewportCanvas displayProfile={displayProfile}>
      {renderMode()}
    </ViewportCanvas>
  );
}
