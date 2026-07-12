#!/usr/bin/env bash
# Generic Next.js daemon refresh script: rebuild this app's image and restart
# its systemd-managed docker compose stack. Intended to be invoked by your CI/CD
# (e.g. a Jenkins deploy job) to redeploy the app on the host.
#
# It is intentionally service-agnostic — names/paths derive from DEPLOY_APP_NAME
# (default: the repo directory name) and can each be overridden via env. Clone
# this into a service and tweak only what differs.
#
# Flow:
#   1. build <APP>:latest into the SYSTEM docker engine (the one root/systemd uses),
#      passing every NEXT_PUBLIC_* from this app's .env as a --build-arg so the
#      browser bundle is correct (NEXT_PUBLIC_* is inlined at build time)
#   2. sync the deploy compose file + this app's .env into the deploy dir
#   3. install/refresh the systemd unit, then restart it
#
# Env overrides:
#   DEPLOY_APP_NAME     image/stack base name      (default: basename of repo dir)
#   DEPLOY_DIR          dir the daemon runs from    (default: /opt/<APP>)
#   DEPLOY_SERVICE      systemd unit name           (default: <APP>_compose.service)
#   DEPLOY_COMPOSE      compose file to deploy      (default: <repo>/docker-compose.deploy.yml,
#                                                    falling back to <repo>/docker-compose.yml)
#   DEPLOY_DOCKER_HOST  engine to build into        (default: unix:///var/run/docker.sock)
#
# The deploy webhook also exports REPOS and BRANCH for the matched push; this
# script ignores them (it always refreshes its own stack) but they are available.
#
# IMPORTANT: images are built into the SYSTEM Docker engine (the one systemd/root
# uses), NOT a user Docker Desktop context — otherwise the daemon can't find them
# and tries to pull from a registry ("pull access denied").
#
# Usage:
#   scripts/refresh-daemon.sh             # build + deploy + restart
#   scripts/refresh-daemon.sh --no-build  # deploy + restart only
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
# Repo root is the parent of scripts/ (this script lives in <repo>/scripts/).
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

APP_NAME="${DEPLOY_APP_NAME:-$(basename "$REPO_DIR")}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/$APP_NAME}"
SERVICE="${DEPLOY_SERVICE:-${APP_NAME}_compose.service}"
SYS_DOCKER_HOST="${DEPLOY_DOCKER_HOST:-unix:///var/run/docker.sock}"

# Prefer a dedicated deploy compose (no build: sections) if present.
if [ -n "${DEPLOY_COMPOSE:-}" ]; then
	COMPOSE_FILE="$DEPLOY_COMPOSE"
elif [ -f "$REPO_DIR/docker-compose.deploy.yml" ]; then
	COMPOSE_FILE="$REPO_DIR/docker-compose.deploy.yml"
else
	COMPOSE_FILE="$REPO_DIR/docker-compose.yml"
fi
APP_ENV="$REPO_DIR/.env"

BUILD=1
[ "${1:-}" = "--no-build" ] && BUILD=0

# Run a command as root via sudo unless we already are root.
as_root() {
	if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi
}

# Run docker against the SYSTEM engine, as root (matches the systemd service).
sysdocker() {
	as_root env DOCKER_HOST="$SYS_DOCKER_HOST" docker "$@"
}

# Collect NEXT_PUBLIC_* assignments from app env files into a --build-arg list.
# These are inlined into the browser bundle at build time, so they must be
# passed to `docker build`. Runtime-only vars are left to compose/.env.
# Repo .env.production is a fallback when the deploy .env omits NEXT_PUBLIC_*.
collect_public_build_args() {
	local args=()
	local -A seen=()
	for env_file in "$APP_ENV" "$REPO_DIR/.env.production"; do
		[ -f "$env_file" ] || continue
		while IFS= read -r line; do
			case "$line" in
			NEXT_PUBLIC_*=*)
				local key="${line%%=*}"
				if [ -z "${seen[$key]+x}" ]; then
					args+=("--build-arg" "$line")
					seen[$key]=1
				fi
				;;
			esac
		done < <(grep -E '^NEXT_PUBLIC_[A-Za-z0-9_]+=' "$env_file" || true)
	done
	printf '%s\n' "${args[@]}"
}

[ -f "$COMPOSE_FILE" ] || {
	echo "ERROR: compose file not found: $COMPOSE_FILE" >&2
	exit 1
}

# 1. Build the image into the system engine with NEXT_PUBLIC_* build args.
if [ "$BUILD" -eq 1 ]; then
	echo ">> Building $APP_NAME:latest into system engine ($SYS_DOCKER_HOST) ..."
	mapfile -t BUILD_ARGS < <(collect_public_build_args)
	sysdocker build -t "$APP_NAME:latest" "${BUILD_ARGS[@]}" "$REPO_DIR"
else
	echo ">> Skipping image build (--no-build)."
fi

if ! sysdocker image inspect "$APP_NAME:latest" >/dev/null 2>&1; then
	echo "ERROR: $APP_NAME:latest is not present in the system engine ($SYS_DOCKER_HOST)." >&2
	echo "       Re-run without --no-build, or check your Docker engine/context." >&2
	exit 1
fi

# 2. Sync deploy files into the deploy directory.
echo ">> Syncing deploy files to $DEPLOY_DIR ..."
as_root mkdir -p "$DEPLOY_DIR"
as_root cp "$COMPOSE_FILE" "$DEPLOY_DIR/docker-compose.yml"
if [ -f "$APP_ENV" ]; then
	as_root cp "$APP_ENV" "$DEPLOY_DIR/.env"
	as_root chmod 600 "$DEPLOY_DIR/.env"
fi

# 3. Install/refresh the systemd unit, then restart the daemon. The unit is
#    fully managed by this script, so always (re)write it to propagate changes.
UNIT_PATH="/etc/systemd/system/$SERVICE"
echo ">> Installing/refreshing systemd unit $UNIT_PATH ..."
as_root tee "$UNIT_PATH" >/dev/null <<-EOF
	[Unit]
	Description=$APP_NAME docker compose stack
	Requires=docker.service
	After=docker.service network-online.target
	Wants=network-online.target

	[Service]
	Type=oneshot
	RemainAfterExit=yes
	WorkingDirectory=$DEPLOY_DIR
	ExecStart=/usr/bin/docker compose up -d
	ExecStop=/usr/bin/docker compose down
	TimeoutStartSec=0

	[Install]
	WantedBy=multi-user.target
EOF
as_root systemctl daemon-reload
as_root systemctl enable "$SERVICE"

echo ">> Restarting $SERVICE ..."
as_root systemctl restart "$SERVICE"
as_root systemctl --no-pager --full status "$SERVICE" | head -n 14 || true
echo ">> Done."
