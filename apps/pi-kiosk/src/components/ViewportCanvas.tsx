// ViewportCanvas - Main canvas with CSS transform based on calibration

import { ReactNode } from 'react';
import { useDisplayProfile } from '../hooks/useDisplayProfile';

interface ViewportCanvasProps {
  displayProfile: ReturnType<typeof useDisplayProfile>;
  children: ReactNode;
}

export default function ViewportCanvas({ displayProfile, children }: ViewportCanvasProps) {
  const { cssVariables, transform, contentRotation, colorCorrectionEnabled } = displayProfile;

  return (
    <div
      className="w-full h-full overflow-hidden relative"
      style={{
        backgroundColor: cssVariables['--color-background'],
        ...cssVariables,
      }}
    >
      <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="rgb2bgr">
            <feColorMatrix
              type="matrix"
              values="
                0 0 1 0 0
                0 1 0 0 0
                1 0 0 0 0
                0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
      <div
        className="absolute left-0 top-0 overflow-hidden"
        style={{
          width: 'calc(var(--viewport-width) * 1px)',
          height: 'calc(var(--viewport-height) * 1px)',
          transform,
          transformOrigin: 'top left',
          filter: colorCorrectionEnabled ? 'url(#rgb2bgr)' : undefined,
        }}
      >
        <div
          className="h-full w-full"
          style={{
            transform: contentRotation ? `rotate(${contentRotation}deg)` : undefined,
            transformOrigin: 'center center',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
