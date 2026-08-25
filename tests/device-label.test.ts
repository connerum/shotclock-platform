import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_DEVICE_LABEL_LENGTH,
  normalizeDeviceLabel,
  resolveAuthoritativeDeviceLabel,
} from '../apps/server-web/lib/device-label';

test('device labels are trimmed and repeated whitespace is collapsed', () => {
  assert.equal(normalizeDeviceLabel('  Main   Gym\nScoreboard  '), 'Main Gym Scoreboard');
});

test('device labels reject missing and overlong values', () => {
  assert.throws(() => normalizeDeviceLabel('   '), /required/);
  assert.throws(() => normalizeDeviceLabel('x'.repeat(MAX_DEVICE_LABEL_LENGTH + 1)), /characters or fewer/);
  assert.throws(() => normalizeDeviceLabel(null), /must be text/);
});

test('device labels support useful Unicode names', () => {
  assert.equal(normalizeDeviceLabel('Gimnasio José ⚾'), 'Gimnasio José ⚾');
});

test('paired account labels are not overwritten by a reconnecting Pi', () => {
  assert.equal(resolveAuthoritativeDeviceLabel('Shotclock Display 8679', 'Main Gym', true), 'Main Gym');
  assert.equal(resolveAuthoritativeDeviceLabel('Shotclock Display 8679', 'Main Gym', false), 'Shotclock Display 8679');
  assert.equal(resolveAuthoritativeDeviceLabel('Shotclock Display 8679', '', true), 'Shotclock Display 8679');
});
