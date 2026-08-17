import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PITCHKOUNT_STATE,
  PITCHKOUNT_MAIN_SLIDE_DURATION_MS,
  PITCHKOUNT_STATS_SLIDE_DURATION_MS,
  normalizePitchKountState,
} from '../packages/shared/src/types/socket-events.ts';

test('PitchKount state is safe and bounded for the kiosk', () => {
  const state = normalizePitchKountState({
    pitcherName: '  Aiden   Thompson  ',
    pitcherNumber: '#1234',
    teamName: 'Legacy One Performance',
    headshotUrl: 'javascript:alert(1)',
    pitchCount: 5000,
    pitchSpeedMph: 999,
    showPitchSpeed: false,
    pitchType: 'Unknown Pitch',
    strikes: -10,
    balls: 34.6,
    era: 2.456,
    wins: 7,
    losses: 1,
    inningsPitched: '52.3',
    strikeouts: 68,
    walks: 12,
    whip: 120,
  });

  assert.equal(state.pitcherName, 'Aiden Thompson');
  assert.equal(state.pitcherNumber, '123');
  assert.equal(state.teamName, 'Legacy One Performan');
  assert.equal(state.pitchCount, 999);
  assert.equal(state.pitchSpeedMph, 120);
  assert.equal(state.showPitchSpeed, false);
  assert.equal(state.headshotUrl, undefined);
  assert.equal(state.pitchType, DEFAULT_PITCHKOUNT_STATE.pitchType);
  assert.equal(state.strikes, 0);
  assert.equal(state.balls, 35);
  assert.equal(state.era, 2.46);
  assert.equal(state.inningsPitched, '0.0');
  assert.equal(state.whip, 99.99);
});

test('PitchKount accepts baseball innings notation and known pitch types', () => {
  const state = normalizePitchKountState({
    inningsPitched: '52.2',
    pitchType: 'Curveball',
    whip: 1.234,
    headshotUrl: 'https://courtcast.example/media/devices/display/player.webp',
  });

  assert.equal(state.inningsPitched, '52.2');
  assert.equal(state.pitchType, 'Curveball');
  assert.equal(state.whip, 1.23);
  assert.equal(state.headshotUrl, 'https://courtcast.example/media/devices/display/player.webp');
  assert.equal(state.showPitchSpeed, true);
});

test('PitchKount uses a 45-second main slide and a 10-second stats slide', () => {
  assert.equal(PITCHKOUNT_MAIN_SLIDE_DURATION_MS, 45_000);
  assert.equal(PITCHKOUNT_STATS_SLIDE_DURATION_MS, 10_000);
});
