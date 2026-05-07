'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PairPage() {
  const router = useRouter();
  const [pairingCode, setPairingCode] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [validatedDevice, setValidatedDevice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validatePairingCode = async () => {
    if (!pairingCode.trim() || pairingCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/pair/${pairingCode}`);
      const data = await res.json();

      if (!data.valid) {
        setError(data.error || 'Invalid pairing code');
        return;
      }

      setValidatedDevice({
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        expiresAt: data.expiresAt,
      });
      setStep('confirm');
    } catch (err) {
      setError('Failed to validate pairing code');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const confirmPairing = async () => {
    if (!validatedDevice) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/pair/${pairingCode}`, { method: 'POST' });

      if (!res.ok) throw new Error('Failed to pair device');
      
      router.push('/devices');
    } catch (err) {
      setError('Failed to complete pairing');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Pair New Device</h1>
        <p className="mt-1 text-sm text-white/50">Register a display using the code shown on the Pi</p>
      </div>

      <div className="max-w-xl">
        {error && (
          <div className="cc-card border-red-500/40 bg-red-500/10 p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Enter Code Section */}
        {step === 'enter' && (
          <div className="cc-card p-6">
            <h2 className="text-xl font-semibold mb-4">Enter Pairing Code</h2>
            <p className="text-gray-400 mb-6">
              Enter the 6-digit code displayed on the device you want to pair.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Pairing Code</label>
                <input
                  type="text"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full rounded px-3 py-2 text-2xl font-mono text-center tracking-widest"
                />
              </div>

              <button
                onClick={validatePairingCode}
                disabled={loading || pairingCode.length !== 6}
                className="cc-btn cc-btn-primary w-full py-3 disabled:opacity-50"
              >
                {loading ? 'Validating...' : 'Validate Code'}
              </button>
            </div>
          </div>
        )}

        {/* Confirm Pairing Section */}
        {step === 'confirm' && validatedDevice && (
          <div className="cc-card p-6">
            <h2 className="text-xl font-semibold mb-4">Confirm Pairing</h2>
            <p className="text-gray-400 mb-6">
              Ready to pair with device:
            </p>

            <div className="cc-card p-4 mb-6">
              <p className="font-medium text-lg">{validatedDevice.deviceName}</p>
              <p className="text-sm text-gray-400 font-mono">{validatedDevice.deviceId}</p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setStep('enter')}
                className="cc-btn cc-btn-secondary flex-1 py-3"
              >
                Cancel
              </button>
              <button
                onClick={confirmPairing}
                disabled={loading}
                className="cc-btn cc-btn-primary flex-1 py-3 disabled:opacity-50"
              >
                {loading ? 'Pairing...' : 'Confirm Pairing'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
