'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PairPage() {
  const router = useRouter();
  const [deviceName, setDeviceName] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [step, setStep] = useState<'generate' | 'enter' | 'confirm'>('enter');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [validatedDevice, setValidatedDevice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePairingCode = async () => {
    if (!deviceName.trim()) {
      setError('Please enter a device name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName,
          organizationId: 'default-org',
        }),
      });

      if (!res.ok) throw new Error('Failed to generate pairing code');
      
      const data = await res.json();
      setGeneratedCode(data.pairingCode);
      setStep('generate');
    } catch (err) {
      setError('Failed to generate pairing code');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
        {/* Tab Switcher */}
        <div className="cc-card mb-8 flex p-1">
          <button
            onClick={() => { setStep('generate'); setError(null); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              step === 'generate' ? 'cc-btn-primary' : 'text-gray-400 hover:text-white'
            }`}
          >
            Generate Code
          </button>
          <button
            onClick={() => { setStep('enter'); setError(null); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              step === 'enter' ? 'cc-btn-primary' : 'text-gray-400 hover:text-white'
            }`}
          >
            Enter Code
          </button>
        </div>

        {error && (
          <div className="cc-card border-red-500/40 bg-red-500/10 p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Generate Code Section */}
        {step === 'generate' && (
          <div className="cc-card p-6">
            <h2 className="text-xl font-semibold mb-4">Generate Pairing Code</h2>
            <p className="text-gray-400 mb-6">
              Optional: pre-register a device. For a physical Pi display, use the code shown on the display instead.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Device Name</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Shotclock Display"
                  className="w-full rounded px-3 py-2"
                />
              </div>

              <button
                onClick={generatePairingCode}
                disabled={loading}
                className="cc-btn cc-btn-primary w-full py-3 disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate Pairing Code'}
              </button>
            </div>

            {generatedCode && (
              <div className="mt-6 cc-card p-4 text-center">
                <p className="text-sm text-gray-400 mb-2">Pairing Code</p>
                <p className="text-4xl font-mono text-green-500 tracking-widest">{generatedCode}</p>
                <p className="text-xs text-gray-500 mt-2">Expires in 24 hours</p>
              </div>
            )}
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
