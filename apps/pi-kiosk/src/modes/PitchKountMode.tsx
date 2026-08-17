import {
  normalizePitchKountState,
  type PitchKountState,
} from '@shotclock/shared/types';

export default function PitchKountMode({ pitchKount }: { pitchKount?: PitchKountState }) {
  const state = normalizePitchKountState(pitchKount);

  return (
    <div className="pitchkount-stage">
      <div className="pitchkount-board" data-testid="pitchkount-display">
        <div className="pitchkount-grid" aria-hidden="true" />
        <div className="pitchkount-glow pitchkount-glow-top" aria-hidden="true" />
        <div className="pitchkount-glow pitchkount-glow-bottom" aria-hidden="true" />

        <header className="pitchkount-header">
          <div className="pitchkount-team">{state.teamName}</div>
          <div className="pitchkount-wordmark"><span>PITCH</span><strong>KOUNT</strong></div>
        </header>

        <section className="pitchkount-pitcher">
          <div className="pitchkount-number">#{state.pitcherNumber}</div>
          <div className="pitchkount-pitcher-copy">
            <span>ON THE MOUND</span>
            <strong>{state.pitcherName}</strong>
          </div>
        </section>

        <section className="pitchkount-count-panel">
          <div className="pitchkount-panel-corners" aria-hidden="true" />
          <div className="pitchkount-label">PITCH COUNT</div>
          <div className="pitchkount-count">{state.pitchCount}</div>
        </section>

        <section className="pitchkount-live-row">
          <div className="pitchkount-live-card pitchkount-speed-card">
            <div className="pitchkount-label">PITCH SPEED</div>
            <div className="pitchkount-speed">
              <strong>{state.pitchSpeedMph}</strong>
              <span>MPH</span>
            </div>
          </div>
          <div className="pitchkount-live-card pitchkount-type-card">
            <div className="pitchkount-label">PITCH TYPE</div>
            <strong>{state.pitchType}</strong>
            <div className="pitchkount-seam" aria-hidden="true" />
          </div>
        </section>

        <section className="pitchkount-results">
          <div><span>STRIKES</span><strong>{state.strikes}</strong></div>
          <div className="pitchkount-result-divider" aria-hidden="true" />
          <div><span>BALLS</span><strong>{state.balls}</strong></div>
        </section>

        <section className="pitchkount-stats">
          <Stat label="ERA" value={state.era.toFixed(2)} />
          <Stat label="W–L" value={`${state.wins}–${state.losses}`} />
          <Stat label="IP" value={state.inningsPitched} />
          <Stat label="K" value={state.strikeouts} />
          <Stat label="BB" value={state.walks} />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="pitchkount-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
