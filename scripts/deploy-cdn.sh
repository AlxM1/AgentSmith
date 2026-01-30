#!/bin/bash
# CDN Deployment Script for AgentSmith
# Syncs static assets to S3 and invalidates CloudFront cache

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Default values
ENVIRONMENT="${ENVIRONMENT:-staging}"
AWS_REGION="${AWS_REGION:-us-east-1}"
DRY_RUN="${DRY_RUN:-false}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -r|--region)
      AWS_REGION="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  -e, --environment   Environment (staging, production)"
      echo "  -r, --region        AWS region"
      echo "  --dry-run           Show what would be done without executing"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
  log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
  exit 1
fi

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Set bucket name based on environment
S3_BUCKET="agentsmith-static-${ENVIRONMENT}-${AWS_ACCOUNT_ID}"

# Get CloudFront distribution ID from Terraform output
get_distribution_id() {
  cd "$PROJECT_ROOT/terraform/environments/$ENVIRONMENT"
  DISTRIBUTION_ID=$(terraform output -raw cdn_distribution_id 2>/dev/null || echo "")

  if [[ -z "$DISTRIBUTION_ID" ]]; then
    log_warn "Could not get distribution ID from Terraform. Trying AWS CLI..."
    DISTRIBUTION_ID=$(aws cloudfront list-distributions \
      --query "DistributionList.Items[?Origins.Items[?Id=='agentsmith-static-origin']].Id | [0]" \
      --output text \
      --region us-east-1)
  fi

  echo "$DISTRIBUTION_ID"
}

# Build frontend assets
build_frontend() {
  log_info "Building frontend assets..."

  cd "$PROJECT_ROOT/packages/frontend"

  # Install dependencies if needed
  if [[ ! -d "node_modules" ]]; then
    npm ci
  fi

  # Build for production
  NODE_ENV=production npm run build

  log_success "Frontend build complete"
}

# Sync assets to S3
sync_to_s3() {
  log_info "Syncing assets to S3 bucket: $S3_BUCKET"

  local BUILD_DIR="$PROJECT_ROOT/packages/frontend/dist"

  if [[ ! -d "$BUILD_DIR" ]]; then
    log_error "Build directory not found: $BUILD_DIR"
    log_error "Run 'npm run build' first or use --build flag"
    exit 1
  fi

  local SYNC_ARGS="--delete"

  if [[ "$DRY_RUN" == "true" ]]; then
    SYNC_ARGS="$SYNC_ARGS --dryrun"
    log_warn "DRY RUN mode - no changes will be made"
  fi

  # Sync HTML files with shorter cache
  log_info "Syncing HTML files..."
  aws s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" \
    --exclude "*" \
    --include "*.html" \
    --cache-control "public, max-age=300" \
    --content-type "text/html; charset=utf-8" \
    $SYNC_ARGS \
    --region "$AWS_REGION"

  # Sync JS/CSS with long cache and immutable
  log_info "Syncing JavaScript and CSS files..."
  aws s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" \
    --exclude "*" \
    --include "*.js" \
    --include "*.css" \
    --cache-control "public, max-age=31536000, immutable" \
    $SYNC_ARGS \
    --region "$AWS_REGION"

  # Sync fonts with long cache
  log_info "Syncing font files..."
  aws s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" \
    --exclude "*" \
    --include "*.woff" \
    --include "*.woff2" \
    --include "*.ttf" \
    --include "*.eot" \
    --cache-control "public, max-age=31536000, immutable" \
    $SYNC_ARGS \
    --region "$AWS_REGION"

  # Sync images with moderate cache
  log_info "Syncing image files..."
  aws s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" \
    --exclude "*" \
    --include "*.png" \
    --include "*.jpg" \
    --include "*.jpeg" \
    --include "*.gif" \
    --include "*.svg" \
    --include "*.ico" \
    --include "*.webp" \
    --cache-control "public, max-age=2592000" \
    $SYNC_ARGS \
    --region "$AWS_REGION"

  # Sync JSON (manifests, etc.) with short cache
  log_info "Syncing JSON files..."
  aws s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" \
    --exclude "*" \
    --include "*.json" \
    --cache-control "public, max-age=300" \
    $SYNC_ARGS \
    --region "$AWS_REGION"

  # Sync remaining files
  log_info "Syncing other files..."
  aws s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" \
    --exclude "*.html" \
    --exclude "*.js" \
    --exclude "*.css" \
    --exclude "*.woff*" \
    --exclude "*.ttf" \
    --exclude "*.eot" \
    --exclude "*.png" \
    --exclude "*.jpg" \
    --exclude "*.jpeg" \
    --exclude "*.gif" \
    --exclude "*.svg" \
    --exclude "*.ico" \
    --exclude "*.webp" \
    --exclude "*.json" \
    --cache-control "public, max-age=3600" \
    $SYNC_ARGS \
    --region "$AWS_REGION"

  log_success "S3 sync complete"
}

# Invalidate CloudFront cache
invalidate_cache() {
  local DISTRIBUTION_ID=$1

  if [[ -z "$DISTRIBUTION_ID" ]] || [[ "$DISTRIBUTION_ID" == "None" ]]; then
    log_warn "No CloudFront distribution ID found, skipping cache invalidation"
    return
  fi

  log_info "Invalidating CloudFront cache for distribution: $DISTRIBUTION_ID"

  if [[ "$DRY_RUN" == "true" ]]; then
    log_warn "DRY RUN: Would invalidate paths: /*"
    return
  fi

  # Create invalidation
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text \
    --region us-east-1)

  log_info "Invalidation created: $INVALIDATION_ID"

  # Wait for invalidation to complete
  log_info "Waiting for invalidation to complete..."
  aws cloudfront wait invalidation-completed \
    --distribution-id "$DISTRIBUTION_ID" \
    --id "$INVALIDATION_ID" \
    --region us-east-1

  log_success "Cache invalidation complete"
}

# Get deployment info
get_deployment_info() {
  log_info "Deployment Information"
  echo "================================"
  echo "Environment:    $ENVIRONMENT"
  echo "AWS Region:     $AWS_REGION"
  echo "S3 Bucket:      $S3_BUCKET"
  echo "Distribution:   $(get_distribution_id)"
  echo "================================"
}

# Main execution
main() {
  log_info "Starting CDN deployment for AgentSmith"
  echo ""

  get_deployment_info
  echo ""

  # Get distribution ID
  DISTRIBUTION_ID=$(get_distribution_id)

  # Build frontend
  build_frontend
  echo ""

  # Sync to S3
  sync_to_s3
  echo ""

  # Invalidate CloudFront cache
  invalidate_cache "$DISTRIBUTION_ID"
  echo ""

  log_success "CDN deployment complete!"
  echo ""
  echo "Assets are now available at:"
  echo "  https://cdn.agentsmith.io (if configured)"
  echo "  https://$S3_BUCKET.s3.${AWS_REGION}.amazonaws.com"
}

main "$@"
