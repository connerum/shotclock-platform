# Raspberry Pi Network And Offline Debugging

Use this runbook when a display stays powered on but the kiosk flips into `Offline Mode`, disconnects from WiFi, or repeatedly loses the CourtCast server connection.

The kiosk shows `Offline Mode` when the Pi agent saves `mode: offline`. In the current agent, that commonly happens after the Socket.IO server connection is down for about 60 seconds. The root cause can be WiFi association loss, DHCP loss, DNS failure, server reachability, or Socket.IO disconnects while WiFi still has an IP.

## Cold Boot Reconnect Race

Use this section when a paired display powers on into setup mode even though its saved venue WiFi profile is valid.

The confirmed failure pattern looks like this in the logs:

```text
Mode: online
Device is paired but WiFi is not connected - entering setup mode
Entering WiFi setup mode: paired device has no WiFi connection
Setup AP started: Shotclock2-Setup-b4cd01
```

NetworkManager may then show that it had already started reconnecting to the saved profile, but the agent started setup AP mode first:

```text
policy: auto-activating connection 'shotclock-Trap3'
Activation: (wifi) connection 'shotclock-Trap3' has security, and secrets exist. No new secrets needed.
device (wlan0): supplicant interface state: inactive -> associating
device (wlan0): state change: config -> deactivating (reason 'user-requested')
device (wlan0): state change: disconnected -> unmanaged
```

This means the WiFi credentials are valid, but `shotclock-agent` checked before WiFi association and DHCP completed. Starting setup AP mode then disconnects `wlan0` and marks it unmanaged, preventing NetworkManager from finishing the reconnect.

### Easiest Pi-Local Mitigation

Add a longer startup delay to `shotclock-agent` so NetworkManager can reconnect before the agent checks WiFi status:

```bash
sudo mkdir -p /etc/systemd/system/shotclock-agent.service.d

sudo tee /etc/systemd/system/shotclock-agent.service.d/wifi-boot-delay.conf >/dev/null <<'EOF'
[Service]
ExecStartPre=
ExecStartPre=/bin/sleep 45
EOF

sudo systemctl daemon-reload
sudo systemctl restart shotclock-agent
```

Verify the override:

```bash
systemctl cat shotclock-agent
```

Expected override block:

```ini
# /etc/systemd/system/shotclock-agent.service.d/wifi-boot-delay.conf
[Service]
ExecStartPre=
ExecStartPre=/bin/sleep 45
```

Test with a full cold power cycle:

```bash
sudo shutdown -h now
```

Remove panel power for at least 10 seconds, then restore power.

After boot, SSH in and check:

```bash
journalctl -b -u shotclock-agent --no-pager -l | grep -E 'Mode:|Device is paired|WiFi|setup mode|connecting to server|Connected to server'
nmcli dev status
curl -fsS http://127.0.0.1:3001/local/status | jq .
```

Good signs:

```text
Mode: online
Device is paired - connecting to server...
Connected to server
wlan0  wifi  connected  shotclock-Trap3
```

If 45 seconds is not enough, increase it to 75 seconds:

```bash
sudo sed -i 's|/bin/sleep 45|/bin/sleep 75|' /etc/systemd/system/shotclock-agent.service.d/wifi-boot-delay.conf
sudo systemctl daemon-reload
sudo systemctl restart shotclock-agent
```

If the Pi has stale venue profiles, remove only the profiles it should not use:

```bash
nmcli con show
sudo nmcli connection delete shotclock-Trap2
```

Do this only when the display should never connect to that stale network. The primary fix is the startup delay; stale profiles are a cleanup item unless NetworkManager is choosing the wrong SSID.

## Quick Low-Power Mitigations

Use these when the Pi is embedded inside an LED panel and powered from a stepped-up battery or panel rail. These changes reduce boot/runtime spikes and improve WiFi stability, but they do not replace a stable 5V supply at the Pi pins.

Snapshot the current state:

```bash
sudo rpi-eeprom-config | grep -E '^(PSU_MAX_CURRENT|POWER_OFF_ON_HALT|WAIT_FOR_POWER_BUTTON|BOOT_ORDER)=' || true
vcgencmd get_config usb_max_current_enable || true
vcgencmd get_throttled || true
vcgencmd measure_temp || true
iw dev wlan0 get power_save || true
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor || true
```

Apply the Pi 5 embedded-power EEPROM settings through the repo installer. Only keep `PSU_MAX_CURRENT=5000` if the embedded 5V supply and wiring can safely provide that current at the Pi under load.

```bash
cd ~/shotclock-platform
git pull --ff-only

grep -q '^PI5_PSU_MAX_CURRENT=' /opt/shotclock/shared/.env \
  && sudo sed -i 's/^PI5_PSU_MAX_CURRENT=.*/PI5_PSU_MAX_CURRENT=5000/' /opt/shotclock/shared/.env \
  || echo 'PI5_PSU_MAX_CURRENT=5000' | sudo tee -a /opt/shotclock/shared/.env

grep -q '^PI5_AUTO_BOOT_ON_POWER=' /opt/shotclock/shared/.env \
  && sudo sed -i 's/^PI5_AUTO_BOOT_ON_POWER=.*/PI5_AUTO_BOOT_ON_POWER=true/' /opt/shotclock/shared/.env \
  || echo 'PI5_AUTO_BOOT_ON_POWER=true' | sudo tee -a /opt/shotclock/shared/.env

sudo ./scripts/install-pi.sh
sudo rpi-eeprom-config | grep -E '^(PSU_MAX_CURRENT|POWER_OFF_ON_HALT|WAIT_FOR_POWER_BUTTON)='
```

After first applying the EEPROM settings, hard power-cycle the panel:

```bash
sudo shutdown -h now
```

Remove panel power for at least 10 seconds, then restore it.

Smooth boot and underclock the Pi 5:

```bash
sudo cp /boot/firmware/config.txt /boot/firmware/config.txt.before-power-mitigation
sudo cp /boot/firmware/cmdline.txt /boot/firmware/cmdline.txt.before-power-mitigation

sudo sed -i -E 's/(^| )splash( |$)/ /g; s/  +/ /g' /boot/firmware/cmdline.txt

sudo tee -a /boot/firmware/config.txt >/dev/null <<'EOF'

# Shotclock embedded power mitigation
[pi5]
initial_turbo=0
arm_freq=1500
dtoverlay=disable-bt

[all]
disable_splash=1
EOF

sudo systemctl disable --now bluetooth hciuart 2>/dev/null || true
```

`arm_freq=1500` is conservative. If the kiosk is stable but feels sluggish, test `arm_freq=1800`.

Force the CPU governor to `powersave`:

```bash
for governor in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
  echo powersave | sudo tee "$governor" >/dev/null
done

sudo tee /etc/systemd/system/shotclock-cpu-powersave.service >/dev/null <<'EOF'
[Unit]
Description=Shotclock CPU powersave governor
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'for governor in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do echo powersave > "$governor"; done'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now shotclock-cpu-powersave.service
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
```

Disable WiFi power save:

```bash
sudo tee /etc/NetworkManager/conf.d/wifi-powersave-off.conf >/dev/null <<'EOF'
[connection]
wifi.powersave = 2
EOF

sudo iw dev wlan0 set power_save off || true
sudo systemctl restart NetworkManager
iw dev wlan0 get power_save || true
```

Delay the agent and kiosk startup so Chromium and Node do not start during the highest boot current spike:

```bash
sudo mkdir -p /etc/systemd/system/shotclock-agent.service.d
sudo tee /etc/systemd/system/shotclock-agent.service.d/power-delay.conf >/dev/null <<'EOF'
[Service]
ExecStartPre=
ExecStartPre=/bin/sleep 20
RestartSec=20
EOF

sudo mkdir -p /etc/systemd/system/shotclock-kiosk.service.d
sudo tee /etc/systemd/system/shotclock-kiosk.service.d/power-delay.conf >/dev/null <<'EOF'
[Service]
ExecStartPre=/bin/sleep 15
RestartSec=20
EOF

sudo systemctl daemon-reload
sudo systemctl restart shotclock-agent shotclock-kiosk
```

If the LED processor accepts it, test a lower HDMI mode:

```bash
sudo sed -i 's/^KIOSK_DISPLAY_MODE=.*/KIOSK_DISPLAY_MODE=800x600/' /opt/shotclock/shared/.env
sudo sed -i 's/^KIOSK_DISPLAY_RATE=.*/KIOSK_DISPLAY_RATE=60/' /opt/shotclock/shared/.env
sudo systemctl restart shotclock-kiosk
```

Revert to the field-tested NovaStar MSD300-1 default if needed:

```bash
sudo sed -i 's/^KIOSK_DISPLAY_MODE=.*/KIOSK_DISPLAY_MODE=1024x768/' /opt/shotclock/shared/.env
sudo sed -i 's/^KIOSK_DISPLAY_RATE=.*/KIOSK_DISPLAY_RATE=60/' /opt/shotclock/shared/.env
sudo systemctl restart shotclock-kiosk
```

Validate after reboot:

```bash
sudo reboot
```

Then:

```bash
vcgencmd get_config arm_freq
vcgencmd get_config initial_turbo
iw dev wlan0 get power_save || true
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
vcgencmd get_throttled
systemctl status shotclock-agent shotclock-kiosk --no-pager
```

Expected low-power settings include `initial_turbo=0`, `Power save: off`, and `throttled=0x0`.

Rollback boot smoothing:

```bash
sudo cp /boot/firmware/config.txt.before-power-mitigation /boot/firmware/config.txt
sudo cp /boot/firmware/cmdline.txt.before-power-mitigation /boot/firmware/cmdline.txt
sudo systemctl disable --now shotclock-cpu-powersave.service
sudo rm -f /etc/systemd/system/shotclock-cpu-powersave.service
sudo systemctl daemon-reload
sudo reboot
```

## Quick Capture

Install the small tools used by the capture script:

```bash
sudo apt update
sudo apt install -y jq moreutils
```

Start a combined debug capture:

```bash
mkdir -p ~/shotclock-debug

sudo bash -c '
RUN_USER="${SUDO_USER:-admin}"
RUN_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
LOG_DIR="${RUN_HOME:-/home/admin}/shotclock-debug"
mkdir -p "$LOG_DIR"
chown "$RUN_USER:$RUN_USER" "$LOG_DIR" 2>/dev/null || true
LOG="$LOG_DIR/network-debug-$(date +%Y%m%d-%H%M%S).log"

echo "Logging to $LOG"

{
  echo "===== BOOT ====="
  date
  uname -a
  echo

  echo "===== EEPROM / THROTTLE ====="
  rpi-eeprom-config 2>/dev/null | grep -E "^(PSU_MAX_CURRENT|POWER_OFF_ON_HALT|WAIT_FOR_POWER_BUTTON)=" || true
  vcgencmd get_throttled || true
  vcgencmd measure_temp || true
  echo

  echo "===== NETWORKMANAGER CONNECTIONS ====="
  nmcli dev status || true
  nmcli con show || true
  echo

  echo "===== WIFI POWERSAVE ====="
  iw dev wlan0 get power_save || true
  echo
} | tee -a "$LOG"

(
  journalctl -f \
    -u shotclock-agent \
    -u shotclock-kiosk \
    -u NetworkManager \
    -u wpa_supplicant \
    --no-pager
) | ts "[%Y-%m-%d %H:%M:%S]" | tee -a "$LOG" &

(
  dmesg -Tw | grep --line-buffered -iE "under-voltage|voltage|thrott|wlan|brcm|cfg80211|rfkill|mmc|usb"
) | ts "[%Y-%m-%d %H:%M:%S]" | tee -a "$LOG" &

(
  nmcli monitor
) | ts "[%Y-%m-%d %H:%M:%S]" | tee -a "$LOG" &

(
  while true; do
    echo "----- poll $(date --iso-8601=seconds) -----"
    vcgencmd get_throttled || true
    iw dev wlan0 link || true
    iw dev wlan0 get power_save || true
    nmcli -f GENERAL.STATE,GENERAL.CONNECTION,IP4.ADDRESS,WIFI-PROPERTIES.POWERSAVE dev show wlan0 || true
    curl -fsS http://127.0.0.1:3001/local/status | jq . || true
    ping -c 3 -W 2 courtcast.safety-linq.com || true
    sleep 10
  done
) | ts "[%Y-%m-%d %H:%M:%S]" | tee -a "$LOG"
'
```

Leave this running until the kiosk enters `Offline Mode` or the WiFi drops. Stop it with `Ctrl+C`.

The log is written under:

```text
~/shotclock-debug/
```

## Verbose Socket Logs

Enable Socket.IO client debug logging when WiFi appears stable but the device still goes offline:

```bash
sudo mkdir -p /etc/systemd/system/shotclock-agent.service.d

sudo tee /etc/systemd/system/shotclock-agent.service.d/debug.conf >/dev/null <<'EOF'
[Service]
Environment=DEBUG=socket.io-client:*,engine.io-client:*
EOF

sudo systemctl daemon-reload
sudo systemctl restart shotclock-agent
journalctl -u shotclock-agent -f
```

Turn it back off after collecting logs:

```bash
sudo rm -f /etc/systemd/system/shotclock-agent.service.d/debug.conf
sudo systemctl daemon-reload
sudo systemctl restart shotclock-agent
```

## Verbose NetworkManager Logs

Enable detailed WiFi, device, IPv4, and DHCP logs:

```bash
sudo nmcli general logging level DEBUG domains WIFI,DEVICE,IP4,DHCP4
sudo systemctl restart NetworkManager
```

Turn logging back down:

```bash
sudo nmcli general logging level INFO domains DEFAULT
```

## Confirm WiFi Power Save Is Off

Power save can cause unstable links in some embedded installs:

```bash
iw dev wlan0 get power_save
```

Expected:

```text
Power save: off
```

If it is on, disable it:

```bash
sudo tee /etc/NetworkManager/conf.d/wifi-powersave-off.conf >/dev/null <<'EOF'
[connection]
wifi.powersave = 2
EOF

sudo iw dev wlan0 set power_save off || true
sudo systemctl restart NetworkManager
```

## Read The Results

Use these signals to classify the failure:

- `vcgencmd get_throttled` is not `throttled=0x0`: the Pi has recorded undervoltage, frequency capping, throttling, or soft temperature limiting.
- `iw dev wlan0 link` says `Not connected`: the WiFi association is dropping.
- `nmcli monitor` shows disconnect/reconnect events: NetworkManager is losing association, DHCP, or carrier.
- `/local/status` shows `"isOnline": false` while WiFi still has an IP: the issue is likely DNS, server reachability, TLS, or Socket.IO rather than WiFi association.
- Agent logs say `Server is disconnected, but WiFi is still connected`: WiFi stayed up, but the server socket did not recover within the timeout.
- Agent logs say `WiFi is disconnected or missing an IP`: the Pi lost WiFi or DHCP.

## Useful One-Off Commands

```bash
systemctl status shotclock-agent shotclock-kiosk NetworkManager --no-pager
journalctl -u shotclock-agent -n 120 --no-pager -l
journalctl -u NetworkManager -n 120 --no-pager -l
nmcli dev status
nmcli dev show wlan0
nmcli con show --active
iw dev wlan0 link
iw dev wlan0 get power_save
vcgencmd get_throttled
curl -fsS http://127.0.0.1:3001/local/status | jq .
ping -c 5 courtcast.safety-linq.com
```

## Notes

Do not run local builds on power-constrained embedded Pi units while debugging WiFi stability. Build artifacts on a Mac or server and deploy a tarball instead; see [low-power-pi-tarball-update.md](./low-power-pi-tarball-update.md).

For the fuller embedded-power checklist and production test procedure, see [pi-embedded-power-smoothing.md](./pi-embedded-power-smoothing.md).

If the log shows undervoltage or repeated WiFi driver resets, software mitigation may not be enough. Recheck voltage at the Pi 5V and GND pins under load, shorten/thicken the 5V wiring, and verify the boost converter can handle Pi startup and WiFi transmit current spikes.
