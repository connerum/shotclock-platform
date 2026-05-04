// Scoreboard State - score tracking for various sports

export type SportType = 'basketball' | 'volleyball' | 'wrestling';

export interface ScoreboardStateData {
  homeScore: number;
  awayScore: number;
  homeSets?: number;
  awaySets?: number;
  period: number;
  isRunning: boolean;
  sport: SportType;
  lastUpdated: number;
}

export interface ScoreboardConfig {
  sport: SportType;
  maxPeriods: number;
  setsToWin: number;
  pointsPerSet: number;
}

export const DEFAULT_BASKETBALL_CONFIG: ScoreboardConfig = {
  sport: 'basketball',
  maxPeriods: 4,
  setsToWin: 0,
  pointsPerSet: 0,
};

export const DEFAULT_VOLLEYBALL_CONFIG: ScoreboardConfig = {
  sport: 'volleyball',
  maxPeriods: 5,
  setsToWin: 3,
  pointsPerSet: 25,
};

export class Scoreboard {
  private _homeScore: number;
  private _awayScore: number;
  private _homeSets: number;
  private _awaySets: number;
  private _period: number;
  private _isRunning: boolean;
  private _sport: SportType;
  private _config: ScoreboardConfig;
  private _lastUpdated: number;

  constructor(config?: Partial<ScoreboardConfig>) {
    const sport = config?.sport || 'basketball';
    this._config = this._getDefaultConfig(sport, config);
    this._sport = sport;
    this._homeScore = 0;
    this._awayScore = 0;
    this._homeSets = 0;
    this._awaySets = 0;
    this._period = 1;
    this._isRunning = false;
    this._lastUpdated = Date.now();
  }

  private _getDefaultConfig(sport: SportType, overrides?: Partial<ScoreboardConfig>): ScoreboardConfig {
    switch (sport) {
      case 'basketball':
        return { ...DEFAULT_BASKETBALL_CONFIG, ...overrides };
      case 'volleyball':
        return { ...DEFAULT_VOLLEYBALL_CONFIG, ...overrides };
      default:
        return { ...DEFAULT_BASKETBALL_CONFIG, ...overrides };
    }
  }

  get state(): ScoreboardStateData {
    return {
      homeScore: this._homeScore,
      awayScore: this._awayScore,
      homeSets: this._sport === 'volleyball' ? this._homeSets : undefined,
      awaySets: this._sport === 'volleyball' ? this._awaySets : undefined,
      period: this._period,
      isRunning: this._isRunning,
      sport: this._sport,
      lastUpdated: this._lastUpdated,
    };
  }

  incrementHomeScore(amount: number = 1): void {
    this._homeScore += amount;
    this._lastUpdated = Date.now();
  }

  incrementAwayScore(amount: number = 1): void {
    this._awayScore += amount;
    this._lastUpdated = Date.now();
  }

  decrementHomeScore(amount: number = 1): void {
    this._homeScore = Math.max(0, this._homeScore - amount);
    this._lastUpdated = Date.now();
  }

  decrementAwayScore(amount: number = 1): void {
    this._awayScore = Math.max(0, this._awayScore - amount);
    this._lastUpdated = Date.now();
  }

  setScores(home: number, away: number): void {
    this._homeScore = home;
    this._awayScore = away;
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

  incrementHomeSet(): void {
    if (this._sport === 'volleyball') {
      this._homeSets += 1;
      this._lastUpdated = Date.now();
    }
  }

  incrementAwaySet(): void {
    if (this._sport === 'volleyball') {
      this._awaySets += 1;
      this._lastUpdated = Date.now();
    }
  }

  setPeriod(period: number): void {
    this._period = period;
    this._lastUpdated = Date.now();
  }

  nextPeriod(): void {
    if (this._period < this._config.maxPeriods) {
      this._period += 1;
      this._lastUpdated = Date.now();
    }
  }

  previousPeriod(): void {
    if (this._period > 1) {
      this._period -= 1;
      this._lastUpdated = Date.now();
    }
  }

  start(): void {
    this._isRunning = true;
    this._lastUpdated = Date.now();
  }

  stop(): void {
    this._isRunning = false;
    this._lastUpdated = Date.now();
  }

  reset(): void {
    this._homeScore = 0;
    this._awayScore = 0;
    this._homeSets = 0;
    this._awaySets = 0;
    this._period = 1;
    this._isRunning = false;
    this._lastUpdated = Date.now();
  }

  isWinning(side: 'home' | 'away'): boolean {
    return side === 'home' ? this._homeScore > this._awayScore : this._awayScore > this._homeScore;
  }

  isTied(): boolean {
    return this._homeScore === this._awayScore;
  }

  getLeader(): 'home' | 'away' | 'tied' {
    if (this._homeScore > this._awayScore) return 'home';
    if (this._awayScore > this._homeScore) return 'away';
    return 'tied';
  }
}

export function createScoreboard(sport: SportType = 'basketball'): Scoreboard {
  return new Scoreboard({ sport });
}
