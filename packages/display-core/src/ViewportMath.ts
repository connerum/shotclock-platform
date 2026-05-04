// Viewport Math - coordinate and transform calculations

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Calculate the x position within the viewport
 */
export function calculateX(x: number, viewportWidth: number, targetWidth: number): number {
  return x + (viewportWidth - targetWidth) / 2;
}

/**
 * Calculate the y position within the viewport
 */
export function calculateY(y: number, viewportHeight: number, targetHeight: number): number {
  return y + (viewportHeight - targetHeight) / 2;
}

/**
 * Calculate the width based on scale factor
 */
export function calculateWidth(baseWidth: number, scaleX: number): number {
  return baseWidth * scaleX;
}

/**
 * Calculate the height based on scale factor
 */
export function calculateHeight(baseHeight: number, scaleY: number): number {
  return baseHeight * scaleY;
}

/**
 * Calculate the scale factor for fitting content within a bounds
 */
export function calculateFitScale(
  contentWidth: number,
  contentHeight: number,
  boundsWidth: number,
  boundsHeight: number
): { scaleX: number; scaleY: number } {
  const scaleX = boundsWidth / contentWidth;
  const scaleY = boundsHeight / contentHeight;
  const scale = Math.min(scaleX, scaleY);
  return { scaleX: scale, scaleY: scale };
}

/**
 * Calculate the aspect ratio
 */
export function calculateAspectRatio(width: number, height: number): number {
  return width / height;
}

/**
 * Calculate viewport bounds after applying transform
 */
export function calculateViewportBounds(
  viewport: Rect,
  transform: Transform
): ViewportBounds {
  const cos = Math.cos((transform.rotation * Math.PI) / 180);
  const sin = Math.sin((transform.rotation * Math.PI) / 180);
  
  const corners: Point[] = [
    { x: viewport.x, y: viewport.y },
    { x: viewport.x + viewport.width, y: viewport.y },
    { x: viewport.x + viewport.width, y: viewport.y + viewport.height },
    { x: viewport.x, y: viewport.y + viewport.height },
  ];
  
  const transformedCorners = corners.map(corner => ({
    x: transform.x + corner.x * transform.scaleX * cos - corner.y * transform.scaleY * sin,
    y: transform.y + corner.x * transform.scaleX * sin + corner.y * transform.scaleY * cos,
  }));
  
  const xs = transformedCorners.map(c => c.x);
  const ys = transformedCorners.map(c => c.y);
  
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Calculate CSS transform string
 */
export function toCSSTransform(transform: Transform): string {
  return `translate(${transform.x}px, ${transform.y}px) scale(${transform.scaleX}, ${transform.scaleY}) rotate(${transform.rotation}deg)`;
}

/**
 * Calculate point within transformed viewport
 */
export function transformPoint(point: Point, transform: Transform): Point {
  const cos = Math.cos((transform.rotation * Math.PI) / 180);
  const sin = Math.sin((transform.rotation * Math.PI) / 180);
  
  return {
    x: transform.x + point.x * transform.scaleX * cos - point.y * transform.scaleY * sin,
    y: transform.y + point.x * transform.scaleX * sin + point.y * transform.scaleY * cos,
  };
}

/**
 * Check if a point is within a rect
 */
export function isPointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}
