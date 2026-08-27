import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deviceSupportsCapability,
  normalizeDeviceMode,
  normalizeSportDisplayLayout,
  reconcileSportDisplayLayoutPreference,
  runSerializedDevicePersistence,
} from '../apps/server-web/lib/device-command';

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
