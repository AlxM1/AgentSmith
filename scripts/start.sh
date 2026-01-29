#!/bin/bash
# AgentSmith - Start Script
# Starts all services using Docker Compose

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "========================================"
echo "  AgentSmith - Starting Services"
echo "========================================"

# Check for .env file
if [ ! -f ".env" ]; then
    echo "No .env file found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "Created .env file. Please review and update settings."
    else
        echo "ERROR: .env.example not found!"
        exit 1
    fi
fi

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker first."
    exit 1
fi

# Check Docker Compose
if ! docker compose version > /dev/null 2>&1; then
    echo "ERROR: Docker Compose is not installed."
    exit 1
fi

# Parse command line arguments
DEV_MODE=false
BUILD=false
DETACH=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --dev)
            DEV_MODE=true
            shift
            ;;
        --build)
            BUILD=true
            shift
            ;;
        --foreground|-f)
            DETACH=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dev         Start in development mode with hot reload"
            echo "  --build       Force rebuild of containers"
            echo "  --foreground  Run in foreground (don't detach)"
            echo "  -h, --help    Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Build compose command
COMPOSE_CMD="docker compose"

if [ "$BUILD" = true ]; then
    COMPOSE_CMD="$COMPOSE_CMD up --build"
else
    COMPOSE_CMD="$COMPOSE_CMD up"
fi

if [ "$DETACH" = true ]; then
    COMPOSE_CMD="$COMPOSE_CMD -d"
fi

# Start services
echo ""
echo "Starting services..."
echo ""

eval $COMPOSE_CMD

if [ "$DETACH" = true ]; then
    echo ""
    echo "========================================"
    echo "  Services started successfully!"
    echo "========================================"
    echo ""
    echo "  Frontend:    http://localhost:3000"
    echo "  Admin Panel: http://localhost:3001"
    echo "  Backend API: http://localhost:4000"
    echo ""
    echo "  Default credentials:"
    echo "    Email: admin@agentsmith.local"
    echo "    Password: admin123"
    echo ""
    echo "  View logs:   docker compose logs -f"
    echo "  Stop:        ./scripts/stop.sh"
    echo ""
fi
