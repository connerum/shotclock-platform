// Calibration Mode - passive test pattern sized by the active viewport.

export default function CalibrationMode() {
  return (
    <div className="relative h-full w-full overflow-hidden border-8 border-white bg-black">
      <div className="absolute inset-0 opacity-40">
        {[...Array(11)].map((_, index) => (
          <div
            key={`v-${index}`}
            className="absolute top-0 h-full border-l-2 border-white"
            style={{ left: `${index * 10}%` }}
          />
        ))}
        {[...Array(11)].map((_, index) => (
          <div
            key={`h-${index}`}
            className="absolute left-0 w-full border-t-2 border-white"
            style={{ top: `${index * 10}%` }}
          />
        ))}
      </div>

      <div className="absolute left-1/2 top-0 h-full border-l-4 border-green-400" />
      <div className="absolute left-0 top-1/2 w-full border-t-4 border-green-400" />

      <div className="absolute left-6 top-6 h-16 w-16 border-l-8 border-t-8 border-red-500" />
      <div className="absolute right-6 top-6 h-16 w-16 border-r-8 border-t-8 border-red-500" />
      <div className="absolute bottom-6 left-6 h-16 w-16 border-b-8 border-l-8 border-red-500" />
      <div className="absolute bottom-6 right-6 h-16 w-16 border-b-8 border-r-8 border-red-500" />
    </div>
  );
}
