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
      <div className="w-full h-full flex items-center justify-center bg-black text-white">
        <p className="text-2xl">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-green-500 mb-4">Pairing Mode</h1>
        <p className="text-gray-400 mb-8">Enter this code on the Shotclock dashboard</p>
        
        <div className="bg-gray-900 rounded-lg p-12 mb-8">
          <p className="text-2xl font-mono tracking-widest">
            {displayCode.split('').map((char, i) => (
              <span
                key={i}
                className={`inline-block mx-1 ${
                  char !== '-' ? 'text-green-400' : 'text-gray-600'
                }`}
                style={{
                  fontSize: '8rem',
                  minWidth: '5rem',
                  textAlign: 'center',
                }}
              >
                {char}
              </span>
            ))}
          </p>
        </div>
        
        <div className="text-gray-500">
          <p>Code expires in: <span className="text-yellow-400 font-mono">{formattedTime}</span></p>
        </div>
      </div>
    </div>
  );
}
