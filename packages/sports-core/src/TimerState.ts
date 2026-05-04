// Timer State - shot clock and game clock management

import type { TimerMode, TimerState as TimerStateType } from '@shotclock/shared/types';

export interface TimerConfig {
  shotClockDuration: number;
  gameClockDuration: number;
  warningThreshold: number;
}

export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  shotClockDuration: 24,
  gameClockDuration: 720,
  warningThreshold: 5,
};

export class TimerState {
  private _mode: TimerMode;
  private _homeScore: number;
  private _awayScore: number;
  private _period: number;
  private _shotClock: number;
  private _gameClock: number;
  private _isRunning: boolean;
  private _isPaused: boolean;
  private _lastUpdated: number;
  private _config: TimerConfig;
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _onTick: ((state: TimerStateType) => void) | null = null;

  constructor(config: Partial<TimerConfig> = {}) {
    this._config = { ...DEFAULT_TIMER_CONFIG, ...config };
    this._mode = 'stop';
    this._homeScore = 0;
    this._awayScore = 0;
    this._period = 1;
    this._shotClock = this._config.shotClockDuration;
    this._gameClock = this._config.gameClockDuration;
    this._isRunning = false;
    this._isPaused = false;
    this._lastUpdated = Date.now();
  }

  get state(): TimerStateType {
    return {
      mode: this._mode,
      homeScore: this._homeScore,
      awayScore: this._awayScore,
      period: this._period,
      shotClock: this._shotClock,
      gameClock: this._gameClock,
      isRunning: this._isRunning,
      isPaused: this._isPaused,
      lastUpdated: this._lastUpdated,
    };
  }

  start(): void {
    if (this._mode === 'stop' || this._mode === 'pause') {
      this._mode = 'run';
      this._isRunning = true;
      this._isPaused = false;
      this._lastUpdated = Date.now();
      this._startInterval();
    }
  }

  pause(): void {
    if (this._isRunning) {
      this._mode = 'pause';
      this._isRunning = false;
      this._isPaused = true;
      this._lastUpdated = Date.now();
      this._stopInterval();
    }
  }

  resume(): void {
    if (this._isPaused) {
      this._mode = 'run';
      this._isRunning = true;
      this._isPaused = false;
      this._lastUpdated = Date.now();
      this._startInterval();
    }
  }

  reset(): void {
    this._stopInterval();
    this._mode = 'stop';
    this._shotClock = this._config.shotClockDuration;
    this._gameClock = this._config.gameClockDuration;
    this._isRunning = false;
    this._isPaused = false;
    this._lastUpdated = Date.now();
  }

  resetShotClock(): void {
    this._shotClock = this._config.shotClockDuration;
    this._lastUpdated = Date.now();
  }

  resetGameClock(): void {
    this._gameClock = this._config.gameClockDuration;
    this._lastUpdated = Date.now();
  }

  setScores(home: number, away: number): void {
    this._homeScore = home;
    this._awayScore = away;
    this._lastUpdated = Date.now();
  }

  setPeriod(period: number): void {
    this._period = period;
    this._lastUpdated = Date.now();
  }

  setHomeScore(score: number): void {
    this._homeScore = score;
    this._lastUpdated = Date.now();
  }

  setAwayScore(score: number): void {
    this._awayScore = score;
    this._lastUpdated = Date.now();
  }

  incrementHomeScore(amount: number = 1): void {
    this._homeScore += amount;
    this._lastUpdated = Date.now();
  }

  incrementAwayScore(amount: number = 1): void {
    this._awayScore += amount;
    this._lastUpdated = Date.now();
  }

  setShotClock(seconds: number): void {
    this._shotClock = Math.max(0, seconds);
    this._lastUpdated = Date.now();
  }

  setGameClock(seconds: number): void {
    this._gameClock = Math.max(0, seconds);
    this._lastUpdated = Date.now();
  }

  setOnTick(callback: (state: TimerStateType) => void): void {
    this._onTick = callback;
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
    // Decrement shot clock
    if (this._shotClock > 0) {
      this._shotClock = Math.max(0, this._shotClock - 1);
    }
    
    // Decrement game clock
    if (this._gameClock > 0) {
      this._gameClock = Math.max(0, this._gameClock - 1);
    }
    
    // Auto-stop if game clock reaches 0
    if (this._gameClock === 0 && this._config.gameClockDuration > 0) {
      this._mode = 'stop';
      this._isRunning = false;
      this._stopInterval();
    }
    
    this._lastUpdated = Date.now();
    
    if (this._onTick) {
      this._onTick(this.state);
    }
  }

  isWarning(): boolean {
    return this._shotClock <= this._config.warningThreshold && this._shotClock > 0;
  }

  isExpired(): boolean {
    return this._shotClock === 0 || this._gameClock === 0;
  }

  destroy(): void {
    this._stopInterval();
    this._onTick = null;
  }
}

export function createTimerState(config?: Partial<TimerConfig>): TimerState {
  return new TimerState(config);
}
