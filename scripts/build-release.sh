#!/bin/bash
# Build Release - Creates a release package for distribution

set -e

VERSION=${1:-$(git describe --tags 2>/dev/null || echo "0.1.0")}
RELEASE_DIR="/opt/shotclock/releases"
PLATFORM_DIR="/home/shotclock/shotclock-platform"

echo "============================================"
echo "Building Shotclock Platform Release v${VERSION}"
echo "============================================"

# Create release directory
mkdir -p "${RELEASE_DIR}/${VERSION}"

echo ""
echo "[1/6] Building shared packages..."
cd "${PLATFORM_DIR}"
pnpm --filter @shotclock/shared build
pnpm --filter @shotclock/display-core build
pnpm --filter @shotclock/sports-core build

echo ""
echo "[2/6] Building server-web..."
pnpm --filter @shotclock/server-web build

echo ""
echo "[3/6] Building pi-agent..."
pnpm --filter @shotclock/pi-agent build

echo ""
echo "[4/6] Building pi-kiosk..."
pnpm --filter @shotclock/pi-kiosk build

echo ""
echo "[5/6] Copying files to release directory..."
mkdir -p "${RELEASE_DIR}/${VERSION}/apps/server-web"
mkdir -p "${RELEASE_DIR}/${VERSION}/apps/pi-agent"
mkdir -p "${RELEASE_DIR}/${VERSION}/apps/pi-kiosk"
mkdir -p "${RELEASE_DIR}/${VERSION}/packages/shared"
mkdir -p "${RELEASE_DIR}/${VERSION}/packages/display-core"
mkdir -p "${RELEASE_DIR}/${VERSION}/packages/sports-core"

# Copy built files while preserving the same paths used by systemd.
cp -r "${PLATFORM_DIR}/apps/server-web/.next" "${RELEASE_DIR}/${VERSION}/apps/server-web/" 2>/dev/null || true
cp "${PLATFORM_DIR}/apps/server-web/package.json" "${RELEASE_DIR}/${VERSION}/apps/server-web/"
cp -r "${PLATFORM_DIR}/apps/pi-agent/dist" "${RELEASE_DIR}/${VERSION}/apps/pi-agent/"
cp "${PLATFORM_DIR}/apps/pi-agent/package.json" "${RELEASE_DIR}/${VERSION}/apps/pi-agent/"
cp -r "${PLATFORM_DIR}/apps/pi-kiosk/dist" "${RELEASE_DIR}/${VERSION}/apps/pi-kiosk/"
cp "${PLATFORM_DIR}/apps/pi-kiosk/package.json" "${RELEASE_DIR}/${VERSION}/apps/pi-kiosk/"
cp -r "${PLATFORM_DIR}/packages/shared/dist" "${RELEASE_DIR}/${VERSION}/packages/shared/"
cp "${PLATFORM_DIR}/packages/shared/package.json" "${RELEASE_DIR}/${VERSION}/packages/shared/"
cp -r "${PLATFORM_DIR}/packages/display-core/dist" "${RELEASE_DIR}/${VERSION}/packages/display-core/"
cp "${PLATFORM_DIR}/packages/display-core/package.json" "${RELEASE_DIR}/${VERSION}/packages/display-core/"
cp -r "${PLATFORM_DIR}/packages/sports-core/dist" "${RELEASE_DIR}/${VERSION}/packages/sports-core/"
cp "${PLATFORM_DIR}/packages/sports-core/package.json" "${RELEASE_DIR}/${VERSION}/packages/sports-core/"

# Copy scripts and configs
cp "${PLATFORM_DIR}/scripts/install-pi.sh" "${RELEASE_DIR}/${VERSION}/"
cp "${PLATFORM_DIR}/scripts/launch-kiosk.sh" "${RELEASE_DIR}/${VERSION}/"
cp "${PLATFORM_DIR}/.env.example" "${RELEASE_DIR}/${VERSION}/.env"
cp "${PLATFORM_DIR}/README.md" "${RELEASE_DIR}/${VERSION}/"
cp "${PLATFORM_DIR}/package.json" "${RELEASE_DIR}/${VERSION}/"
cp "${PLATFORM_DIR}/pnpm-lock.yaml" "${RELEASE_DIR}/${VERSION}/"
cp "${PLATFORM_DIR}/pnpm-workspace.yaml" "${RELEASE_DIR}/${VERSION}/"
cp -r "${PLATFORM_DIR}/prisma" "${RELEASE_DIR}/${VERSION}/"
mkdir -p "${RELEASE_DIR}/${VERSION}/scripts"
cp "${PLATFORM_DIR}/scripts/launch-kiosk.sh" "${RELEASE_DIR}/${VERSION}/scripts/"
cp "${PLATFORM_DIR}/scripts/install-pi.sh" "${RELEASE_DIR}/${VERSION}/scripts/"
cp -r "${PLATFORM_DIR}/scripts/config" "${RELEASE_DIR}/${VERSION}/scripts/"
cp -r "${PLATFORM_DIR}/scripts/config" "${RELEASE_DIR}/${VERSION}/config"

# Copy systemd services
mkdir -p "${RELEASE_DIR}/${VERSION}/systemd"
cp "${PLATFORM_DIR}/systemd"/*.service "${RELEASE_DIR}/${VERSION}/systemd/"

echo ""
echo "[6/6] Creating archive..."
cd "${RELEASE_DIR}"
tar -czvf "shotclock-${VERSION}.tar.gz" "${VERSION}"

# Update 'current' symlink
ln -sfn "${RELEASE_DIR}/${VERSION}" /opt/shotclock/current

echo ""
echo "============================================"
echo "Release v${VERSION} built successfully!"
echo "Archive: ${RELEASE_DIR}/shotclock-${VERSION}.tar.gz"
echo "============================================"
