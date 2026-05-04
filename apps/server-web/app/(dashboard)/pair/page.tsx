// Pairing page

export default function PairPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Pair New Device</h1>

      <div className="max-w-xl">
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Device Pairing</h2>
          <p className="text-gray-400 mb-6">
            To pair a new device, generate a pairing code and enter it on the device.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Organization
              </label>
              <select className="w-full bg-gray-800 rounded px-3 py-2">
                <option>Demo Organization</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Venue</label>
              <select className="w-full bg-gray-800 rounded px-3 py-2">
                <option>Main Gym</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Device Name
              </label>
              <input
                type="text"
                placeholder="Shotclock Display"
                className="w-full bg-gray-800 rounded px-3 py-2"
              />
            </div>

            <button className="w-full bg-green-600 hover:bg-green-700 py-3 rounded font-medium">
              Generate Pairing Code
            </button>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Active Pairing Codes</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-800 rounded">
              <div>
                <p className="font-medium">Shotclock Display 1</p>
                <p className="text-sm text-gray-400">Main Gym</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-mono text-green-500">123456</p>
                <p className="text-xs text-gray-400">Expires in 23:45:12</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
