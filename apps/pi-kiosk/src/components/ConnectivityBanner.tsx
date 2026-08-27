import type { DeviceConnectivityState } from '@shotclock/shared/types';

interface ConnectivityBannerProps {
  connectivity?: DeviceConnectivityState;
  setupAp?: {
    apSsid: string;
  };
  hidden?: boolean;
}

const STATUS_STYLES: Record<Exclude<DeviceConnectivityState['status'], 'online'>, string> = {
  offline: 'border-red-300 bg-red-700 text-white',
  setup: 'border-yellow-200 bg-yellow-500 text-black',
  reconnecting: 'border-blue-200 bg-blue-700 text-white',
};

export default function ConnectivityBanner({
  connectivity,
  setupAp,
  hidden = false,
}: ConnectivityBannerProps) {
  if (hidden || !connectivity || connectivity.status === 'online') return null;

  const title = connectivity.status === 'offline'
    ? 'OFFLINE'
    : connectivity.status === 'setup'
      ? 'NETWORK SETUP'
      : 'RECONNECTING';
  const detail = connectivity.status === 'setup'
    ? `JOIN ${setupAp?.apSsid || 'SHOTCLOCK-SETUP'}`
    : connectivity.status === 'offline'
      ? 'SHOWING SAVED CONTENT'
      : 'TRYING SAVED WIFI';

  return (
    <div
      role="status"
      aria-live="assertive"
      className="pointer-events-none absolute inset-x-0 top-0 z-50 p-[min(1.5cqh,1.5cqw)] font-mono"
      style={{ containerType: 'size' }}
    >
      <div
        className={`grid min-h-[min(16cqh,22cqw)] place-content-center border-[min(1cqh,1cqw)] px-2 text-center shadow-[0_0_18px_rgba(0,0,0,0.9)] ${STATUS_STYLES[connectivity.status]}`}
      >
        <div className="text-[min(8cqh,8cqw)] font-black leading-none tracking-wide">
          {title}
        </div>
        <div className="mt-[min(1cqh,1cqw)] truncate text-[min(4.5cqh,4.5cqw)] font-black uppercase leading-none">
          {detail}
        </div>
      </div>
    </div>
  );
}
