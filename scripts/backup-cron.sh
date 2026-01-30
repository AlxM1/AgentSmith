#!/bin/bash
# =============================================================================
# AgentSmith Automated Backup Scheduler
# =============================================================================
# Sets up cron job for automated database backups
#
# Usage:
#   ./scripts/backup-cron.sh install    # Install cron job
#   ./scripts/backup-cron.sh remove     # Remove cron job
#   ./scripts/backup-cron.sh status     # Check cron job status
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup.sh"
CRON_LOG="${PROJECT_ROOT}/logs/backup-cron.log"
CRON_SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"  # Default: 2 AM daily

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure log directory exists
mkdir -p "$(dirname "$CRON_LOG")"

show_help() {
    echo "AgentSmith Backup Scheduler"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  install     Install the cron job for automated backups"
    echo "  remove      Remove the cron job"
    echo "  status      Check if cron job is installed"
    echo "  run-now     Run backup immediately"
    echo ""
    echo "Environment Variables:"
    echo "  BACKUP_SCHEDULE   Cron schedule (default: '0 2 * * *' = 2 AM daily)"
    echo "  BACKUP_RETENTION  Number of backups to keep (default: 10)"
    echo ""
    echo "Schedule Examples:"
    echo "  '0 2 * * *'       Every day at 2 AM"
    echo "  '0 */6 * * *'     Every 6 hours"
    echo "  '0 2 * * 0'       Every Sunday at 2 AM"
    echo "  '0 2 1 * *'       First day of month at 2 AM"
}

install_cron() {
    echo -e "${BLUE}Installing backup cron job...${NC}"
    echo ""

    # Create the cron entry
    CRON_ENTRY="$CRON_SCHEDULE $BACKUP_SCRIPT >> $CRON_LOG 2>&1"

    # Check if already installed
    if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
        echo -e "${YELLOW}Cron job already exists. Updating...${NC}"
        # Remove existing entry
        crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" | crontab -
    fi

    # Add new cron entry
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

    echo -e "${GREEN}Cron job installed successfully!${NC}"
    echo ""
    echo "Schedule: $CRON_SCHEDULE"
    echo "Script: $BACKUP_SCRIPT"
    echo "Log: $CRON_LOG"
    echo ""

    # Show human-readable schedule
    echo -e "${BLUE}Schedule interpretation:${NC}"
    case "$CRON_SCHEDULE" in
        "0 2 * * *")
            echo "  Runs daily at 2:00 AM"
            ;;
        "0 */6 * * *")
            echo "  Runs every 6 hours"
            ;;
        "0 2 * * 0")
            echo "  Runs every Sunday at 2:00 AM"
            ;;
        *)
            echo "  Custom schedule: $CRON_SCHEDULE"
            ;;
    esac
}

remove_cron() {
    echo -e "${BLUE}Removing backup cron job...${NC}"

    if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
        crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" | crontab -
        echo -e "${GREEN}Cron job removed successfully!${NC}"
    else
        echo -e "${YELLOW}No cron job found.${NC}"
    fi
}

check_status() {
    echo -e "${BLUE}Checking backup cron job status...${NC}"
    echo ""

    if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
        echo -e "${GREEN}✓ Cron job is installed${NC}"
        echo ""
        echo "Current entry:"
        crontab -l 2>/dev/null | grep "$BACKUP_SCRIPT"
        echo ""

        # Check last backup
        LAST_BACKUP=$(ls -t "${PROJECT_ROOT}/backups"/agentsmith_*.sql.gz 2>/dev/null | head -1)
        if [ -n "$LAST_BACKUP" ]; then
            LAST_BACKUP_TIME=$(stat -c %y "$LAST_BACKUP" 2>/dev/null || stat -f %Sm "$LAST_BACKUP" 2>/dev/null)
            LAST_BACKUP_SIZE=$(du -h "$LAST_BACKUP" | cut -f1)
            echo "Last backup:"
            echo "  File: $(basename "$LAST_BACKUP")"
            echo "  Time: $LAST_BACKUP_TIME"
            echo "  Size: $LAST_BACKUP_SIZE"
        else
            echo -e "${YELLOW}No backups found yet.${NC}"
        fi

        # Show recent log entries
        if [ -f "$CRON_LOG" ]; then
            echo ""
            echo "Recent log entries:"
            tail -5 "$CRON_LOG" 2>/dev/null || echo "  (no entries)"
        fi
    else
        echo -e "${YELLOW}✗ Cron job is not installed${NC}"
        echo ""
        echo "Run '$0 install' to set up automated backups."
    fi
}

run_now() {
    echo -e "${BLUE}Running backup now...${NC}"
    echo ""
    "$BACKUP_SCRIPT"
}

# Parse command
case "${1:-}" in
    install)
        install_cron
        ;;
    remove)
        remove_cron
        ;;
    status)
        check_status
        ;;
    run-now)
        run_now
        ;;
    --help|-h|help)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: ${1:-}${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
