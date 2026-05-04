// ViewportCanvas - Main canvas with CSS transform based on calibration

import { ReactNode } from 'react';
import type { DisplayProfile } from '@shotclock/shared/types';
import { useDisplayProfile } from '../hooks/useDisplayProfile';

interface ViewportCanvasProps {
  displayProfile: ReturnType<typeof useDisplayProfile>;
  children: ReactNode;
}

export default function ViewportCanvas({ displayProfile, children }: ViewportCanvasProps) {
  const { cssVariables, transform } = displayProfile;

  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{
        backgroundColor: cssVariables['--color-background'],
        ...cssVariables,
      }}
    >
      <div
        className="w-full h-full"
        style={{
          transform,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
