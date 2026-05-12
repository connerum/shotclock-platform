# Raspberry Pi 5 Embedded Power Smoothing

This note covers the optional power-smoothing test for Raspberry Pi 5 units embedded inside an LED panel and powered from the panel power rail instead of an official USB-C Power Delivery supply.

The goal is to reduce startup and runtime current spikes without changing the CourtCast agent, kiosk, Socket.IO connection, WiFi setup portal, media playback, or WebUI control behavior.

## What Is Already Required

The production Pi installer already applies the important Pi 5 embedded-power EEPROM settings:

```bash
PSU_MAX_CURRENT=5000
POWER_OFF_ON_HALT=0
WAIT_FOR_POWER_BUTTON=0
```

`PSU_MAX_CURRENT=5000` is the official Raspberry Pi 5 bootloader setting for bypassing USB Power Delivery negotiation when the supply can safely provide 5A. `POWER_OFF_ON_HALT=0` and `WAIT_FOR_POWER_BUTTON=0` keep the board from intentionally waiting for the physical power button after panel power is restored.

Verify them with:

```bash
sudo rpi-eeprom-config | grep -E '^(PSU_MAX_CURRENT|POWER_OFF_ON_HALT|WAIT_FOR_POWER_BUTTON|BOOT_ORDER)='
vcgencmd get_config usb_max_current_enable
```

Only keep `PSU_MAX_CURRENT=5000` if the embedded 5V supply and wiring can safely provide 5A at the Pi under load.

## Recommended Test Changes

These are the low-risk changes to test first.

### Snapshot Current State

Run this before changing anything:

```bash
sudo rpi-eeprom-config | grep -E '^(PSU_MAX_CURRENT|POWER_OFF_ON_HALT|WAIT_FOR_POWER_BUTTON|BOOT_ORDER)='
vcgencmd get_config usb_max_current_enable
vcgencmd get_throttled
vcgencmd measure_temp
iw dev wlan0 get power_save || true
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
```

### Apply Boot Smoothing

```bash
sudo cp /boot/firmware/config.txt /boot/firmware/config.txt.before-courtcast-power-test
sudo cp /boot/firmware/cmdline.txt /boot/firmware/cmdline.txt.before-courtcast-power-test

sudo sed -i -E 's/(^| )splash( |$)/ /g; s/  +/ /g' /boot/firmware/cmdline.txt

sudo tee -a /boot/firmware/config.txt >/dev/null <<'EOF'

# CourtCast embedded Pi 5 power smoothing test
[pi5]
initial_turbo=0
arm_freq=1800
dtoverlay=disable-bt

[all]
EOF
```

What these do:

- `initial_turbo=0` disables the newer boot-time turbo boost window.
- `arm_freq=1800` caps the Pi 5 CPU at 1.8GHz, which is still plenty for the kiosk and Socket.IO agent.
- `dtoverlay=disable-bt` disables Bluetooth so the shared radio is not maintaining Bluetooth service.
- Removing `splash` avoids rendering the boot splash during the vulnerable boot period.

### Disable WiFi Power Save

Use Raspberry Pi's supported persistent setting:

```bash
sudo raspi-config
```

Navigate to:

```text
6 Advanced Options > A13 WLAN Power Save > No
```

This should not break CourtCast. It can improve WiFi stability, but it may slightly increase steady-state power draw.

### Optional Runtime CPU Governor Test

For a one-time runtime test:

```bash
echo powersave | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor >/dev/null
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
```

This is not persistent by itself. If it helps and you want it to survive reboot, create a systemd service:

```bash
sudo tee /etc/systemd/system/courtcast-cpu-powersave.service >/dev/null <<'EOF'
[Unit]
Description=CourtCast CPU powersave governor
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'for governor in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do echo powersave > "$governor"; done'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now courtcast-cpu-powersave.service
```

Verify:

```bash
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
```

## Post-Reboot Validation

After reboot:

```bash
vcgencmd get_config arm_freq
vcgencmd get_config initial_turbo
iw dev wlan0 get power_save || true
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
vcgencmd get_throttled
systemctl status shotclock-agent --no-pager
systemctl status shotclock-kiosk --no-pager
```

Expected results:

```text
arm_freq=1800
initial_turbo=0
Power save: off
throttled=0x0
```

`scaling_governor` will still show `ondemand` unless you added the optional persistent governor service above.

`throttled=0x0` means the Pi has not recorded undervoltage, frequency capping, throttling, or soft temperature-limit events since boot. Recheck it after several cold power cycles, WebUI reboots, media display tests, and long clock runs.

## Changes To Avoid Initially

Do not apply these until the lower-risk test above has been evaluated:

- `dtparam=audio=off`: can break CourtCast horn/music/audio output.
- WiFi TX power caps: can reduce setup AP range and facility WiFi reliability inside a metal LED panel.
- `over_voltage_delta=50000`: not a power-saving change; it can increase heat and power draw.
- `dtparam=pciex1=off`: likely unnecessary because Pi 5 PCIe is not enabled unless configured or HAT-detected.
- `BOOT_ORDER` changes for power negotiation: `PSU_MAX_CURRENT` is the relevant USB-PD bypass setting.

## Rollback

Restore the boot files:

```bash
sudo cp /boot/firmware/config.txt.before-courtcast-power-test /boot/firmware/config.txt
sudo cp /boot/firmware/cmdline.txt.before-courtcast-power-test /boot/firmware/cmdline.txt
sudo reboot
```

If you enabled the persistent CPU governor service:

```bash
sudo systemctl disable --now courtcast-cpu-powersave.service
sudo rm -f /etc/systemd/system/courtcast-cpu-powersave.service
sudo systemctl daemon-reload
echo ondemand | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor >/dev/null
```

To re-enable WiFi power saving:

```bash
sudo raspi-config
```

Navigate to:

```text
6 Advanced Options > A13 WLAN Power Save > Yes
```

Then reboot:

```bash
sudo reboot
```

## Production Test Checklist

After applying the test changes:

- Hard power-cycle the embedded panel at least 10 times.
- Reboot from the WebUI at least 5 times.
- Start basketball, volleyball, and wrestling displays from the WebUI.
- Run the basketball clock, leave the page, return, and verify WebUI time resyncs.
- Display uploaded ads, logo, sponsor, team intro, and music.
- Enter WiFi setup fallback mode and confirm `sportsboard.local` still loads.
- Recheck `vcgencmd get_throttled` after each test group.

If the Pi still turns green, wakes HDMI, then falls back to red until the power button is pressed later, the remaining issue is probably power sequencing or rail stability before Linux starts. Fix that with converter sizing, wiring, bulk capacitance near the Pi, delayed Pi power-enable, or a delayed pulse across the Pi 5 J2 power-button pads.

## References

- Raspberry Pi 5 power and USB current: https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#universal-serial-bus
- Raspberry Pi 5 USB Power Delivery note: https://pip-assets.raspberrypi.com/categories/685-app-notes-guides-whitepapers/documents/RP-009856-WP-1-USB%20Power%20delivery%20on%20Raspberry%20Pi%205.pdf
- Raspberry Pi `config.txt`: https://www.raspberrypi.com/documentation/computers/config_txt.html
- Raspberry Pi CPU governor and DVFS notes: https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#use-dvfs
- Raspberry Pi WLAN power save setting: https://www.raspberrypi.com/documentation/configuration/web-interface/raspberry-pi.html
