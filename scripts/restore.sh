#!/bin/bash
# =============================================================================
# AgentSmith Database Restore Script
# =============================================================================
# Restores PostgreSQL database from backup
#
# Usage:
#   ./scripts/restore.sh backup_file.sql.gz
#   ./scripts/restore.sh --list              # List available backups
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"

# Load environment
if [ -f "${PROJECT_ROOT}/.env" ]; then
    source "${PROJECT_ROOT}/.env"
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_DATABASE="${DB_DATABASE:-agentsmith}"
DB_USERNAME="${DB_USERNAME:-agentsmith}"
DB_PASSWORD="${DB_PASSWORD:-agentsmith_password}"

# Parse arguments
if [ "$1" = "--list" ] || [ "$1" = "-l" ]; then
    echo -e "${BLUE}Available backups:${NC}"
    echo ""
    if ls "${BACKUP_DIR}"/agentsmith_*.sql.gz 1> /dev/null 2>&1; then
        ls -lh "${BACKUP_DIR}"/agentsmith_*.sql.gz | awk '{print $9, $5}'
    else
        echo -e "${YELLOW}No backups found in ${BACKUP_DIR}${NC}"
    fi
    exit 0
fi

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 BACKUP_FILE"
    echo ""
    echo "Options:"
    echo "  --list, -l    List available backups"
    echo "  --help, -h    Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 backups/agentsmith_full_20240115_120000.sql.gz"
    echo "  $0 --list"
    exit 0
fi

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo "Usage: $0 BACKUP_FILE"
    echo "Run '$0 --list' to see available backups"
    exit 1
fi

# Handle relative paths
if [[ ! "$BACKUP_FILE" = /* ]]; then
    BACKUP_FILE="${PROJECT_ROOT}/${BACKUP_FILE}"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  AgentSmith Database Restore${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "Backup: ${YELLOW}${BACKUP_FILE}${NC}"
echo -e "Database: ${YELLOW}${DB_DATABASE}${NC}"
echo ""

# Confirm restore
echo -e "${RED}WARNING: This will overwrite the current database!${NC}"
read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}Restoring database...${NC}"

# Decompress if needed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    TEMP_FILE=$(mktemp)
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    SQL_FILE="$TEMP_FILE"
else
    SQL_FILE="$BACKUP_FILE"
fi

# Check if running in Docker or direct connection
if docker ps --format '{{.Names}}' | grep -q "agentsmith-postgres"; then
    echo -e "${BLUE}Using Docker container...${NC}"

    # Copy file to container and restore
    docker cp "$SQL_FILE" agentsmith-postgres:/tmp/restore.sql
    docker exec agentsmith-postgres psql \
        -U "$DB_USERNAME" \
        -d "$DB_DATABASE" \
        -f /tmp/restore.sql \
        2>&1 | grep -v "^SET$" | grep -v "^COMMENT$" || true
    docker exec agentsmith-postgres rm /tmp/restore.sql
else
    echo -e "${BLUE}Using direct connection...${NC}"

    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USERNAME" \
        -d "$DB_DATABASE" \
        -f "$SQL_FILE" \
        2>&1 | grep -v "^SET$" | grep -v "^COMMENT$" || true
fi

# Cleanup temp file
if [ -n "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Restore Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${YELLOW}Note: You may need to restart services for changes to take effect.${NC}"
echo -e "Run: ${BLUE}docker compose restart${NC}"
