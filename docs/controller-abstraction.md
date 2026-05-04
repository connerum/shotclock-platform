# Controller Abstraction Documentation

How the display profile system enables controller-agnostic display configuration.

## Concept

Different game controllers (Xbox, PlayStation, custom) have different button layouts and capabilities. The controller abstraction layer allows a single display profile to work with any controller by mapping controller-specific inputs to generic display actions.

## Display Profile Structure

```typescript
interface DisplayProfile {
  id: string;
  name: string;
  controllerType: ControllerType;
  viewport: Viewport;
  safeZone: SafeZone;
  fontSize: FontSizeConfig;
  colors: ColorConfig;
}

type ControllerType = 
  | 'generic' 
  | 'xbox-controller' 
  | 'playstation-controller' 
  | 'custom';
```

## Viewport Math

The viewport defines the display area with transformation parameters:

```typescript
interface Viewport {
  x: number;           // X offset in pixels
  y: number;           // Y offset in pixels
  width: number;       // Base width (usually native resolution)
  height: number;      // Base height
  rotation: number;    // Rotation in degrees (0, 90, 180, 270)
  scaleX: number;       // Horizontal scale factor
  scaleY: number;      // Vertical scale factor
}
```

### Transform Calculation

The CSS transform is computed as:

```css
transform: translate(x, y) scale(scaleX, scaleY) rotate(rotationdeg);
```

### Calibration Application

Calibration data adjusts the viewport:

```typescript
function applyCalibration(base: Viewport, calibration: CalibrationData): Viewport {
  return {
    x: base.x + calibration.x,
    y: base.y + calibration.y,
    scaleX: base.scaleX * calibration.scaleX,
    scaleY: base.scaleY * calibration.scaleY,
    rotation: base.rotation + calibration.rotation
  };
}
```

## Safe Zones

Safe zones define margins to ensure content isn't cut off:

```typescript
interface SafeZone {
  top: number;      // Top margin in pixels
  right: number;   // Right margin in pixels
  bottom: number;  // Bottom margin in pixels
  left: number;    // Left margin in pixels
}
```

### Safe Zone Calculation

```typescript
function calculateSafeZone(viewport: Viewport, safeZone: SafeZone): {
  visibleArea: Rect;
  percentageVisible: number;
} {
  const scale = viewport.scaleX; // Assuming uniform scale
  const visibleWidth = viewport.width - (safeZone.left + safeZone.right) * scale;
  const visibleHeight = viewport.height - (safeZone.top + safeZone.bottom) * scale;
  
  return {
    visibleArea: {
      x: viewport.x + safeZone.left * scale,
      y: viewport.y + safeZone.top * scale,
      width: visibleWidth,
      height: visibleHeight
    },
    percentageVisible: (visibleWidth * visibleHeight) / (viewport.width * viewport.height) * 100
  };
}
```

## Default Controller Profiles

### Generic Controller
- Basic button mappings
- Standard LED configuration
- Universal compatibility

### Xbox Controller
- Xbox button icons
- Green accent color (#107c10)
- Xbox-specific rumble patterns

### PlayStation Controller
- PS button icons
- Blue accent color (#003791)
- DualSense haptic support

### Custom Controller
- User-defined button layout
- Custom colors and fonts
- Fully configurable

## Button Mappings

Each controller type maps physical buttons to display actions:

| Action | Generic | Xbox | PlayStation |
|--------|---------|------|-------------|
| Start/Stop Timer | Button 0 | A | X |
| Pause Timer | Button 1 | B | Circle |
| Reset Shot Clock | Button 2 | X | Square |
| Reset Game Clock | Button 3 | Y | Triangle |
| Home Score + | DPad Up | DPad Up | DPad Up |
| Home Score - | DPad Down | DPad Down | DPad Down |
| Away Score + | DPad Left | DPad Left | DPad Left |
| Away Score - | DPad Right | DPad Right | DPad Right |
| Next Period | Left Bumper | LB | L1 |
| Previous Period | Right Bumper | RB | R1 |
| Mode Toggle | Start | Menu | Options |
| Calibration | Select | View | Touchpad |

## Calibration Process

### 1. Enter Calibration Mode

From dashboard or local API:
```bash
curl -X POST http://localhost:3001/local/state \
  -H "Content-Type: application/json" \
  -d '{"mode": {"type": "calibration"}}'
```

### 2. Display Test Pattern

The kiosk displays a grid pattern with corner markers.

### 3. Capture Corner Points

The calibration UI prompts touching each corner:
- Top-left
- Top-right
- Bottom-left
- Bottom-right

### 4. Calculate Transform

```typescript
function createCalibrationFromCorners(
  topLeft: Point,
  topRight: Point,
  bottomLeft: Point,
  bottomRight: Point,
  expectedWidth: number,
  expectedHeight: number
): CalibrationData {
  const measuredWidth = distance(topLeft, topRight);
  const measuredHeight = distance(topLeft, bottomLeft);
  
  return {
    x: topLeft.x,
    y: topLeft.y,
    scaleX: expectedWidth / measuredWidth,
    scaleY: expectedHeight / measuredHeight,
    rotation: calculateRotation(topLeft, topRight),
    timestamp: Date.now()
  };
}
```

### 5. Apply and Save

```bash
curl -X POST http://localhost:3001/local/config \
  -H "Content-Type: application/json" \
  -d '{"calibrationData": {...}}'
```

## Font Size Configuration

Font sizes are specified in the display profile:

```typescript
interface FontSizeConfig {
  shotClock: number;  // Shot clock digits
  gameClock: number;  // Game clock digits
  score: number;      // Team scores
  period: number;      // Period indicator
  label: number;      // Labels (HOME, AWAY, etc.)
}
```

These sizes are applied as CSS variables:
```css
--font-shot-clock: 200px;
--font-game-clock: 120px;
--font-score: 150px;
--font-period: 80px;
--font-label: 40px;
```

## Color Configuration

Colors are defined in the profile and applied as CSS variables:

```typescript
interface ColorConfig {
  background: string;     // Main background (#000000)
  foreground: string;    // Primary text (#ffffff)
  accent: string;         // Accent color (#00ff00)
  homeTeam: string;       // Home team color (#ff0000)
  awayTeam: string;       // Away team color (#0000ff)
  warning: string;        // Warning state (#ffff00)
  danger: string;         // Danger/expired (#ff0000)
}
```

Applied as:
```css
--color-background: #000000;
--color-foreground: #ffffff;
--color-accent: #00ff00;
--color-home-team: #ff0000;
--color-away-team: #0000ff;
--color-warning: #ffff00;
--color-danger: #ff0000;
```

## Profile Inheritance

Custom profiles can inherit from base profiles:

```typescript
function createCustomProfile(base: DisplayProfile, overrides: Partial<DisplayProfile>): DisplayProfile {
  return {
    ...base,
    ...overrides,
    controllerType: 'custom',
    id: `custom-${Date.now()}`
  };
}
```

## Display Profile API

### Get Profile

```bash
GET /api/devices/{deviceId}/config
```

### Update Profile

```bash
PATCH /api/devices/{deviceId}/config
{
  "displayProfile": {
    "fontSize": {
      "shotClock": 250
    }
  }
}
```

### Reset to Default

```bash
POST /api/devices/{deviceId}/config/reset
```
