#!/bin/bash
# =============================================================================
# AgentSmith Database Backup Script
# =============================================================================
# Creates timestamped backups of PostgreSQL database
#
# Usage:
#   ./scripts/backup.sh                    # Full backup
#   ./scripts/backup.sh --data-only        # Data only (no schema)
#   ./scripts/backup.sh --output /path     # Custom output directory
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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATA_ONLY=false

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
while [[ $# -gt 0 ]]; do
    case $1 in
        --data-only)
            DATA_ONLY=true
            shift
            ;;
        --output|-o)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --data-only       Backup data only (no schema)"
            echo "  --output, -o      Custom output directory"
            echo "  --help, -h        Show this help"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  AgentSmith Database Backup${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Determine backup filename
if [ "$DATA_ONLY" = true ]; then
    BACKUP_FILE="${BACKUP_DIR}/agentsmith_data_${TIMESTAMP}.sql"
    PG_DUMP_ARGS="--data-only"
    echo -e "Mode: ${YELLOW}Data only${NC}"
else
    BACKUP_FILE="${BACKUP_DIR}/agentsmith_full_${TIMESTAMP}.sql"
    PG_DUMP_ARGS="--clean --if-exists"
    echo -e "Mode: ${YELLOW}Full backup${NC}"
fi

echo -e "Database: ${YELLOW}${DB_DATABASE}${NC}"
echo -e "Output: ${YELLOW}${BACKUP_FILE}${NC}"
echo ""

# Check if running in Docker or direct connection
if docker ps --format '{{.Names}}' | grep -q "agentsmith-postgres"; then
    echo -e "${BLUE}Using Docker container...${NC}"

    docker exec agentsmith-postgres pg_dump \
        -U "$DB_USERNAME" \
        -d "$DB_DATABASE" \
        $PG_DUMP_ARGS \
        > "$BACKUP_FILE"
else
    echo -e "${BLUE}Using direct connection...${NC}"

    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USERNAME" \
        -d "$DB_DATABASE" \
        $PG_DUMP_ARGS \
        > "$BACKUP_FILE"
fi

# Compress backup
echo -e "${BLUE}Compressing backup...${NC}"
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Calculate size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Backup Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "File: ${GREEN}${BACKUP_FILE}${NC}"
echo -e "Size: ${GREEN}${BACKUP_SIZE}${NC}"
echo ""

# Cleanup old backups (keep last 10)
echo -e "${BLUE}Cleaning up old backups (keeping last 10)...${NC}"
ls -t "${BACKUP_DIR}"/agentsmith_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
echo -e "${GREEN}Done!${NC}"
