// ShotClock component - Shot clock digit renderer

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatShotClockDisplay } from '@shotclock/shared/timer';

const FINAL_COUNTDOWN_SECONDS = 10;
const BORDER_WIDTH = 2;

interface ShotClockProps {
  value: number;
  isWarning?: boolean;
  shouldStrobe?: boolean;
  isExpired?: boolean;
  isRunning?: boolean;
}

export default function ShotClock({ 
  value, 
  isWarning = false, 
  shouldStrobe = false,
  isExpired = false,
  isRunning = false 
}: ShotClockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [borderSize, setBorderSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setBorderSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const displayValue = useMemo(() => {
    return formatShotClockDisplay(value);
  }, [value]);

  const colorClass = useMemo(() => {
    if (shouldStrobe || isWarning) return 'text-white';
    if (isExpired) return 'text-red-500';
    return 'text-white';
  }, [shouldStrobe, isWarning, isExpired]);

  const glowClass = useMemo(() => {
    if (shouldStrobe) return 'drop-shadow-[0_0_24px_rgba(239,68,68,0.9)]';
    if (isWarning) return 'drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]';
    if (isExpired) return 'drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]';
    if (isRunning) return 'drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]';
    return '';
  }, [shouldStrobe, isWarning, isExpired, isRunning]);

  const borderColor = useMemo(() => {
    if (shouldStrobe) return '#ffffff';
    if (isExpired) return '#ef4444';
    if (isWarning) return '#facc15';
    return '#374151';
  }, [shouldStrobe, isWarning, isExpired]);

  const countdownBorderProgress = Math.max(
    0,
    Math.min(1, (FINAL_COUNTDOWN_SECONDS - value) / FINAL_COUNTDOWN_SECONDS)
  );
  const borderMetrics = useMemo(() => {
    const width = borderSize.width;
    const height = borderSize.height;
    const topLength = width / 2;
    const halfPerimeter = width + height;
    const gap = countdownBorderProgress * halfPerimeter;
    const topVisible = Math.max(0, topLength - gap);
    const sideHidden = Math.max(0, Math.min(height, gap - topLength));
    const sideVisible = Math.max(0, height - sideHidden);
    const bottomHidden = Math.max(0, gap - topLength - height);
    const bottomVisible = Math.max(0, topLength - bottomHidden);

    return {
      topVisible,
      sideVisible,
      bottomVisible,
      bottomLeftStart: topLength - bottomVisible,
      bottomRightStart: topLength,
    };
  }, [borderSize.height, borderSize.width, countdownBorderProgress]);

  const borderTransition = isRunning
    ? 'height 50ms linear, left 50ms linear, width 50ms linear'
    : undefined;

  return (
    <div ref={containerRef} className={`relative flex h-full w-full items-center justify-center ${shouldStrobe ? 'shotclock-strobe' : ''} ${glowClass}`}>
      {/* Main display */}
      <div
        className={`font-mono font-black tabular-nums ${colorClass}`}
        style={{
          fontSize: displayValue.includes('.') ? 'min(28cqw, 42cqh)' : 'min(48cqw, 64cqh)',
          lineHeight: 0.82,
          letterSpacing: 0,
          transform: 'translateY(0.06em)',
        }}
      >
        {displayValue}
      </div>
      
      {/* Countdown border */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute left-0 top-0"
          style={{
            width: borderMetrics.topVisible,
            height: BORDER_WIDTH,
            backgroundColor: borderColor,
            transition: borderTransition,
          }}
        />
        <div
          className="absolute right-0 top-0"
          style={{
            width: borderMetrics.topVisible,
            height: BORDER_WIDTH,
            backgroundColor: borderColor,
            transition: borderTransition,
          }}
        />
        <div
          className="absolute bottom-0 left-0"
          style={{
            width: BORDER_WIDTH,
            height: borderMetrics.sideVisible,
            backgroundColor: borderColor,
            transition: borderTransition,
          }}
        />
        <div
          className="absolute bottom-0 right-0"
          style={{
            width: BORDER_WIDTH,
            height: borderMetrics.sideVisible,
            backgroundColor: borderColor,
            transition: borderTransition,
          }}
        />
        <div
          className="absolute bottom-0"
          style={{
            left: borderMetrics.bottomLeftStart,
            width: borderMetrics.bottomVisible,
            height: BORDER_WIDTH,
            backgroundColor: borderColor,
            transition: borderTransition,
          }}
        />
        <div
          className="absolute bottom-0"
          style={{
            left: borderMetrics.bottomRightStart,
            width: borderMetrics.bottomVisible,
            height: BORDER_WIDTH,
            backgroundColor: borderColor,
            transition: borderTransition,
          }}
        />
      </div>
      
      {/* Warning flash effect */}
      {shouldStrobe && <div className="absolute inset-0 bg-red-500 opacity-15 pointer-events-none" />}
    </div>
  );
}
