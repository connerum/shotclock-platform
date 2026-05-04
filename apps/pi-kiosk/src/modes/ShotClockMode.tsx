// Shot Clock Mode - Main shot clock display

import type { TimerStatePayload } from '@shotclock/shared/types';
import ShotClock from '../components/ShotClock';

interface ShotClockModeProps {
  state?: {
    mode?: { type: string };
    timerState?: TimerStatePayload;
  };
}

export default function ShotClockMode({ state }: ShotClockModeProps) {
  const timerState = state?.timerState;
  
  const shotClock = timerState?.shotClock ?? 24;
  const gameClock = timerState?.gameClock ?? 720;
  const homeScore = timerState?.homeScore ?? 0;
  const awayScore = timerState?.awayScore ?? 0;
  const period = timerState?.period ?? 1;
  const isRunning = timerState?.isRunning ?? false;
  
  const formatGameClock = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isWarning = shotClock <= 5 && shotClock > 0;
  const isExpired = shotClock === 0;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-4">
      {/* Period */}
      <div className="text-3xl font-bold text-gray-500 mb-4">
        PERIOD {period}
      </div>
      
      {/* Main shot clock */}
      <div className="flex-1 flex items-center justify-center w-full">
        <ShotClock 
          value={shotClock} 
          isWarning={isWarning}
          isExpired={isExpired}
          isRunning={isRunning}
        />
      </div>
      
      {/* Game clock */}
      <div className="mb-8">
        <div className="text-8xl font-mono font-bold">
          {formatGameClock(gameClock)}
        </div>
      </div>
      
      {/* Scores */}
      <div className="flex justify-center items-center gap-16 w-full">
        <div className="text-center">
          <p className="text-2xl text-gray-500 mb-2">HOME</p>
          <p className="text-7xl font-bold text-red-500">{homeScore}</p>
        </div>
        <div className="text-4xl text-gray-600">vs</div>
        <div className="text-center">
          <p className="text-2xl text-gray-500 mb-2">AWAY</p>
          <p className="text-7xl font-bold text-blue-500">{awayScore}</p>
        </div>
      </div>
      
      {/* Status indicator */}
      <div className="mt-8">
        {isRunning ? (
          <div className="flex items-center text-green-500">
            <span className="relative flex h-3 w-3 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            RUNNING
          </div>
        ) : (
          <div className="text-yellow-500">PAUSED</div>
        )}
      </div>
    </div>
  );
}
