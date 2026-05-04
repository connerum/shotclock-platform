// Offline Mode - Offline indicator

export default function OfflineMode() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-8">
      <div className="text-center">
        <div className="text-6xl mb-8">
          <span className="text-red-500">⚠</span>
        </div>
        <h1 className="text-4xl font-bold text-red-500 mb-4">Offline Mode</h1>
        <p className="text-gray-400 mb-8">
          The display is currently offline. Please check your network connection.
        </p>
        <div className="bg-gray-900 rounded-lg p-6 inline-block">
          <p className="text-gray-500 text-sm">
            Attempting to reconnect...
          </p>
        </div>
      </div>
    </div>
  );
}
