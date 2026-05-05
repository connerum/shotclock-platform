// Media Mode - compact placeholder sized to the calibrated LED viewport.

export default function MediaMode() {
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden border-2 border-gray-800 bg-black p-2 text-white"
      style={{ containerType: 'size' }}
    >
      <div className="min-w-0 text-center font-mono leading-none">
        <div className="mb-1 text-[min(23cqh,18cqw)] font-black text-gray-300">MEDIA</div>
        <div className="text-[min(9cqh,7cqw)] font-bold uppercase tracking-normal text-gray-500">
          standby
        </div>
      </div>
    </div>
  );
}
