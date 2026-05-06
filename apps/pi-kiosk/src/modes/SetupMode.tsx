// Setup Mode - Shows setup AP SSID/password/portal URL

interface SetupModeProps {
  setupAp?: {
    apSsid: string;
    apPassword: string;
  };
}

export default function SetupMode({ setupAp }: SetupModeProps) {
  const setupInfo = {
    apSsid: setupAp?.apSsid || 'Shotclock-Setup',
    apPassword: setupAp?.apPassword || 'shotclock123',
    portalUrl: 'http://192.168.4.1:8080',
  };

  return (
    <div
      className="grid h-full w-full grid-rows-[18%_28%_24%_18%_12%] overflow-hidden bg-black px-2 py-1 text-center text-white"
      style={{ containerType: 'size' }}
    >
      <div className="flex min-h-0 items-center justify-center overflow-hidden font-bold uppercase leading-none text-green-500 text-[min(8cqw,11cqh)]">
        Setup
      </div>

      <div className="min-h-0 overflow-hidden">
        <div className="leading-none text-gray-500 text-[min(4.5cqw,6cqh)]">WiFi</div>
        <div className="mt-1 truncate font-mono font-bold leading-none text-green-400 text-[min(8cqw,11cqh)]">
          {setupInfo.apSsid}
        </div>
      </div>

      <div className="min-h-0 overflow-hidden">
        <div className="leading-none text-gray-500 text-[min(4.5cqw,6cqh)]">Password</div>
        <div className="mt-1 truncate font-mono font-bold leading-none text-yellow-400 text-[min(7cqw,10cqh)]">
          {setupInfo.apPassword}
        </div>
      </div>

      <div className="min-h-0 overflow-hidden">
        <div className="leading-none text-gray-500 text-[min(4.5cqw,6cqh)]">Open</div>
        <div className="mt-1 truncate font-mono font-bold leading-none text-blue-400 text-[min(5.8cqw,8cqh)]">
          {setupInfo.portalUrl}
        </div>
      </div>

      <div className="flex min-h-0 items-center justify-center overflow-hidden leading-none text-gray-400 text-[min(4cqw,5.8cqh)]">
        Configure network
      </div>
    </div>
  );
}
