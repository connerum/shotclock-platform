import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getTwoPanelAdIndex,
  getTwoPanelOrder,
  normalizeTwoPanelAdPosition,
} from '../apps/pi-kiosk/src/components/two-panel-layout-behavior';

test('two-panel ad position defaults to the logical end edge', () => {
  assert.equal(normalizeTwoPanelAdPosition('start'), 'start');
  assert.equal(normalizeTwoPanelAdPosition('end'), 'end');
  assert.equal(normalizeTwoPanelAdPosition(undefined), 'end');
  assert.equal(normalizeTwoPanelAdPosition('invalid'), 'end');
  assert.deepEqual(getTwoPanelOrder('start'), ['ad', 'game']);
  assert.deepEqual(getTwoPanelOrder('end'), ['game', 'ad']);
  assert.deepEqual(getTwoPanelOrder(undefined), ['game', 'ad']);
});

test('two-panel reset sequence selects and wraps the active ad', () => {
  assert.equal(getTwoPanelAdIndex(0, 3), 0);
  assert.equal(getTwoPanelAdIndex(4, 3), 1);
  assert.equal(getTwoPanelAdIndex(9, 3), 0);
  assert.equal(getTwoPanelAdIndex(Number.NaN, 3), 0);
  assert.equal(getTwoPanelAdIndex(7, 0), 0);
});
