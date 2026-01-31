#!/bin/bash
# AgentSmith Database Setup Script
# This script sets up the PostgreSQL database for AgentSmith

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  AgentSmith Database Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Load environment variables if .env exists
if [ -f .env ]; then
    echo -e "${YELLOW}Loading environment from .env file...${NC}"
    export $(grep -v '^#' .env | xargs)
fi

# Default values
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE:-agentsmith}
DB_USERNAME=${DB_USERNAME:-agentsmith}
DB_PASSWORD=${DB_PASSWORD:-agentsmith_password}

echo ""
echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_DATABASE"
echo "  Username: $DB_USERNAME"
echo ""

# Check if PostgreSQL is available
echo -e "${YELLOW}Checking PostgreSQL connection...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql command not found. Please install PostgreSQL client.${NC}"
    echo ""
    echo "Install with:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "  macOS: brew install postgresql"
    echo "  Or use Docker: docker-compose up -d postgres"
    exit 1
fi

# Test connection (using postgres user to create db if needed)
echo -e "${YELLOW}Testing database connection...${NC}"
if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d postgres -c '\q' 2>/dev/null; then
    echo -e "${GREEN}Connection successful!${NC}"
else
    echo -e "${RED}Error: Cannot connect to PostgreSQL.${NC}"
    echo ""
    echo "Make sure PostgreSQL is running and credentials are correct."
    echo "You can start PostgreSQL with Docker:"
    echo "  docker-compose up -d postgres redis"
    exit 1
fi

# Create database if it doesn't exist
echo -e "${YELLOW}Creating database if not exists...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_DATABASE'" | grep -q 1 || \
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d postgres -c "CREATE DATABASE $DB_DATABASE"
echo -e "${GREEN}Database '$DB_DATABASE' ready.${NC}"

# Run the schema SQL
echo -e "${YELLOW}Running database schema...${NC}"
if [ -f docker/init-db.sql ]; then
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_DATABASE -f docker/init-db.sql
    echo -e "${GREEN}Schema applied successfully!${NC}"
else
    echo -e "${RED}Error: docker/init-db.sql not found.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Database Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Default admin credentials:"
echo "  Email: admin@agentsmith.local"
echo "  Password: admin123"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env and configure"
echo "  2. Start the application: npm run dev"
echo "  3. Or use Docker: docker-compose up"
echo ""
