// Calibration Helper - display calibration and safe zone calculations

import type { CalibrationData, SafeZone } from '@shotclock/shared/types';
import type { Transform, Rect } from './ViewportMath.js';

export interface CalibrationOptions {
  cornerPoints?: boolean;
  edgeAlignment?: boolean;
  centerPoint?: boolean;
}

export interface CalibrationResult {
  calibration: CalibrationData;
  isValid: boolean;
  error?: string;
}

export interface SafeZoneResult {
  safeZone: SafeZone;
  visibleArea: Rect;
  totalArea: Rect;
  percentageVisible: number;
}

/**
 * Apply calibration data to a transform
 */
export function applyCalibration(
  baseTransform: Transform,
  calibration: CalibrationData
): Transform {
  return {
    x: baseTransform.x + calibration.x,
    y: baseTransform.y + calibration.y,
    scaleX: baseTransform.scaleX * calibration.scaleX,
    scaleY: baseTransform.scaleY * calibration.scaleY,
    rotation: baseTransform.rotation + calibration.rotation,
  };
}

/**
 * Reset calibration to identity
 */
export function resetCalibration(): CalibrationData {
  return {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    timestamp: Date.now(),
  };
}

/**
 * Calculate safe zone based on display profile and calibration
 */
export function calculateSafeZone(
  viewport: Rect,
  safeZone: SafeZone,
  calibration?: CalibrationData
): SafeZoneResult {
  const effectiveSafeZone = safeZone;
  
  // Apply calibration scale to safe zone
  const scaleFactor = calibration ? calibration.scaleX : 1;
  
  const visibleArea: Rect = {
    x: viewport.x + effectiveSafeZone.left * scaleFactor,
    y: viewport.y + effectiveSafeZone.top * scaleFactor,
    width: viewport.width - (effectiveSafeZone.left + effectiveSafeZone.right) * scaleFactor,
    height: viewport.height - (effectiveSafeZone.top + effectiveSafeZone.bottom) * scaleFactor,
  };
  
  const totalArea = viewport;
  const percentageVisible = (visibleArea.width * visibleArea.height) / (totalArea.width * totalArea.height) * 100;
  
  return {
    safeZone: effectiveSafeZone,
    visibleArea,
    totalArea,
    percentageVisible,
  };
}

/**
 * Create calibration data from corner points
 */
export function createCalibrationFromCorners(
  topLeft: { x: number; y: number },
  topRight: { x: number; y: number },
  bottomLeft: { x: number; y: number },
  _bottomRight: { x: number; y: number },
  expectedWidth: number,
  expectedHeight: number
): CalibrationResult {
  // Calculate measured width and height
  const measuredWidth = topRight.x - topLeft.x;
  const measuredHeight = bottomLeft.y - topLeft.y;
  
  // Calculate scale factors
  const scaleX = expectedWidth / measuredWidth;
  const scaleY = expectedHeight / measuredHeight;
  
  // Calculate offset (translation needed)
  const x = topLeft.x;
  const y = topLeft.y;
  
  // Calculate rotation (simplified - just detect if display is rotated 90 degrees)
  let rotation = 0;
  const aspectRatio = measuredWidth / measuredHeight;
  const expectedAspect = expectedWidth / expectedHeight;
  
  if (Math.abs(aspectRatio - 1 / expectedAspect) < 0.1) {
    rotation = 90;
  }
  
  const calibration: CalibrationData = {
    x,
    y,
    scaleX,
    scaleY,
    rotation,
    timestamp: Date.now(),
  };
  
  // Validate calibration
  const isValid = scaleX > 0.1 && scaleX < 10 && scaleY > 0.1 && scaleY < 10;
  
  return {
    calibration,
    isValid,
    error: isValid ? undefined : 'Calibration values out of reasonable range',
  };
}

/**
 * Validate calibration data
 */
export function validateCalibration(calibration: CalibrationData): CalibrationResult {
  const isValidScale = calibration.scaleX > 0.01 && calibration.scaleX < 100 &&
                       calibration.scaleY > 0.01 && calibration.scaleY < 100;
  
  const isValidRotation = calibration.rotation >= -180 && calibration.rotation <= 180;
  
  const isValidTimestamp = calibration.timestamp > 0 && calibration.timestamp <= Date.now();
  
  const isValid = isValidScale && isValidRotation && isValidTimestamp;
  
  return {
    calibration,
    isValid,
    error: !isValid ? 'Invalid calibration data' : undefined,
  };
}

/**
 * Merge two calibration data sets (for incremental calibration)
 */
export function mergeCalibration(base: CalibrationData, overlay: CalibrationData): CalibrationData {
  return {
    x: base.x + overlay.x,
    y: base.y + overlay.y,
    scaleX: base.scaleX * overlay.scaleX,
    scaleY: base.scaleY * overlay.scaleY,
    rotation: base.rotation + overlay.rotation,
    timestamp: Date.now(),
  };
}

/**
 * Convert calibration to CSS transform string
 */
export function calibrationToCSSTransform(calibration: CalibrationData): string {
  return `translate(${calibration.x}px, ${calibration.y}px) scale(${calibration.scaleX}, ${calibration.scaleY}) rotate(${calibration.rotation}deg)`;
}
