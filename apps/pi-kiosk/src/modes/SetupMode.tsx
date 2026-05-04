// Setup Mode - Shows setup AP SSID/password/portal URL

export default function SetupMode() {
  const setupInfo = {
    apSsid: 'Shotclock-Setup',
    apPassword: 'shotclock123',
    portalUrl: 'http://192.168.4.1:8080',
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold text-green-500 mb-8">Setup Mode</h1>
        
        <div className="bg-gray-900 rounded-lg p-8 mb-8">
          <p className="text-gray-400 mb-6">
            Connect to the setup WiFi network to configure your Shotclock display.
          </p>
          
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Network Name (SSID)</p>
              <p className="text-4xl font-mono text-green-400">{setupInfo.apSsid}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Password</p>
              <p className="text-4xl font-mono text-yellow-400">{setupInfo.apPassword}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Setup Portal</p>
              <p className="text-2xl font-mono text-blue-400">{setupInfo.portalUrl}</p>
            </div>
          </div>
        </div>
        
        <div className="text-gray-500 text-sm">
          <p>1. Connect to "{setupInfo.apSsid}" WiFi network</p>
          <p>2. Open {setupInfo.portalUrl} in your browser</p>
          <p>3. Follow the setup instructions</p>
        </div>
      </div>
    </div>
  );
}
