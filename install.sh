#!/usr/bin/env bash
set -euo pipefail

SKIP_VERIFY=false
PINNED_VERSION=""
for arg in "$@"; do
  case "$arg" in
    --skip-verify) SKIP_VERIFY=true ;;
    --version=*) PINNED_VERSION="${arg#*=}" ;;
  esac
done

# Default to a specific commit hash so installs are deterministic
# and immune to the repo's main branch being force-pushed or tampered.
# Override with --version=main to follow the latest main branch.
: "${PINNED_VERSION:=ae56d74}"

INSTALL_DIR="${HOME}/.local/bin"
PGAP_DIR="${HOME}/.pgautopilot"
REPO="https://github.com/cyberreinxy/pgautopilot.git"
BUNDLE_FILE="dist/pgautopilot.bundle.cjs"
BIN_NAME="pgautopilot"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}PGAutoPilot — Local Install (no npm)${NC}"
echo ""

if ! command -v node &> /dev/null; then
  echo -e "${RED}Node.js is not installed.${NC}"
  echo "Install it from https://nodejs.org (v18+) and try again."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}Node.js 18+ required. You have $(node -v).${NC}"
  echo "Upgrade at https://nodejs.org"
  exit 1
fi

echo "Node.js $(node -v) detected."

echo -e "${CYAN}Installing version: ${PINNED_VERSION}${NC}"

if [ -d "$PGAP_DIR" ]; then
  echo "Updating existing install at $PGAP_DIR ..."
  cd "$PGAP_DIR"
  git fetch --depth 1 origin "$PINNED_VERSION"
  git checkout "$PINNED_VERSION"
else
  echo "Cloning PGAutoPilot into $PGAP_DIR ..."
  git clone "$REPO" "$PGAP_DIR"
  cd "$PGAP_DIR"
  git fetch --depth 1 origin "$PINNED_VERSION"
  git checkout "$PINNED_VERSION"
fi

BUNDLE_PATH="$PGAP_DIR/$BUNDLE_FILE"

if [ ! -f "$BUNDLE_PATH" ]; then
  echo -e "${RED}Bundle not found at $BUNDLE_PATH${NC}"
  echo "The repository may be missing the pre-built bundle. Try:"
  echo "  cd $PGAP_DIR && npm install && npm run bundle"
  exit 1
fi

if [ "$SKIP_VERIFY" = false ]; then
  # Fetch checksums from GitHub raw content at the pinned version
  # (independent source from the cloned repository, so a compromised
  # clone cannot tamper with the checksums).
  CHECKSUMS_URL="https://raw.githubusercontent.com/cyberreinxy/pgautopilot/$PINNED_VERSION/dist/checksums.txt"
  CHECKSUMS_FILE=$(mktemp -t pgap-checksums-XXXXXX.txt 2>/dev/null || echo "$PGAP_DIR/dist/checksums.txt")
  HTTP_CODE=$(curl -s -o "$CHECKSUMS_FILE" -w "%{http_code}" "$CHECKSUMS_URL" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "200" ]; then
    # Fallback to local if remote unavailable (offline install, etc.)
    LOCAL_CHECKSUMS="$PGAP_DIR/dist/checksums.txt"
    if [ -f "$LOCAL_CHECKSUMS" ]; then
      cp "$LOCAL_CHECKSUMS" "$CHECKSUMS_FILE"
    else
      echo -e "${YELLOW}Checksums unavailable — skipping verification.${NC}"
      echo -e "${CYAN}After install, run 'cd $PGAP_DIR && npm run verify' to check manually.${NC}"
      rm -f "$CHECKSUMS_FILE"
    fi
  fi
  if [ -f "$CHECKSUMS_FILE" ]; then
    echo -e "${CYAN}Verifying software integrity...${NC}"
    VERIFIED=true
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      EXPECTED_HASH=$(echo "$line" | awk '{print $1}')
      REL_PATH=$(echo "$line" | awk '{for(i=2;i<=NF;i++) printf "%s%s", (i>2?OFS:""), $i; print ""}')
      TARGET_FILE="$PGAP_DIR/$REL_PATH"
      if [ ! -f "$TARGET_FILE" ]; then
        echo -e "${RED}  MISSING: $REL_PATH${NC}"
        VERIFIED=false
        continue
      fi
      ACTUAL_HASH=$(sha256sum "$TARGET_FILE" | awk '{print $1}')
      if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
        echo -e "${RED}  HASH MISMATCH: $REL_PATH${NC}"
        VERIFIED=false
      fi
    done < "$CHECKSUMS_FILE"
    SIG_FILE="$PGAP_DIR/dist/checksums.txt.sig"
    if [ -f "$SIG_FILE" ]; then
      echo -e "${CYAN}  GPG signature file found. Verify with: gpg --verify $SIG_FILE $CHECKSUMS_FILE${NC}"
      echo -e "${CYAN}  Import the maintainer's public key from a keyserver to verify authenticity.${NC}"
    fi
    rm -f "$CHECKSUMS_FILE"
    if [ "$VERIFIED" = false ]; then
      echo -e "${RED}INTEGRITY CHECK FAILED. Software may be tampered with.${NC}"
      echo -e "${YELLOW}Use --skip-verify to bypass, or re-install from the official repository.${NC}"
      exit 1
    fi
    echo -e "${GREEN}Integrity check passed.${NC}"
  fi
fi

mkdir -p "$INSTALL_DIR"

LAUNCHER="$INSTALL_DIR/$BIN_NAME"
cat > "$LAUNCHER" << LAUNCHEREOF
#!/usr/bin/env bash
exec node "$BUNDLE_PATH" "\$@"
LAUNCHEREOF

chmod +x "$LAUNCHER"

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  SHELL_RC=""
  case "$SHELL" in
    */zsh) SHELL_RC="$HOME/.zshrc" ;;
    */bash) SHELL_RC="$HOME/.bashrc" ;;
    *) SHELL_RC="$HOME/.profile" ;;
  esac

  if [ -f "$SHELL_RC" ]; then
    if ! grep -q "$INSTALL_DIR" "$SHELL_RC" 2>/dev/null; then
      echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_RC"
      echo "Added $INSTALL_DIR to PATH in $SHELL_RC"
    fi
  fi
fi

echo ""
echo -e "${GREEN}PGAutoPilot installed successfully.${NC}"
echo ""
echo "Run it:  pgautopilot"
echo "Or:      node $BUNDLE_PATH"
echo ""
echo "Usage:   pgautopilot [--readonly] [--dev] [DATABASE_URL]"
echo ""
echo "Set DATABASE_URL in your environment or a .env file:"
echo "  export DATABASE_URL=postgresql://user:pass@localhost:5432/mydb"
echo ""
echo "Then configure your MCP client (Claude Desktop, Cursor, VS Code):"
echo "  {"
echo "    \"mcpServers\": {"
echo "      \"pgautopilot\": {"
echo "        \"command\": \"$LAUNCHER\""
echo "      }"
echo "    }"
echo "  }"
echo ""
echo -e "${CYAN}Need a quick test database?${NC}"
echo "  docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:16-alpine"
echo ""
