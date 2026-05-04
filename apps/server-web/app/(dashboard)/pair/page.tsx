'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PairPage() {
  const router = useRouter();
  const [deviceName, setDeviceName] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [step, setStep] = useState<'generate' | 'enter' | 'confirm'>('generate');
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
      // Update device status to paired
      const res = await fetch(`/api/devices/${validatedDevice.deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'online',
          organizationId: 'default-org',
        }),
      });

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
      <h1 className="text-3xl font-bold mb-8">Pair New Device</h1>

      <div className="max-w-xl">
        {/* Tab Switcher */}
        <div className="flex mb-8 bg-gray-900 rounded-lg p-1">
          <button
            onClick={() => { setStep('generate'); setError(null); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              step === 'generate' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Generate Code
          </button>
          <button
            onClick={() => { setStep('enter'); setError(null); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              step === 'enter' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Enter Code
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Generate Code Section */}
        {step === 'generate' && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Generate Pairing Code</h2>
            <p className="text-gray-400 mb-6">
              Enter a name for your device, then share the generated code with the device to pair it.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Device Name</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Shotclock Display"
                  className="w-full bg-gray-800 rounded px-3 py-2"
                />
              </div>

              <button
                onClick={generatePairingCode}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 py-3 rounded font-medium disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate Pairing Code'}
              </button>
            </div>

            {generatedCode && (
              <div className="mt-6 p-4 bg-gray-800 rounded-lg text-center">
                <p className="text-sm text-gray-400 mb-2">Pairing Code</p>
                <p className="text-4xl font-mono text-green-500 tracking-widest">{generatedCode}</p>
                <p className="text-xs text-gray-500 mt-2">Expires in 24 hours</p>
              </div>
            )}
          </div>
        )}

        {/* Enter Code Section */}
        {step === 'enter' && (
          <div className="bg-gray-900 rounded-lg p-6">
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
                  className="w-full bg-gray-800 rounded px-3 py-2 text-2xl font-mono text-center tracking-widest"
                />
              </div>

              <button
                onClick={validatePairingCode}
                disabled={loading || pairingCode.length !== 6}
                className="w-full bg-green-600 hover:bg-green-700 py-3 rounded font-medium disabled:opacity-50"
              >
                {loading ? 'Validating...' : 'Validate Code'}
              </button>
            </div>
          </div>
        )}

        {/* Confirm Pairing Section */}
        {step === 'confirm' && validatedDevice && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Confirm Pairing</h2>
            <p className="text-gray-400 mb-6">
              Ready to pair with device:
            </p>

            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <p className="font-medium text-lg">{validatedDevice.deviceName}</p>
              <p className="text-sm text-gray-400 font-mono">{validatedDevice.deviceId}</p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setStep('enter')}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmPairing}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 py-3 rounded font-medium disabled:opacity-50"
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
