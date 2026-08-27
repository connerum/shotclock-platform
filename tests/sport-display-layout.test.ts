import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deviceSupportsCapability,
  normalizeDeviceMode,
  normalizeSportDisplayLayout,
  reconcileSportDisplayLayoutPreference,
  resolvePrimaryResetMetadata,
  runSerializedDeviceCommand,
  runSerializedDeviceCommands,
  runSerializedDevicePersistence,
  sportDisplayLayoutUsesAdvancedBehavior,
  stripPrimaryResetMetadata,
} from '../apps/server-web/lib/device-command';
import { createDefaultTimerState, normalizeTimerState } from '../packages/shared/src/timer/index';
import { getThreePanelAdIndices } from '../apps/pi-kiosk/src/components/three-panel-ad-behavior';

test('three-panel sport layouts retain visual ads and clamp rotation timing', () => {
  const mode = normalizeDeviceMode({
    type: 'basketball',
    subMode: 'scoreboard',
    scoreboardBranding: { enabled: true, homeLabel: 'Home' },
    sportDisplayLayout: {
      type: 'three-panel',
      rotationIntervalMs: 250,
      adPlaylist: [
        { mediaUrl: ' https://cdn.example.test/ad-one.png ', mediaMimeType: 'image/png' },
        { mediaUrl: 'https://cdn.example.test/ad-two.mp4', mediaMimeType: 'video/mp4' },
      ],
    },
  });

  assert.equal(mode?.type, 'basketball');
  assert.equal(mode?.subMode, 'scoreboard');
  assert.deepEqual(mode?.scoreboardBranding, { enabled: true, homeLabel: 'Home' });
  assert.deepEqual(mode?.sportDisplayLayout, {
    type: 'three-panel',
    rotationIntervalMs: 1000,
    adPlaylist: [
      { mediaUrl: 'https://cdn.example.test/ad-one.png', mediaMimeType: 'image/png' },
      { mediaUrl: 'https://cdn.example.test/ad-two.mp4', mediaMimeType: 'video/mp4' },
    ],
  });
});

test('three-panel sport layouts filter unsafe and non-visual media', () => {
  const layout = normalizeSportDisplayLayout({
    type: 'three-panel',
    rotationIntervalMs: 90_000,
    adPlaylist: [
      { mediaUrl: 'http://media.example.test/ad.webp', mediaMimeType: 'image/webp' },
      { mediaUrl: 'javascript:alert(1)', mediaMimeType: 'image/png' },
      { mediaUrl: 'data:image/png;base64,AAAA', mediaMimeType: 'image/png' },
      { mediaUrl: '/media/devices/board/local-only.png', mediaMimeType: 'image/png' },
      { mediaUrl: 'https://media.example.test/jingle.mp3', mediaMimeType: 'audio/mpeg' },
      { mediaUrl: '', mediaMimeType: 'video/mp4' },
    ],
  });

  assert.deepEqual(layout, {
    type: 'three-panel',
    rotationIntervalMs: 60_000,
    adPlaylist: [
      { mediaUrl: 'http://media.example.test/ad.webp', mediaMimeType: 'image/webp' },
    ],
  });
});

test('three-panel sport layout playlists are capped and invalid timing is omitted', () => {
  const adPlaylist = Array.from({ length: 55 }, (_, index) => ({
    mediaUrl: `https://cdn.example.test/ad-${index}.png`,
    mediaMimeType: 'image/png',
  }));

  const layout = normalizeSportDisplayLayout({
    type: 'three-panel',
    rotationIntervalMs: Number.NaN,
    adPlaylist,
  });

  assert.equal(layout?.adPlaylist.length, 50);
  assert.equal(layout?.rotationIntervalMs, undefined);
});

test('layout is accepted only for basketball, wrestling, and volleyball', () => {
  const sportDisplayLayout = {
    type: 'three-panel',
    adPlaylist: [{ mediaUrl: 'https://cdn.example.test/ad.png', mediaMimeType: 'image/png' }],
  };

  for (const type of ['basketball', 'wrestling', 'volleyball'] as const) {
    assert.deepEqual(normalizeDeviceMode({ type, sportDisplayLayout })?.sportDisplayLayout, sportDisplayLayout);
  }

  for (const type of ['practice-board', 'pitchkount', 'setup', 'blank'] as const) {
    assert.equal(normalizeDeviceMode({ type, sportDisplayLayout })?.sportDisplayLayout, undefined);
  }
});

test('legacy sport modes remain valid without a display layout', () => {
  assert.deepEqual(normalizeDeviceMode({ type: 'wrestling', subMode: 'match' }), {
    type: 'wrestling',
    subMode: 'match',
  });
  assert.equal(normalizeSportDisplayLayout({ type: 'side-by-side', adPlaylist: [] }), null);
});

test('display capabilities are parsed defensively for rollout gating', () => {
  assert.equal(deviceSupportsCapability('["timer","three-panel-sports-ads"]', 'three-panel-sports-ads'), true);
  assert.equal(deviceSupportsCapability(['timer'], 'three-panel-sports-ads'), false);
  assert.equal(deviceSupportsCapability('{bad json', 'three-panel-sports-ads'), false);
});

test('display-state persistence is serialized per device', async () => {
  let releaseFirst: (() => void) | undefined;
  const firstCanFinish = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const order: string[] = [];

  const first = runSerializedDevicePersistence('board-one', async () => {
    order.push('first:start');
    await firstCanFinish;
    order.push('first:end');
  });
  const second = runSerializedDevicePersistence('board-one', async () => {
    order.push('second:start');
    order.push('second:end');
  });

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ['first:start']);

  releaseFirst?.();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start', 'second:end']);
});

test('overlapping synchronized command groups serialize every target device', async () => {
  let releaseFirst: (() => void) | undefined;
  let markFirstStarted: (() => void) | undefined;
  const firstCanFinish = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const firstStarted = new Promise<void>((resolve) => {
    markFirstStarted = resolve;
  });
  const order: string[] = [];

  const firstGroup = runSerializedDeviceCommands(['board-b', 'board-a'], async () => {
    order.push('first:start');
    markFirstStarted?.();
    await firstCanFinish;
    order.push('first:end');
  });
  await firstStarted;

  const overlappingGroup = runSerializedDeviceCommands(['board-c', 'board-b'], async () => {
    order.push('overlap:start');
    order.push('overlap:end');
  });
  const directCommand = runSerializedDeviceCommand('board-c', async () => {
    order.push('direct:c');
  });
  const unrelatedCommand = runSerializedDeviceCommand('board-d', async () => {
    order.push('unrelated:d');
  });

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ['first:start', 'unrelated:d']);

  releaseFirst?.();
  await Promise.all([firstGroup, overlappingGroup, directCommand, unrelatedCommand]);
  assert.deepEqual(order, [
    'first:start',
    'unrelated:d',
    'first:end',
    'overlap:start',
    'overlap:end',
    'direct:c',
  ]);
});

test('saved ad reconciliation also updates an enabled active sport mode', () => {
  const previousLayout = {
    type: 'three-panel' as const,
    adPlaylist: [{ mediaUrl: 'https://cdn.example.test/deleted.png', mediaMimeType: 'image/png' }],
  };
  const nextLayout = {
    type: 'three-panel' as const,
    adPlaylist: [{ mediaUrl: 'https://cdn.example.test/current.png', mediaMimeType: 'image/png' }],
  };
  const reconciled = reconcileSportDisplayLayoutPreference({
    mode: 'basketball',
    deviceMode: {
      type: 'basketball',
      subMode: 'scoreboard',
      sportDisplayLayout: previousLayout,
    },
    presentationOverlay: { type: 'sponsor' },
  }, nextLayout);

  assert.deepEqual(reconciled, {
    mode: 'basketball',
    deviceMode: {
      type: 'basketball',
      subMode: 'scoreboard',
      sportDisplayLayout: nextLayout,
    },
    presentationOverlay: { type: 'sponsor' },
    sportDisplayLayoutPreference: nextLayout,
  });

  const cleared = reconcileSportDisplayLayoutPreference(reconciled, null);
  assert.deepEqual(cleared.deviceMode, { type: 'basketball', subMode: 'scoreboard' });
  assert.equal(cleared.sportDisplayLayoutPreference, null);
});

test('three-panel ad behaviors are normalized and advanced modes are capability-gated', () => {
  const mirrored = normalizeSportDisplayLayout({
    type: 'three-panel',
    adMode: 'mirrored-timed',
    adPlaylist: [],
  });
  const resetDriven = normalizeSportDisplayLayout({
    type: 'three-panel',
    adMode: 'offset-on-timer-reset',
    adPlaylist: [],
  });
  const invalid = normalizeSportDisplayLayout({
    type: 'three-panel',
    adMode: 'unknown-mode',
    adPlaylist: [],
  });

  assert.equal(mirrored?.adMode, 'mirrored-timed');
  assert.equal(resetDriven?.adMode, 'offset-on-timer-reset');
  assert.equal(invalid?.adMode, undefined);
  assert.equal(sportDisplayLayoutUsesAdvancedBehavior(mirrored ?? undefined), true);
  assert.equal(sportDisplayLayoutUsesAdvancedBehavior(resetDriven ?? undefined), true);
  assert.equal(sportDisplayLayoutUsesAdvancedBehavior(invalid ?? undefined), false);
});

test('three-panel indices support offset, mirrored, and reset-driven behavior', () => {
  assert.deepEqual(getThreePanelAdIndices({
    adMode: 'offset-timed',
    playlistLength: 4,
    timedCursor: 1,
  }), { firstIndex: 1, secondIndex: 2 });
  assert.deepEqual(getThreePanelAdIndices({
    adMode: 'mirrored-timed',
    playlistLength: 4,
    timedCursor: 1,
  }), { firstIndex: 1, secondIndex: 1 });
  assert.deepEqual(getThreePanelAdIndices({
    adMode: 'offset-on-timer-reset',
    playlistLength: 2,
    timedCursor: 99,
    primaryResetSequence: 0,
  }), { firstIndex: 0, secondIndex: 1 });
  assert.deepEqual(getThreePanelAdIndices({
    adMode: 'offset-on-timer-reset',
    playlistLength: 2,
    timedCursor: 99,
    primaryResetSequence: 1,
  }), { firstIndex: 1, secondIndex: 0 });
  assert.deepEqual(getThreePanelAdIndices({
    adMode: 'offset-on-timer-reset',
    playlistLength: 3,
    timedCursor: 0,
    primaryResetSequence: 4,
  }), { firstIndex: 1, secondIndex: 2 });
  assert.deepEqual(getThreePanelAdIndices({
    adMode: 'mirrored-timed',
    playlistLength: 1,
    timedCursor: 20,
  }), { firstIndex: 0, secondIndex: 0 });
});

test('primary reset events advance once and duplicate event IDs are idempotent', () => {
  const cachedState = { primaryResetSequence: 4, primaryResetEventId: 'reset-a' };
  const relationState = { primaryResetSequence: 3, primaryResetEventId: 'reset-before-a' };

  assert.deepEqual(resolvePrimaryResetMetadata(
    { primaryResetSequence: 2 },
    cachedState,
    relationState,
    { kind: 'primary-clock-reset', eventId: 'reset-b' }
  ), {
    primaryResetSequence: 5,
    primaryResetEventId: 'reset-b',
  });
  assert.deepEqual(resolvePrimaryResetMetadata(
    { primaryResetSequence: 2 },
    cachedState,
    relationState,
    { kind: 'primary-clock-reset', eventId: 'reset-a' }
  ), {
    primaryResetSequence: 4,
    primaryResetEventId: 'reset-a',
  });
  assert.deepEqual(resolvePrimaryResetMetadata(
    { primaryResetSequence: 2 },
    cachedState,
    relationState
  ), {
    primaryResetSequence: 4,
    primaryResetEventId: 'reset-a',
  });
});

test('synchronized resets advance from each target persisted sequence', () => {
  const incomingState = stripPrimaryResetMetadata({
    ...createDefaultTimerState(123),
    primaryResetSequence: 50,
    primaryResetEventId: 'primary-previous-reset',
  });
  const resetAction = { kind: 'primary-clock-reset' as const, eventId: 'shared-sync-reset' };

  assert.equal(incomingState.primaryResetSequence, undefined);
  assert.equal(incomingState.primaryResetEventId, undefined);
  assert.deepEqual(resolvePrimaryResetMetadata(
    incomingState,
    { primaryResetSequence: 2, primaryResetEventId: 'board-a-previous-reset' },
    null,
    resetAction
  ), {
    primaryResetSequence: 3,
    primaryResetEventId: 'shared-sync-reset',
  });
  assert.deepEqual(resolvePrimaryResetMetadata(
    incomingState,
    { primaryResetSequence: 10, primaryResetEventId: 'board-b-previous-reset' },
    null,
    resetAction
  ), {
    primaryResetSequence: 11,
    primaryResetEventId: 'shared-sync-reset',
  });
  assert.deepEqual(resolvePrimaryResetMetadata(
    incomingState,
    { primaryResetSequence: 11, primaryResetEventId: 'shared-sync-reset' },
    null,
    resetAction
  ), {
    primaryResetSequence: 11,
    primaryResetEventId: 'shared-sync-reset',
  });
});

test('timer normalization preserves bounded reset metadata', () => {
  const normalized = normalizeTimerState({
    mode: 'pause',
    homeScore: 0,
    awayScore: 0,
    shotClock: 35,
    gameClock: 720,
    isRunning: false,
    isPaused: true,
    lastUpdated: 123,
    primaryResetSequence: 7.9,
    primaryResetEventId: ' reset-event ',
  });

  assert.equal(normalized.primaryResetSequence, 7);
  assert.equal(normalized.primaryResetEventId, 'reset-event');
});
