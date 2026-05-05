// ViewportCanvas - Main canvas with CSS transform based on calibration

import { ReactNode } from 'react';
import { useDisplayProfile } from '../hooks/useDisplayProfile';

interface ViewportCanvasProps {
  displayProfile: ReturnType<typeof useDisplayProfile>;
  children: ReactNode;
}

export default function ViewportCanvas({ displayProfile, children }: ViewportCanvasProps) {
  const { cssVariables, transform } = displayProfile;

  return (
    <div
      className="w-full h-full overflow-hidden relative"
      style={{
        backgroundColor: cssVariables['--color-background'],
        ...cssVariables,
      }}
    >
      <div
        className="absolute left-0 top-0 overflow-hidden"
        style={{
          width: 'calc(var(--viewport-width) * 1px)',
          height: 'calc(var(--viewport-height) * 1px)',
          transform,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
