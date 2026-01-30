#!/bin/bash
# Blue-Green Deployment Script for AgentSmith
# Manages blue-green deployments using Argo Rollouts

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# Default values
NAMESPACE="${NAMESPACE:-agentsmith}"
RELEASE_NAME="${RELEASE_NAME:-agentsmith}"
ACTION="${1:-status}"
TIMEOUT="${TIMEOUT:-600}"

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."

  # Check kubectl
  if ! command -v kubectl &> /dev/null; then
    log_error "kubectl is not installed"
    exit 1
  fi

  # Check kubectl-argo-rollouts plugin
  if ! kubectl argo rollouts version &> /dev/null; then
    log_warn "kubectl-argo-rollouts plugin not found"
    log_info "Installing Argo Rollouts kubectl plugin..."
    curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
    chmod +x kubectl-argo-rollouts-linux-amd64
    sudo mv kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts
  fi

  # Check if Argo Rollouts is installed in cluster
  if ! kubectl get crd rollouts.argoproj.io &> /dev/null; then
    log_error "Argo Rollouts is not installed in the cluster"
    log_info "Install with: kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml"
    exit 1
  fi

  log_success "Prerequisites check passed"
}

# Get rollout status
get_status() {
  log_info "Getting rollout status for $RELEASE_NAME in $NAMESPACE..."
  echo ""

  kubectl argo rollouts get rollout "$RELEASE_NAME" \
    --namespace "$NAMESPACE" \
    --watch=false

  echo ""

  # Show analysis runs
  log_info "Recent Analysis Runs:"
  kubectl get analysisrun \
    --namespace "$NAMESPACE" \
    -l rollout-name="$RELEASE_NAME" \
    --sort-by=.metadata.creationTimestamp \
    --no-headers 2>/dev/null | tail -5 || echo "  No analysis runs found"
}

# Watch rollout in real-time
watch_rollout() {
  log_info "Watching rollout for $RELEASE_NAME in $NAMESPACE..."
  log_info "Press Ctrl+C to stop watching"
  echo ""

  kubectl argo rollouts get rollout "$RELEASE_NAME" \
    --namespace "$NAMESPACE" \
    --watch
}

# Promote the rollout (make preview become active)
promote() {
  log_step "Promoting rollout $RELEASE_NAME in $NAMESPACE..."

  # Check current status
  STATUS=$(kubectl argo rollouts status "$RELEASE_NAME" \
    --namespace "$NAMESPACE" \
    --timeout 5s 2>&1 || echo "Unknown")

  if echo "$STATUS" | grep -q "Paused"; then
    log_info "Rollout is paused, promoting..."
    kubectl argo rollouts promote "$RELEASE_NAME" \
      --namespace "$NAMESPACE"
    log_success "Rollout promoted successfully"
  elif echo "$STATUS" | grep -q "Healthy"; then
    log_warn "Rollout is already healthy, nothing to promote"
  else
    log_warn "Current status: $STATUS"
    log_info "Attempting promotion anyway..."
    kubectl argo rollouts promote "$RELEASE_NAME" \
      --namespace "$NAMESPACE" || true
  fi

  echo ""
  get_status
}

# Abort the rollout (rollback to previous)
abort() {
  log_step "Aborting rollout $RELEASE_NAME in $NAMESPACE..."

  kubectl argo rollouts abort "$RELEASE_NAME" \
    --namespace "$NAMESPACE"

  log_success "Rollout aborted, rolling back to stable version"
  echo ""
  get_status
}

# Retry a failed rollout
retry() {
  log_step "Retrying rollout $RELEASE_NAME in $NAMESPACE..."

  kubectl argo rollouts retry rollout "$RELEASE_NAME" \
    --namespace "$NAMESPACE"

  log_success "Rollout retry initiated"
  echo ""
  get_status
}

# Set image for new deployment
set_image() {
  local IMAGE="${2:-}"

  if [[ -z "$IMAGE" ]]; then
    log_error "Image tag required. Usage: $0 set-image <image:tag>"
    exit 1
  fi

  log_step "Setting new image: $IMAGE"

  kubectl argo rollouts set image "$RELEASE_NAME" \
    --namespace "$NAMESPACE" \
    "*=$IMAGE"

  log_success "Image updated, rollout started"
  echo ""

  # Watch the rollout
  watch_rollout
}

# Restart the rollout (recreate pods)
restart() {
  log_step "Restarting rollout $RELEASE_NAME in $NAMESPACE..."

  kubectl argo rollouts restart "$RELEASE_NAME" \
    --namespace "$NAMESPACE"

  log_success "Rollout restart initiated"
  echo ""
  get_status
}

# Pause the rollout
pause() {
  log_step "Pausing rollout $RELEASE_NAME in $NAMESPACE..."

  kubectl argo rollouts pause "$RELEASE_NAME" \
    --namespace "$NAMESPACE"

  log_success "Rollout paused"
}

# Resume the rollout
resume() {
  log_step "Resuming rollout $RELEASE_NAME in $NAMESPACE..."

  kubectl argo rollouts resume "$RELEASE_NAME" \
    --namespace "$NAMESPACE"

  log_success "Rollout resumed"
  echo ""
  get_status
}

# Undo the rollout (go back one revision)
undo() {
  local REVISION="${2:-}"

  log_step "Undoing rollout $RELEASE_NAME in $NAMESPACE..."

  if [[ -n "$REVISION" ]]; then
    log_info "Rolling back to revision: $REVISION"
    kubectl argo rollouts undo "$RELEASE_NAME" \
      --namespace "$NAMESPACE" \
      --to-revision="$REVISION"
  else
    log_info "Rolling back to previous revision"
    kubectl argo rollouts undo "$RELEASE_NAME" \
      --namespace "$NAMESPACE"
  fi

  log_success "Rollback initiated"
  echo ""
  get_status
}

# Show rollout history
history() {
  log_info "Rollout history for $RELEASE_NAME in $NAMESPACE:"
  echo ""

  kubectl argo rollouts history "$RELEASE_NAME" \
    --namespace "$NAMESPACE"
}

# Show analysis results
analysis() {
  log_info "Analysis runs for $RELEASE_NAME in $NAMESPACE:"
  echo ""

  kubectl get analysisrun \
    --namespace "$NAMESPACE" \
    -l rollout-name="$RELEASE_NAME" \
    --sort-by=.metadata.creationTimestamp

  echo ""

  # Get latest analysis details
  LATEST=$(kubectl get analysisrun \
    --namespace "$NAMESPACE" \
    -l rollout-name="$RELEASE_NAME" \
    --sort-by=.metadata.creationTimestamp \
    -o jsonpath='{.items[-1].metadata.name}' 2>/dev/null || echo "")

  if [[ -n "$LATEST" ]]; then
    log_info "Latest analysis: $LATEST"
    kubectl describe analysisrun "$LATEST" --namespace "$NAMESPACE"
  fi
}

# Deploy new version
deploy() {
  local IMAGE="${2:-}"
  local VALUES_FILE="${3:-}"

  if [[ -z "$IMAGE" ]]; then
    log_error "Image required. Usage: $0 deploy <image:tag> [values-file]"
    exit 1
  fi

  log_step "Deploying new version: $IMAGE"

  # Build Helm upgrade command
  HELM_ARGS="upgrade $RELEASE_NAME $PROJECT_ROOT/kubernetes/helm/agentsmith \
    --namespace $NAMESPACE \
    --set image.tag=${IMAGE##*:} \
    --set blueGreen.enabled=true \
    --wait \
    --timeout ${TIMEOUT}s"

  if [[ -n "$VALUES_FILE" ]] && [[ -f "$VALUES_FILE" ]]; then
    HELM_ARGS="$HELM_ARGS --values $VALUES_FILE"
  fi

  log_info "Running: helm $HELM_ARGS"
  helm $HELM_ARGS

  log_success "Deployment initiated"
  echo ""

  # Watch the rollout
  watch_rollout
}

# Show help
show_help() {
  echo "AgentSmith Blue-Green Deployment Manager"
  echo ""
  echo "Usage: $0 <action> [options]"
  echo ""
  echo "Actions:"
  echo "  status          Show current rollout status"
  echo "  watch           Watch rollout in real-time"
  echo "  promote         Promote preview to active (complete deployment)"
  echo "  abort           Abort deployment and rollback"
  echo "  retry           Retry a failed rollout"
  echo "  set-image       Set new image and start rollout"
  echo "  restart         Restart all pods"
  echo "  pause           Pause the rollout"
  echo "  resume          Resume a paused rollout"
  echo "  undo [rev]      Rollback to previous/specific revision"
  echo "  history         Show rollout revision history"
  echo "  analysis        Show analysis run results"
  echo "  deploy          Deploy new version with Helm"
  echo "  help            Show this help message"
  echo ""
  echo "Environment variables:"
  echo "  NAMESPACE       Kubernetes namespace (default: agentsmith)"
  echo "  RELEASE_NAME    Helm release name (default: agentsmith)"
  echo "  TIMEOUT         Deployment timeout in seconds (default: 600)"
  echo ""
  echo "Examples:"
  echo "  $0 status"
  echo "  $0 set-image docker.io/agentsmith/agentsmith:v1.2.3"
  echo "  $0 promote"
  echo "  $0 abort"
  echo "  $0 undo 3"
  echo "  NAMESPACE=staging $0 deploy agentsmith:v1.2.3 values-staging.yaml"
}

# Main
main() {
  case "$ACTION" in
    status)
      check_prerequisites
      get_status
      ;;
    watch)
      check_prerequisites
      watch_rollout
      ;;
    promote)
      check_prerequisites
      promote
      ;;
    abort)
      check_prerequisites
      abort
      ;;
    retry)
      check_prerequisites
      retry
      ;;
    set-image)
      check_prerequisites
      set_image "$@"
      ;;
    restart)
      check_prerequisites
      restart
      ;;
    pause)
      check_prerequisites
      pause
      ;;
    resume)
      check_prerequisites
      resume
      ;;
    undo)
      check_prerequisites
      undo "$@"
      ;;
    history)
      check_prerequisites
      history
      ;;
    analysis)
      check_prerequisites
      analysis
      ;;
    deploy)
      check_prerequisites
      deploy "$@"
      ;;
    help|--help|-h)
      show_help
      ;;
    *)
      log_error "Unknown action: $ACTION"
      echo ""
      show_help
      exit 1
      ;;
  esac
}

main "$@"
