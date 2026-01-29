#!/bin/bash
# AgentSmith - Logs Script
# View logs for services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Parse arguments
SERVICE=""
FOLLOW=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [SERVICE] [OPTIONS]"
            echo ""
            echo "Services:"
            echo "  backend    Backend API server"
            echo "  worker     Execution worker"
            echo "  frontend   Frontend application"
            echo "  admin      Admin panel"
            echo "  postgres   PostgreSQL database"
            echo "  redis      Redis cache"
            echo ""
            echo "Options:"
            echo "  -f, --follow  Follow log output"
            echo "  -h, --help    Show this help"
            echo ""
            echo "Examples:"
            echo "  $0              # All logs"
            echo "  $0 backend      # Backend logs only"
            echo "  $0 backend -f   # Follow backend logs"
            exit 0
            ;;
        *)
            SERVICE=$1
            shift
            ;;
    esac
done

# Build command
CMD="docker compose logs"

if [ -n "$SERVICE" ]; then
    CMD="$CMD $SERVICE"
fi

if [ "$FOLLOW" = true ]; then
    CMD="$CMD -f"
fi

CMD="$CMD --tail=100"

eval $CMD
