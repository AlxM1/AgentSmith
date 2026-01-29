#!/bin/bash

# =============================================================================
# AgentSmith Setup Script
# =============================================================================
# This script helps you set up AgentSmith for local deployment.
#
# Usage:
#   ./scripts/setup.sh           # Interactive setup
#   ./scripts/setup.sh --quick   # Quick setup with auto-generated secrets
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check for required tools
check_requirements() {
    print_header "Checking Requirements"

    local missing=()

    if ! command -v docker &> /dev/null; then
        missing+=("docker")
    else
        print_success "Docker is installed"
    fi

    if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
        missing+=("docker-compose")
    else
        print_success "Docker Compose is installed"
    fi

    if ! command -v openssl &> /dev/null; then
        missing+=("openssl")
    else
        print_success "OpenSSL is installed"
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing[*]}"
        echo "Please install the missing tools and try again."
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        echo "Please start Docker and try again."
        exit 1
    fi
    print_success "Docker daemon is running"
}

# Generate secure secrets
generate_secrets() {
    print_header "Generating Secure Secrets"

    DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n/+=')
    REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n/+=')
    JWT_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)
    SESSION_SECRET=$(openssl rand -hex 32)

    print_success "Generated all secrets securely"
}

# Create .env file
create_env_file() {
    print_header "Creating Environment Configuration"

    if [ -f .env ]; then
        print_warning ".env file already exists"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Keeping existing .env file"
            return
        fi
        cp .env .env.backup
        print_info "Backed up existing .env to .env.backup"
    fi

    # Copy template
    cp .env.example .env

    # Replace placeholder values with generated secrets
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|DB_PASSWORD=CHANGE_ME_GENERATE_SECURE_PASSWORD|DB_PASSWORD=${DB_PASSWORD}|g" .env
        sed -i '' "s|REDIS_PASSWORD=CHANGE_ME_GENERATE_SECURE_PASSWORD|REDIS_PASSWORD=${REDIS_PASSWORD}|g" .env
        sed -i '' "s|JWT_SECRET=CHANGE_ME_GENERATE_64_CHAR_HEX_STRING|JWT_SECRET=${JWT_SECRET}|g" .env
        sed -i '' "s|JWT_REFRESH_SECRET=CHANGE_ME_GENERATE_64_CHAR_HEX_STRING|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|g" .env
        sed -i '' "s|ENCRYPTION_KEY=CHANGE_ME_EXACTLY_32_CHARACTERS_|ENCRYPTION_KEY=${ENCRYPTION_KEY}|g" .env
        sed -i '' "s|SESSION_SECRET=CHANGE_ME_GENERATE_64_CHAR_HEX_STRING|SESSION_SECRET=${SESSION_SECRET}|g" .env
    else
        # Linux
        sed -i "s|DB_PASSWORD=CHANGE_ME_GENERATE_SECURE_PASSWORD|DB_PASSWORD=${DB_PASSWORD}|g" .env
        sed -i "s|REDIS_PASSWORD=CHANGE_ME_GENERATE_SECURE_PASSWORD|REDIS_PASSWORD=${REDIS_PASSWORD}|g" .env
        sed -i "s|JWT_SECRET=CHANGE_ME_GENERATE_64_CHAR_HEX_STRING|JWT_SECRET=${JWT_SECRET}|g" .env
        sed -i "s|JWT_REFRESH_SECRET=CHANGE_ME_GENERATE_64_CHAR_HEX_STRING|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|g" .env
        sed -i "s|ENCRYPTION_KEY=CHANGE_ME_EXACTLY_32_CHARACTERS_|ENCRYPTION_KEY=${ENCRYPTION_KEY}|g" .env
        sed -i "s|SESSION_SECRET=CHANGE_ME_GENERATE_64_CHAR_HEX_STRING|SESSION_SECRET=${SESSION_SECRET}|g" .env
    fi

    # Secure the file
    chmod 600 .env

    print_success "Created .env file with secure secrets"
    print_success "File permissions set to 600 (owner read/write only)"
}

# Build Docker images
build_images() {
    print_header "Building Docker Images"

    print_info "This may take a few minutes on first run..."

    if command -v docker compose &> /dev/null; then
        docker compose build
    else
        docker-compose build
    fi

    print_success "Docker images built successfully"
}

# Start services
start_services() {
    print_header "Starting Services"

    if command -v docker compose &> /dev/null; then
        docker compose up -d
    else
        docker-compose up -d
    fi

    print_success "Services started"
}

# Wait for services to be healthy
wait_for_services() {
    print_header "Waiting for Services to be Ready"

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:4000/health > /dev/null 2>&1; then
            print_success "Backend API is ready"
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        print_warning "Backend may still be starting up. Check logs with: docker compose logs backend"
    fi
}

# Print access information
print_access_info() {
    print_header "Setup Complete!"

    echo -e "AgentSmith is now running. Access it at:\n"
    echo -e "  ${GREEN}Frontend:${NC}    http://localhost:3000"
    echo -e "  ${GREEN}Admin Panel:${NC} http://localhost:3001"
    echo -e "  ${GREEN}API:${NC}         http://localhost:4000"
    echo -e ""
    echo -e "Default admin credentials will be created on first run."
    echo -e "Check the logs for the initial admin password:"
    echo -e "  ${BLUE}docker compose logs backend${NC}"
    echo -e ""
    echo -e "Useful commands:"
    echo -e "  ${BLUE}docker compose logs -f${NC}  # View logs"
    echo -e "  ${BLUE}docker compose down${NC}     # Stop services"
    echo -e "  ${BLUE}docker compose restart${NC}  # Restart services"
    echo -e ""
    print_warning "For production, set up a reverse proxy with SSL (nginx/traefik)"
}

# Main execution
main() {
    echo -e "${GREEN}"
    echo "    _                    _   ____            _ _   _     "
    echo "   / \   __ _  ___ _ __ | |_/ ___| _ __ ___ (_) |_| |__  "
    echo "  / _ \ / _\` |/ _ \ '_ \| __\___ \| '_ \` _ \| | __| '_ \ "
    echo " / ___ \ (_| |  __/ | | | |_ ___) | | | | | | | |_| | | |"
    echo "/_/   \_\__, |\___|_| |_|\__|____/|_| |_| |_|_|\__|_| |_|"
    echo "        |___/                                            "
    echo -e "${NC}"
    echo "Local Deployment Setup Script"
    echo ""

    # Parse arguments
    QUICK_MODE=false
    if [ "$1" == "--quick" ]; then
        QUICK_MODE=true
        print_info "Quick mode enabled - using defaults"
    fi

    check_requirements
    generate_secrets
    create_env_file
    build_images
    start_services
    wait_for_services
    print_access_info
}

# Run main function
main "$@"
