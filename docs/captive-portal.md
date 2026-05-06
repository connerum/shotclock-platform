# Captive Portal Documentation

How the captive portal works for initial device setup.

## Overview

When a new Shotclock Pi boots for the first time (or is reset), it creates a local WiFi access point. Users connect to this network and use the captive portal to:

1. Configure WiFi credentials for the main network
2. Register the device with an organization
3. Complete initial setup

## Network Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Pi Device                                │
│                                                                 │
│   ┌──────────────┐         ┌──────────────────────────────────┐│
│   │  hostapd     │         │  Captive Portal Server           ││
│   │  (AP Mode)   │────────▶│  http://sportsboard.local        ││
│   │              │         │                                  ││
│   │  wlan0       │         │  - Setup status page            ││
│   │  192.168.4.1 │         │  - WiFi network selection        ││
│   └──────────────┘         │  - Setup completion              ││
│           │                └──────────────────────────────────┘│
│           │                           │                        │
│   ┌───────┴───────┐                   │                        │
│   │  dnsmasq      │                   │                        │
│   │  DHCP+DNS     │                   │                        │
│   │  192.168.4.0/24                   │                        │
│   └───────────────┘                   │                        │
│                                        │                        │
└───────────────────────────────────────┼────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │         Client Device                    │
                    │  (Phone/Tablet/Computer)                 │
                    │                                          │
                    │  Connects to Shotclock-Setup-xxxxxx      │
                    │  Opens http://sportsboard.local           │
                    │  (or captive portal detection)           │
                    └─────────────────────────────────────────┘
```

## Setup AP Configuration

The access point is configured with these defaults:

| Setting       | Default Value       |
|---------------|---------------------|
| SSID          | Shotclock-Setup-xxxxxx |
| Password      | shotclock123        |
| Channel       | 6                   |
| IP Address    | 192.168.4.1         |
| DHCP Range    | 192.168.4.10-100    |
| Portal URL    | http://sportsboard.local |
| Fallback URL  | http://192.168.4.1:8080 |

## Portal Pages

### 1. Setup Status (`/api/setup/status`)

Returns current setup state:
```json
{
  "state": {
    "step": "initial",
    "ssid": null,
    "password": null,
    "connectedDeviceIp": null
  }
}
```

### 2. WiFi Networks (`/api/wifi/networks`)

Lists available networks:
```json
{
  "networks": [
    {"ssid": "HomeNetwork", "signalStrength": 85, "security": "wpa2", "isSaved": false},
    {"ssid": "Office", "signalStrength": 60, "security": "wpa2", "isSaved": true}
  ]
}
```

### 3. WiFi Connect (`/api/wifi/connect`)

Connect to a network:
```json
// POST /api/wifi/connect
{"ssid": "HomeNetwork", "password": "mypassword"}

// Response
{"success": true, "ssid": "HomeNetwork"}
```

### 4. Setup Complete (`/api/setup/complete`)

Finalize setup:
```json
// POST /api/setup/complete
{"organizationId": "org-123", "venueId": "venue-456"}

// Response
{"success": true}
```

## State Machine

```
         ┌──────────┐
         │ initial  │◀─────────────────────────┐
         └────┬─────┘                          │
              │                                │
    ┌─────────▼─────────┐                      │
    │  ap_created       │                      │
    │ (device connected)│                      │
    └─────────┬─────────┘                      │
              │                                │
    ┌─────────▼─────────┐                     │
    │  network_selected  │────── Error ─────────┤
    │  (user picks WiFi)│                     │
    └─────────┬─────────┘                     │
              │                                │
    ┌─────────▼─────────┐                     │
    │  network_connected │                     │
    │ (WiFi connected)  │                     │
    └─────────┬─────────┘                     │
              │                                │
    ┌─────────▼─────────┐                     │
    │  complete          │─────────────────────┘
    │  (setup done)     │
    └───────────────────┘
```

## Captive Portal Detection

Modern devices detect captive portals automatically:

### Android
- Sends HTTP request to `clients3.google.com/generate_204`
- If redirected, shows notification

### iOS
- Requests `www.apple.com/library/test/success.html`
- If different content, shows "Sign in to network" alert

### Windows
- Checks `www.msftconnecttest.com/connecttest.txt`
- Shows prompt if redirected

### Manual Connection
If auto-detection fails:
1. Open browser
2. Navigate to `http://sportsboard.local`
3. Follow setup steps

Use `http://192.168.4.1:8080` if the client device does not resolve `.local` names.

## Security Considerations

### AP Security
- WPA2-PSK encryption
- Password should be changed in production
- Consider MAC filtering for physical security

### Portal Security
- Portal is local-only, not exposed to internet
- No authentication on setup portal
- Setup is one-time operation

### Post-Setup
- AP is stopped after successful setup
- Device connects to main WiFi network
- All further communication over main network

## Troubleshooting

### Portal doesn't load
1. Verify you're connected to the setup AP named like `Shotclock-Setup-xxxxxx`
2. Check if Pi is broadcasting the AP
3. Try accessing `http://192.168.4.1:8080` directly

### Can't see WiFi networks
1. Wait 30 seconds after connecting to AP
2. Click "Rescan" on the portal
3. Check if WiFi adapter is working

### Connected but no internet
This is expected - the AP doesn't provide internet access. The portal pages load locally.

### Setup doesn't complete
1. Check network credentials
2. Verify WiFi network is 2.4GHz (5GHz may not work)
3. Check signal strength
