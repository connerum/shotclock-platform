import { useState, useEffect } from 'react';
import { useLocalApi } from './hooks/useLocalApi';
import { useDisplayProfile } from './hooks/useDisplayProfile';
import SetupMode from './modes/SetupMode';
import PairingMode from './modes/PairingMode';
import OfflineMode from './modes/OfflineMode';
import ShotClockMode from './modes/ShotClockMode';
import MediaMode from './modes/MediaMode';
import CalibrationMode from './modes/CalibrationMode';
import BlankMode from './modes/BlankMode';
import ViewportCanvas from './components/ViewportCanvas';

type KioskMode = 'setup' | 'pairing' | 'offline' | 'shot-clock' | 'media' | 'calibration' | 'blank';

export default function App() {
  const { state, config, isLoading } = useLocalApi();
  const displayProfile = useDisplayProfile(config?.displayProfile);
  const [currentMode, setCurrentMode] = useState<KioskMode>('pairing');

  useEffect(() => {
    if (state?.mode?.type) {
      setCurrentMode(state.mode.type);
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
        return <SetupMode />;
      case 'pairing':
        return <PairingMode />;
      case 'offline':
        return <OfflineMode />;
      case 'shot-clock':
        return <ShotClockMode state={state} />;
      case 'media':
        return <MediaMode />;
      case 'calibration':
        return <CalibrationMode />;
      case 'blank':
        return <BlankMode />;
      default:
        return <ShotClockMode state={state} />;
    }
  };

  return (
    <ViewportCanvas displayProfile={displayProfile}>
      {renderMode()}
    </ViewportCanvas>
  );
}
