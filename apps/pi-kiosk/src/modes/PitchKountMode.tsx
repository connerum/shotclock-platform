import { useEffect, useState, type CSSProperties } from 'react';
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
            <PlayerBanner playerName={state.pitcherName} playerNumber={state.pitcherNumber} />
            <section className="pitchkount-main-hero">
              <Headshot state={state} />
              <div className="pitchkount-count-stack">
                <div className="pitchkount-count-card">
                  <div className="pitchkount-label">PITCH COUNT</div>
                  <strong>{state.pitchCount}</strong>
                </div>
                <div className="pitchkount-remaining-card">
                  <div className="pitchkount-label">REMAINING</div>
                  <div>
                    <strong>{pitchesRemaining}</strong>
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
      <strong style={fitBannerText(teamName)}>{teamName}</strong>
    </header>
  );
}

function PlayerBanner({ playerName, playerNumber }: { playerName: string; playerNumber: string }) {
  const [firstName, ...remainingNames] = playerName.trim().split(/\s+/);
  const lastName = remainingNames.join(' ') || firstName;
  const nameStyle = fitStackedPlayerName(firstName, lastName);

  return (
    <header className="pitchkount-school-banner pitchkount-player-banner">
      <div className="pitchkount-player-number">
        <span>PLAYER</span>
        <strong>#{playerNumber}</strong>
      </div>
      <div className="pitchkount-player-name">
        <strong style={nameStyle}>{firstName}</strong>
        <strong style={nameStyle}>{lastName}</strong>
      </div>
    </header>
  );
}

function fitBannerText(text: string, maximumCqw = 11, widthFactor = 130): CSSProperties {
  const fontSize = Math.max(4.5, Math.min(maximumCqw, widthFactor / Math.max(text.length, 1)));
  return {
    fontSize: `${fontSize}cqw`,
    letterSpacing: text.length > 16 ? '0.015em' : text.length > 11 ? '0.04em' : undefined,
  };
}

function fitStackedPlayerName(firstName: string, lastName: string): CSSProperties {
  const longestLine = Math.max(firstName.length, lastName.length, 1);
  const fontSize = Math.max(4.2, Math.min(11, 88 / longestLine));
  return {
    fontSize: `${fontSize}cqw`,
    letterSpacing: longestLine > 12 ? '0.01em' : longestLine > 8 ? '0.035em' : '0.07em',
  };
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
