# New Pi Remote-Tunnel Bootstrap

This note covers only the temporary connection needed for a remote operator to reach a freshly deployed Pi on another network. It does not install CourtCast, configure the kiosk, pair the display, or perform the permanent production setup.

## 1. Run this on the new Pi

Log in locally, open a terminal, and run:

```bash
sudo systemctl enable --now ssh

hostname
hostname -I
whoami
uname -m
cat /etc/os-release | grep -E '^(PRETTY_NAME|VERSION_CODENAME)='

mkdir -p ~/.ssh
chmod 700 ~/.ssh

device_hostname="$(hostname)"
tunnel_key="$HOME/.ssh/${device_hostname}-tunnel"

if [ ! -f "$tunnel_key" ]; then
  ssh-keygen -t ed25519 \
    -f "$tunnel_key" \
    -N '' \
    -C "${device_hostname}-tunnel"
fi

cat "${tunnel_key}.pub"
ssh-keygen -lf "${tunnel_key}.pub"
```

Do not display or send the private-key file. Only the line ending in `.pub` is safe to share.

## 2. Send the remote operator this information

Copy and send:

1. The output of `hostname`.
2. The output of `hostname -I`.
3. The output of `whoami`.
4. The CPU architecture from `uname -m`.
5. The operating-system name and codename.
6. The complete `ssh-ed25519 ...` public-key line.
7. The public-key fingerprint printed by `ssh-keygen -lf`.
8. A temporary password that works for both the displayed Linux user and `sudo`, delivered through an approved secure channel.

The local IPv4 address alone is not remotely reachable from another network. The public key allows the production server to accept an outbound reverse tunnel from the Pi without exposing the Pi's SSH port to the Internet.

## 3. Wait for the operator's response

The remote operator must first:

- reserve a unique loopback-only port on the production server;
- authorize the Pi's tunnel public key with forwarding restrictions;
- provide the production server's verified SSH host-key fingerprint;
- provide the maintenance public key that should be added to the Pi; and
- return the exact bootstrap-tunnel command with the assigned port filled in.

Do not invent or reuse a tunnel port. Two devices cannot listen on the same server port.

## 4. Add the maintenance login key

After the operator supplies the maintenance public key, add that public key to the Pi account:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Replace the placeholder with the complete public-key line supplied by the operator.
maintenance_key='<MAINTENANCE_PUBLIC_KEY>'
grep -qxF "$maintenance_key" ~/.ssh/authorized_keys \
  || printf '%s\n' "$maintenance_key" >> ~/.ssh/authorized_keys
```

Never paste a private key into `authorized_keys`.

## 5. Start the temporary reverse tunnel

Use the exact port and verified fingerprint supplied by the operator. The resulting command will have this form:

```bash
device_hostname="$(hostname)"
tunnel_key="$HOME/.ssh/${device_hostname}-tunnel"

ssh -N -T \
  -i "$tunnel_key" \
  -o IdentitiesOnly=yes \
  -o BatchMode=yes \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=20 \
  -o ServerAliveCountMax=3 \
  -o ConnectTimeout=15 \
  -R 127.0.0.1:<ASSIGNED_SERVER_PORT>:127.0.0.1:22 \
  courtcast-tunnel@5.161.109.106
```

On the first connection, SSH may show the production server's host-key fingerprint. Compare it exactly with the fingerprint supplied by the operator before typing `yes`. Stop if it differs.

The command normally stays open without printing anything. That is expected.

## 6. Keep the connection running

- Leave that terminal and SSH command running.
- Do not press `Ctrl+C`, close the terminal, log out, turn off Wi-Fi, or power down the Pi.
- Tell the remote operator: `Tunnel is running and the maintenance key is added.`
- Wait until the operator confirms that the permanent `shotclock-remote-support` service is installed and tested.

The operator will replace this temporary session with a root-protected, automatically restarting system service. After the permanent service survives a reboot and remote reconnection test, the temporary user-owned tunnel key can be removed.

## Common errors

| Message | Meaning |
| --- | --- |
| `Permission denied (publickey)` | The production server has not authorized this Pi's tunnel public key, or the wrong private key was selected. |
| `remote port forwarding failed for listen port` | The assigned port is already in use or does not match the server-side key restriction. Stop and ask for a new verified command. |
| `Could not resolve hostname` | The Pi does not currently have working DNS or Internet access. |
| `Connection timed out` | The Pi cannot reach the production server over the current network. |
| The command returns to the shell immediately | The tunnel failed or disconnected. Copy the complete error to the remote operator. |

