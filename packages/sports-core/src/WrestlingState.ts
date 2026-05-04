// Wrestling State - wrestling match state management

export type PeriodNumber = 1 | 2 | 3;
export type MatchPhase = 'pre-match' | 'active' | 'paused' | 'period-break' | 'sudden-victory' | 'post-match';

export interface WrestlingStateData {
  homeScore: number;
  awayScore: number;
  period: PeriodNumber;
  phase: MatchPhase;
  commandingTeam: 'home' | 'away' | 'none';
  isRunning: boolean;
  periodTimeRemaining: number;
  lastUpdated: number;
}

export interface WrestlingConfig {
  periodDuration: number;
  maxPeriods: number;
  overtimeDuration: number;
  warningThreshold: number;
}

export const DEFAULT_WRESTLING_CONFIG: WrestlingConfig = {
  periodDuration: 120,
  maxPeriods: 3,
  overtimeDuration: 30,
  warningThreshold: 10,
};

export class WrestlingMatch {
  private _homeScore: number;
  private _awayScore: number;
  private _period: PeriodNumber;
  private _phase: MatchPhase;
  private _commandingTeam: 'home' | 'away' | 'none';
  private _isRunning: boolean;
  private _periodTimeRemaining: number;
  private _config: WrestlingConfig;
  private _lastUpdated: number;
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _onTick: ((state: WrestlingStateData) => void) | null = null;

  constructor(config?: Partial<WrestlingConfig>) {
    this._config = { ...DEFAULT_WRESTLING_CONFIG, ...config };
    this._homeScore = 0;
    this._awayScore = 0;
    this._period = 1;
    this._phase = 'pre-match';
    this._commandingTeam = 'none';
    this._isRunning = false;
    this._periodTimeRemaining = this._config.periodDuration;
    this._lastUpdated = Date.now();
  }

  get state(): WrestlingStateData {
    return {
      homeScore: this._homeScore,
      awayScore: this._awayScore,
      period: this._period,
      phase: this._phase,
      commandingTeam: this._commandingTeam,
      isRunning: this._isRunning,
      periodTimeRemaining: this._periodTimeRemaining,
      lastUpdated: this._lastUpdated,
    };
  }

  start(): void {
    if (this._phase === 'pre-match' || this._phase === 'paused') {
      this._phase = 'active';
      this._isRunning = true;
      this._lastUpdated = Date.now();
      this._startInterval();
    }
  }

  pause(): void {
    if (this._phase === 'active') {
      this._phase = 'paused';
      this._isRunning = false;
      this._lastUpdated = Date.now();
      this._stopInterval();
    }
  }

  resume(): void {
    if (this._phase === 'paused') {
      this._phase = 'active';
      this._isRunning = true;
      this._lastUpdated = Date.now();
      this._startInterval();
    }
  }

  reset(): void {
    this._stopInterval();
    this._homeScore = 0;
    this._awayScore = 0;
    this._period = 1;
    this._phase = 'pre-match';
    this._commandingTeam = 'none';
    this._isRunning = false;
    this._periodTimeRemaining = this._config.periodDuration;
    this._lastUpdated = Date.now();
  }

  setScores(home: number, away: number): void {
    this._homeScore = home;
    this._awayScore = away;
    this._updateCommandingTeam();
    this._lastUpdated = Date.now();
  }

  incrementHomeScore(points: number): void {
    this._homeScore += points;
    this._updateCommandingTeam();
    this._lastUpdated = Date.now();
  }

  incrementAwayScore(points: number): void {
    this._awayScore += points;
    this._updateCommandingTeam();
    this._lastUpdated = Date.now();
  }

  setPeriod(period: PeriodNumber): void {
    this._period = period;
    this._periodTimeRemaining = this._config.periodDuration;
    this._lastUpdated = Date.now();
  }

  nextPeriod(): void {
    if (this._period < this._config.maxPeriods) {
      this._period = (this._period + 1) as PeriodNumber;
      this._periodTimeRemaining = this._config.periodDuration;
      this._phase = 'period-break';
      this._lastUpdated = Date.now();
      
      setTimeout(() => {
        if (this._phase === 'period-break') {
          this._phase = 'active';
          this._startInterval();
        }
      }, 30000); // 30 second break
    }
  }

  startSuddenVictory(): void {
    this._phase = 'sudden-victory';
    this._periodTimeRemaining = this._config.overtimeDuration;
    this._period = 0 as PeriodNumber;
    this._lastUpdated = Date.now();
    this._startInterval();
  }

  endMatch(): void {
    this._stopInterval();
    this._phase = 'post-match';
    this._isRunning = false;
    this._lastUpdated = Date.now();
  }

  setOnTick(callback: (state: WrestlingStateData) => void): void {
    this._onTick = callback;
  }

  private _updateCommandingTeam(): void {
    const pointDiff = Math.abs(this._homeScore - this._awayScore);
    if (pointDiff >= 10) {
      this._commandingTeam = this._homeScore > this._awayScore ? 'home' : 'away';
    } else {
      this._commandingTeam = 'none';
    }
  }

  private _startInterval(): void {
    if (this._intervalId !== null) return;
    
    this._intervalId = setInterval(() => {
      this._tick();
    }, 1000);
  }

  private _stopInterval(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  private _tick(): void {
    if (this._periodTimeRemaining > 0) {
      this._periodTimeRemaining -= 1;
    }
    
    if (this._periodTimeRemaining === 0) {
      if (this._phase === 'sudden-victory') {
        // Sudden victory ends match
        this.endMatch();
        return;
      } else if (this._period < this._config.maxPeriods) {
        this._phase = 'period-break';
        this._stopInterval();
      } else {
        this.endMatch();
        return;
      }
    }
    
    this._lastUpdated = Date.now();
    
    if (this._onTick) {
      this._onTick(this.state);
    }
  }

  isWarning(): boolean {
    return this._periodTimeRemaining <= this._config.warningThreshold && this._periodTimeRemaining > 0;
  }

  isOvertime(): boolean {
    return this._phase === 'sudden-victory';
  }

  getLeader(): 'home' | 'away' | 'tied' {
    if (this._homeScore > this._awayScore) return 'home';
    if (this._awayScore > this._homeScore) return 'away';
    return 'tied';
  }

  destroy(): void {
    this._stopInterval();
    this._onTick = null;
  }
}

export function createWrestlingMatch(config?: Partial<WrestlingConfig>): WrestlingMatch {
  return new WrestlingMatch(config);
}
