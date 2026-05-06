import { useEffect } from 'react';
import type { PresentationOverlay as PresentationOverlayState } from '@shotclock/shared/types';

interface PresentationOverlayProps {
  overlay?: PresentationOverlayState;
}

const ACCENT_CLASSES: Record<PresentationOverlayState['accent'], string> = {
  blue: 'border-blue-500 text-blue-100 shadow-blue-500/30',
  green: 'border-green-500 text-green-100 shadow-green-500/30',
  yellow: 'border-yellow-400 text-yellow-100 shadow-yellow-400/30',
  orange: 'border-orange-500 text-orange-100 shadow-orange-500/30',
  purple: 'border-purple-500 text-purple-100 shadow-purple-500/30',
  red: 'border-red-500 text-red-100 shadow-red-500/30',
};

const BACKGROUND_CLASSES: Record<PresentationOverlayState['accent'], string> = {
  blue: 'from-blue-950 via-black to-blue-950',
  green: 'from-green-950 via-black to-green-950',
  yellow: 'from-yellow-950 via-black to-yellow-950',
  orange: 'from-orange-950 via-black to-orange-950',
  purple: 'from-purple-950 via-black to-purple-950',
  red: 'from-red-950 via-black to-red-950',
};

export default function PresentationOverlay({ overlay }: PresentationOverlayProps) {
  useEffect(() => {
    if (overlay?.type !== 'sound-horn' || !overlay.active) return;
    playHorn();
  }, [overlay?.active, overlay?.startedAt, overlay?.type]);

  if (!overlay?.active) return null;

  const isEmergency = overlay.type === 'emergency-weather' || overlay.type === 'emergency-medical';
  const accentClass = ACCENT_CLASSES[overlay.accent];
  const backgroundClass = BACKGROUND_CLASSES[overlay.accent];

  return (
    <div
      className={`absolute inset-0 z-20 grid h-full w-full grid-rows-[1fr_auto_1fr] overflow-hidden bg-gradient-to-br ${backgroundClass} p-2 font-mono`}
      style={{ containerType: 'size' }}
    >
      <div className="min-h-0" />
      <div className={`grid min-h-0 gap-1 border-2 ${accentClass} bg-black/80 px-2 py-2 text-center shadow-[0_0_24px]`}>
        {isEmergency && (
          <div className="animate-pulse text-[min(9cqh,6cqw)] font-black leading-none tracking-normal text-red-300">
            EMERGENCY
          </div>
        )}
        <div className="text-[min(22cqh,13cqw)] font-black uppercase leading-[0.9] tracking-normal">
          {overlay.title}
        </div>
        {overlay.message && (
          <div className="text-[min(9cqh,5.5cqw)] font-black uppercase leading-tight text-white/80">
            {overlay.message}
          </div>
        )}
      </div>
      <div className="min-h-0" />
    </div>
  );
}

function playHorn() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'square';
    oscillator.frequency.value = 220;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.8);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.85);
  } catch {
    // Audio feedback is best-effort; the visual overlay still confirms the command.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
