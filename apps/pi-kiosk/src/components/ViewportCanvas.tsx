// ViewportCanvas - Main canvas with CSS transform based on calibration

import { CSSProperties, ReactNode } from 'react';
import { useDisplayProfile } from '../hooks/useDisplayProfile';

interface ViewportCanvasProps {
  displayProfile: ReturnType<typeof useDisplayProfile>;
  children: ReactNode;
}

const viewportWidth = 'calc(var(--viewport-width) * 1px)';
const viewportHeight = 'calc(var(--viewport-height) * 1px)';

function normalizeRotation(rotation: number) {
  return ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
}

/**
 * Quarter turns swap the content's logical dimensions. The compensating
 * translation keeps the rotated result anchored at the viewport's top-left
 * instead of letting CSS rotate it around the center and clip the long edge.
 */
export function getRotatedContentStyle(rotation: number): CSSProperties {
  switch (normalizeRotation(rotation)) {
    case 90:
      return {
        width: viewportHeight,
        height: viewportWidth,
        transform: `translate(${viewportWidth}, 0) rotate(90deg)`,
        transformOrigin: 'top left',
      };
    case 180:
      return {
        width: viewportWidth,
        height: viewportHeight,
        transform: `translate(${viewportWidth}, ${viewportHeight}) rotate(180deg)`,
        transformOrigin: 'top left',
      };
    case 270:
      return {
        width: viewportHeight,
        height: viewportWidth,
        transform: `translate(0, ${viewportHeight}) rotate(270deg)`,
        transformOrigin: 'top left',
      };
    default:
      return {
        width: viewportWidth,
        height: viewportHeight,
      };
  }
}

export default function ViewportCanvas({ displayProfile, children }: ViewportCanvasProps) {
  const { cssVariables, transform, contentRotation, colorCorrectionEnabled } = displayProfile;
  const rotatedContentStyle = getRotatedContentStyle(contentRotation);

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
          width: viewportWidth,
          height: viewportHeight,
          transform,
          transformOrigin: 'top left',
          filter: colorCorrectionEnabled ? 'url(#rgb2bgr)' : undefined,
        }}
      >
        <div
          className="absolute left-0 top-0"
          data-content-rotation={normalizeRotation(contentRotation)}
          style={rotatedContentStyle}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
