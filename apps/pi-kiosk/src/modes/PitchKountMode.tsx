import { useEffect, useState } from 'react';
import {
  PITCHKOUNT_DAILY_LIMIT,
  PITCHKOUNT_SLIDE_DURATION_MS,
  normalizePitchKountState,
  type PitchKountState,
} from '@shotclock/shared/types';

export default function PitchKountMode({ pitchKount }: { pitchKount?: PitchKountState }) {
  const state = normalizePitchKountState(pitchKount);
  const [activeSlide, setActiveSlide] = useState<'main' | 'stats'>('main');
  const pitchesRemaining = Math.max(0, PITCHKOUNT_DAILY_LIMIT - state.pitchCount);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((current) => current === 'main' ? 'stats' : 'main');
    }, PITCHKOUNT_SLIDE_DURATION_MS);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="pitchkount-stage">
      <div className={`pitchkount-board pitchkount-board--${activeSlide}`} data-testid="pitchkount-display" data-slide={activeSlide}>
        <div className="pitchkount-grid" aria-hidden="true" />
        <div className="pitchkount-glow pitchkount-glow-top" aria-hidden="true" />
        <div className="pitchkount-glow pitchkount-glow-bottom" aria-hidden="true" />

        {activeSlide === 'main' ? (
          <main className={`pitchkount-slide pitchkount-main ${state.showPitchSpeed ? '' : 'pitchkount-main--no-speed'}`} key="main">
            <SchoolBanner teamName={state.teamName} />
            <section className="pitchkount-namebar">
              <span>#{state.pitcherNumber}</span>
              <strong>{state.pitcherName}</strong>
            </section>
            <section className="pitchkount-main-hero">
              <Headshot state={state} />
              <div className="pitchkount-count-card">
                <div className="pitchkount-label">PITCH COUNT</div>
                <strong>{state.pitchCount}</strong>
                <div className="pitchkount-remaining">
                  <span>PITCHES LEFT</span>
                  <b>{pitchesRemaining}</b>
                  <small>OF {PITCHKOUNT_DAILY_LIMIT}</small>
                </div>
              </div>
            </section>
            <section className="pitchkount-results">
              <div><span>STRIKES</span><strong>{state.strikes}</strong></div>
              <div><span>BALLS</span><strong>{state.balls}</strong></div>
            </section>
            {state.showPitchSpeed && (
              <section className="pitchkount-speed-panel">
                <div className="pitchkount-label">PITCH SPEED</div>
                <div><strong>{state.pitchSpeedMph}</strong><span>MPH</span></div>
              </section>
            )}
            <PitchKountFooter slide="01" />
          </main>
        ) : (
          <main className="pitchkount-slide pitchkount-stats-slide" key="stats">
            <SchoolBanner teamName={state.teamName} />
            <section className="pitchkount-stats-player">
              <Headshot state={state} compact />
              <div>
                <span>PLAYER STATS</span>
                <strong>{state.pitcherName}</strong>
                <small>#{state.pitcherNumber} · PITCHER</small>
              </div>
            </section>
            <section className="pitchkount-stats-grid">
              <Stat label="ERA" value={state.era.toFixed(2)} featured />
              <Stat label="RECORD" value={`${state.wins}–${state.losses}`} featured />
              <Stat label="INNINGS" value={state.inningsPitched} />
              <Stat label="STRIKEOUTS" value={state.strikeouts} />
              <Stat label="WALKS" value={state.walks} />
              <Stat label="PITCH TYPE" value={state.pitchType} compact />
            </section>
            <PitchKountFooter slide="02" />
          </main>
        )}
      </div>
    </div>
  );
}

function SchoolBanner({ teamName }: { teamName: string }) {
  return (
    <header className="pitchkount-school-banner">
      <span>SCHOOL</span>
      <strong>{teamName}</strong>
    </header>
  );
}

function Headshot({ state, compact = false }: { state: PitchKountState; compact?: boolean }) {
  return (
    <div className={`pitchkount-headshot ${compact ? 'pitchkount-headshot--compact' : ''}`}>
      {state.headshotUrl ? (
        <img src={state.headshotUrl} alt="" />
      ) : (
        <div className="pitchkount-headshot-placeholder" aria-label="No player headshot uploaded">
          <span>PLAYER</span>
          <strong>#{state.pitcherNumber}</strong>
        </div>
      )}
    </div>
  );
}

function PitchKountFooter({ slide }: { slide: string }) {
  return (
    <footer className="pitchkount-footer">
      <div className="pitchkount-wordmark"><span>PITCH</span><strong>KOUNT</strong></div>
      <span>{slide} / 02</span>
    </footer>
  );
}

function Stat({ label, value, featured = false, compact = false }: { label: string; value: string | number; featured?: boolean; compact?: boolean }) {
  return (
    <div className={`pitchkount-stat ${featured ? 'pitchkount-stat--featured' : ''} ${compact ? 'pitchkount-stat--compact' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
