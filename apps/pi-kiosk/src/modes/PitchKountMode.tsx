import { useEffect, useState } from 'react';
import {
  PITCHKOUNT_DAILY_LIMIT,
  PITCHKOUNT_MAIN_SLIDE_DURATION_MS,
  PITCHKOUNT_STATS_SLIDE_DURATION_MS,
  normalizePitchKountState,
  type PitchKountState,
} from '@shotclock/shared/types';

export default function PitchKountMode({ pitchKount }: { pitchKount?: PitchKountState }) {
  const state = normalizePitchKountState(pitchKount);
  const [activeSlide, setActiveSlide] = useState<'main' | 'stats'>('main');
  const pitchesRemaining = Math.max(0, PITCHKOUNT_DAILY_LIMIT - state.pitchCount);

  useEffect(() => {
    const duration = activeSlide === 'main'
      ? PITCHKOUNT_MAIN_SLIDE_DURATION_MS
      : PITCHKOUNT_STATS_SLIDE_DURATION_MS;
    const timeout = window.setTimeout(() => {
      setActiveSlide(activeSlide === 'main' ? 'stats' : 'main');
    }, duration);
    return () => window.clearTimeout(timeout);
  }, [activeSlide]);

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
              <div className="pitchkount-count-stack">
                <div className="pitchkount-count-card">
                  <div className="pitchkount-label">PITCH COUNT</div>
                  <strong>{state.pitchCount}</strong>
                </div>
                <div className="pitchkount-remaining-card">
                  <div className="pitchkount-label">PITCHES LEFT</div>
                  <div>
                    <strong>{pitchesRemaining}</strong>
                    <small>OF {PITCHKOUNT_DAILY_LIMIT}</small>
                  </div>
                </div>
              </div>
            </section>
            <section className={`pitchkount-results ${state.showPitchSpeed ? 'pitchkount-results--with-speed' : ''}`}>
              <PitchMetric label="STRIKES" value={state.strikes} />
              <PitchMetric label="BALLS" value={state.balls} />
              {state.showPitchSpeed && <PitchMetric label="SPEED" value={state.pitchSpeedMph} unit="MPH" />}
            </section>
            <PitchKountFooter />
          </main>
        ) : (
          <main className="pitchkount-slide pitchkount-stats-slide" key="stats">
            <SchoolBanner teamName={state.pitcherName} label="PITCHER" />
            <section className="pitchkount-stats-player">
              <Headshot state={state} compact />
              <div>
                <span>PLAYER STATS</span>
                <strong>{state.teamName}</strong>
                <small>#{state.pitcherNumber} · PITCHER</small>
              </div>
            </section>
            <section className="pitchkount-stats-grid">
              <Stat label="ERA" value={state.era.toFixed(2)} featured />
              <Stat label="RECORD" value={`${state.wins}–${state.losses}`} featured />
              <Stat label="INNINGS" value={state.inningsPitched} />
              <Stat label="STRIKEOUTS" value={state.strikeouts} />
              <Stat label="WALKS" value={state.walks} />
              <Stat label="WHIP" value={state.whip.toFixed(2)} />
            </section>
            <PitchKountFooter />
          </main>
        )}
      </div>
    </div>
  );
}

function SchoolBanner({ teamName, label = 'SCHOOL' }: { teamName: string; label?: string }) {
  return (
    <header className="pitchkount-school-banner">
      <span>{label}</span>
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

function PitchMetric({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div>
      <span>{label}</span>
      <div><strong>{value}</strong>{unit && <small>{unit}</small>}</div>
    </div>
  );
}

function PitchKountFooter() {
  return (
    <footer className="pitchkount-footer">
      <img className="pitchkount-logo" src="/images/pitchkount-logo.png" alt="PitchKount" />
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
