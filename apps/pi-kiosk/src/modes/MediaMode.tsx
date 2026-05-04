// Media Mode - Media placeholder

export default function MediaMode() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-8">
      <div className="text-center">
        <div className="text-6xl mb-8">🎬</div>
        <h1 className="text-4xl font-bold text-gray-400 mb-4">Media Mode</h1>
        <p className="text-gray-500">
          Media content will be displayed here.
        </p>
      </div>
    </div>
  );
}
