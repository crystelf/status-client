#!/bin/bash
# Linux Service Installation Script
# Requirements: 6.1 - Deploy client as Linux systemd service
#
# This script helps install the System Monitor Client as a systemd service

set -e

SERVICE_NAME="system-monitor-client"
SERVICE_FILE="system-monitor-client.service"
SYSTEMD_DIR="/etc/systemd/system"
INSTALL_DIR="/opt/system-monitor-client"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
  exit 1
fi

# Function to print colored messages
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${YELLOW}→ $1${NC}"
}

# Function to install the service
install_service() {
  echo "Installing System Monitor Client as a systemd service..."
  echo ""

  # Check if dist/index.js exists
  if [ ! -f "dist/index.js" ]; then
    print_error "dist/index.js not found!"
    echo "Please run 'npm run build' first to compile the TypeScript code."
    exit 1
  fi

  # Check if config.json exists
  if [ ! -f "config.json" ]; then
    print_error "config.json not found!"
    echo "Please create config.json with your configuration."
    echo "You can copy config.example.json as a starting point:"
    echo "  cp config.example.json config.json"
    exit 1
  fi

  # Create installation directory
  print_info "Creating installation directory: $INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"

  # Copy files to installation directory
  print_info "Copying files to $INSTALL_DIR"
  cp -r dist "$INSTALL_DIR/"
  cp -r node_modules "$INSTALL_DIR/"
  cp config.json "$INSTALL_DIR/"
  cp package.json "$INSTALL_DIR/"

  # Update service file with correct paths
  print_info "Configuring service file"
  sed "s|WorkingDirectory=.*|WorkingDirectory=$INSTALL_DIR|g" "$SERVICE_FILE" > /tmp/system-monitor-client.service.tmp
  sed -i "s|ExecStart=.*|ExecStart=$(which node) dist/index.js|g" /tmp/system-monitor-client.service.tmp

  # Copy service file to systemd directory
  print_info "Installing service file to $SYSTEMD_DIR"
  cp /tmp/system-monitor-client.service.tmp "$SYSTEMD_DIR/$SERVICE_FILE"
  rm /tmp/system-monitor-client.service.tmp

  # Set proper permissions
  chmod 644 "$SYSTEMD_DIR/$SERVICE_FILE"

  # Reload systemd daemon
  print_info "Reloading systemd daemon"
  systemctl daemon-reload

  # Enable service to start on boot
  print_info "Enabling service to start on boot"
  systemctl enable "$SERVICE_NAME"

  # Start the service
  print_info "Starting service"
  systemctl start "$SERVICE_NAME"

  echo ""
  print_success "System Monitor Client installed successfully!"
  echo ""
  echo "Service Management Commands:"
  echo "  Start:   sudo systemctl start $SERVICE_NAME"
  echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
  echo "  Restart: sudo systemctl restart $SERVICE_NAME"
  echo "  Status:  sudo systemctl status $SERVICE_NAME"
  echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
  echo ""
  echo "Current status:"
  systemctl status "$SERVICE_NAME" --no-pager
}

# Function to uninstall the service
uninstall_service() {
  echo "Uninstalling System Monitor Client service..."
  echo ""

  # Stop the service
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    print_info "Stopping service"
    systemctl stop "$SERVICE_NAME"
  fi

  # Disable the service
  if systemctl is-enabled --quiet "$SERVICE_NAME"; then
    print_info "Disabling service"
    systemctl disable "$SERVICE_NAME"
  fi

  # Remove service file
  if [ -f "$SYSTEMD_DIR/$SERVICE_FILE" ]; then
    print_info "Removing service file"
    rm "$SYSTEMD_DIR/$SERVICE_FILE"
  fi

  # Reload systemd daemon
  print_info "Reloading systemd daemon"
  systemctl daemon-reload

  # Ask if user wants to remove installation directory
  echo ""
  read -p "Do you want to remove the installation directory ($INSTALL_DIR)? [y/N] " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Removing installation directory"
    rm -rf "$INSTALL_DIR"
  fi

  echo ""
  print_success "System Monitor Client uninstalled successfully!"
}

# Function to show service status
show_status() {
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    print_success "Service is running"
  else
    print_error "Service is not running"
  fi
  echo ""
  systemctl status "$SERVICE_NAME" --no-pager
}

# Main script logic
case "${1:-}" in
  install)
    install_service
    ;;
  uninstall)
    uninstall_service
    ;;
  status)
    show_status
    ;;
  *)
    echo "Linux Service Installation Script"
    echo ""
    echo "Usage:"
    echo "  sudo ./install-linux-service.sh install   - Install and start the service"
    echo "  sudo ./install-linux-service.sh uninstall - Stop and uninstall the service"
    echo "  sudo ./install-linux-service.sh status    - Show service status"
    echo ""
    echo "Prerequisites:"
    echo "  1. Run 'npm install' to install dependencies"
    echo "  2. Run 'npm run build' to compile TypeScript code"
    echo "  3. Create config.json with your configuration"
    echo "  4. Run this script with sudo"
    exit 1
    ;;
esac
