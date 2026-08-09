#!/bin/sh
# Studyield frontend container entrypoint.
#
# The SSH debug server is ALWAYS ON (root key-based auth, public key baked in
# at image build time). Optional extras at runtime:
#   SSH_PASSWORD   - enable root password login
#   SSH_PUBLIC_KEY - add an extra authorized key
# Then starts nginx.
set -e

start_sshd() {
  echo "[entrypoint] Starting SSH debug server (port 22)..."
  mkdir -p /run/sshd /root/.ssh
  chmod 700 /root/.ssh

  if [ -n "${SSH_PASSWORD}" ]; then
    printf 'root:%s\n' "${SSH_PASSWORD}" | chpasswd
    echo "[entrypoint] root password auth enabled (SSH_PASSWORD)"
  fi

  if [ -n "${SSH_PUBLIC_KEY}" ]; then
    printf '%s\n' "${SSH_PUBLIC_KEY}" >> /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
    echo "[entrypoint] extra root public key installed (SSH_PUBLIC_KEY)"
  fi

  # Generate ephemeral host keys on first start (container identity).
  [ -f /etc/ssh/ssh_host_rsa_key ] || ssh-keygen -A >/dev/null 2>&1 || true

  cat > /etc/ssh/sshd_config.studyield.conf <<'EOF'
Port 22
ListenAddress 0.0.0.0
PermitRootLogin yes
PasswordAuthentication yes
PubkeyAuthentication yes
KbdInteractiveAuthentication no
X11Forwarding no
PrintMotd no
Subsystem sftp internal-sftp
EOF

  if /usr/sbin/sshd -t -f /etc/ssh/sshd_config.studyield.conf >/dev/null 2>&1; then
    /usr/sbin/sshd -D -e -f /etc/ssh/sshd_config.studyield.conf &
    echo "[entrypoint] sshd running"
  else
    echo "[entrypoint] WARNING: sshd config invalid - SSH debug disabled" >&2
  fi
}

start_sshd

echo "[entrypoint] Starting nginx..."
exec nginx -g "daemon off;"
