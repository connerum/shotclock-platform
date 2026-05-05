// Pairing Mode - Shows pairing code

import { useState, useEffect } from 'react';
import { useLocalApi } from '../hooks/useLocalApi';

export default function PairingMode() {
  const { pairingCode, timeRemaining, isLoading } = useLocalApi();
  const [displayCode, setDisplayCode] = useState<string>('------');
  const [formattedTime, setFormattedTime] = useState<string>('--:--:--');

  useEffect(() => {
    if (pairingCode) {
      setDisplayCode(pairingCode.padStart(6, '-').slice(0, 6));
    }
  }, [pairingCode]);

  useEffect(() => {
    if (timeRemaining > 0) {
      const hours = Math.floor(timeRemaining / 3600000);
      const minutes = Math.floor((timeRemaining % 3600000) / 60000);
      const seconds = Math.floor((timeRemaining % 60000) / 1000);
      setFormattedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }
  }, [timeRemaining]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-white">
        <p className="font-mono text-[min(11cqw,14cqh)]">Loading</p>
      </div>
    );
  }

  return (
    <div
      className="grid h-full w-full grid-rows-[22%_48%_16%_14%] overflow-hidden bg-black px-2 py-1 text-center text-white"
      style={{ containerType: 'size' }}
    >
      <div className="flex min-h-0 items-center justify-center overflow-hidden font-bold uppercase leading-none tracking-normal text-green-500 text-[min(9cqw,12cqh)]">
        Pairing
      </div>

      <div className="flex min-h-0 items-center justify-center overflow-hidden rounded border border-green-500/50 bg-gray-950 px-1">
        <div className="font-mono font-black leading-none tracking-[0.08em] tabular-nums text-green-400 text-[min(17cqw,38cqh)]">
          {displayCode}
        </div>
      </div>

      <div className="flex min-h-0 items-center justify-center overflow-hidden leading-none text-gray-300 text-[min(5.5cqw,8cqh)]">
        Enter on dashboard
      </div>

      <div className="flex min-h-0 items-center justify-center overflow-hidden font-mono leading-none text-yellow-400 text-[min(5cqw,7cqh)]">
        {formattedTime}
      </div>
    </div>
  );
}
