#!/bin/bash
# macOS Service Installation Script
# Requirements: 6.1 - Deploy client as macOS launchd service
#
# This script helps install the System Monitor Client as a launchd service

set -e

SERVICE_NAME="com.systemmonitor.client"
PLIST_FILE="com.systemmonitor.client.plist"
INSTALL_DIR="/opt/system-monitor-client"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Function to detect installation type
get_install_type() {
  if [ "$EUID" -eq 0 ]; then
    echo "system"
  else
    echo "user"
  fi
}

# Function to get the appropriate launchd directory
get_launchd_dir() {
  local install_type=$1
  if [ "$install_type" = "system" ]; then
    echo "/Library/LaunchDaemons"
  else
    echo "$HOME/Library/LaunchAgents"
  fi
}

# Function to install the service
install_service() {
  local install_type=$(get_install_type)
  local launchd_dir=$(get_launchd_dir "$install_type")
  
  echo "Installing System Monitor Client as a launchd service..."
  echo "Installation type: $install_type"
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

  # Check if Node.js is installed
  if ! command -v node &> /dev/null; then
    print_error "Node.js not found!"
    echo "Please install Node.js first."
    exit 1
  fi

  local node_path=$(which node)
  print_info "Node.js found at: $node_path"

  # Create installation directory
  if [ "$install_type" = "system" ]; then
    print_info "Creating installation directory: $INSTALL_DIR (requires sudo)"
    sudo mkdir -p "$INSTALL_DIR"
  else
    print_info "Creating installation directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
  fi

  # Copy files to installation directory
  print_info "Copying files to $INSTALL_DIR"
  if [ "$install_type" = "system" ]; then
    sudo cp -r dist "$INSTALL_DIR/"
    sudo cp -r node_modules "$INSTALL_DIR/"
    sudo cp config.json "$INSTALL_DIR/"
    sudo cp package.json "$INSTALL_DIR/"
  else
    cp -r dist "$INSTALL_DIR/"
    cp -r node_modules "$INSTALL_DIR/"
    cp config.json "$INSTALL_DIR/"
    cp package.json "$INSTALL_DIR/"
  fi

  # Update plist file with correct paths
  print_info "Configuring service file"
  sed "s|<string>/usr/local/bin/node</string>|<string>$node_path</string>|g" "$PLIST_FILE" > /tmp/com.systemmonitor.client.plist.tmp
  sed -i '' "s|<string>/opt/system-monitor-client/dist/index.js</string>|<string>$INSTALL_DIR/dist/index.js</string>|g" /tmp/com.systemmonitor.client.plist.tmp
  sed -i '' "s|<string>/opt/system-monitor-client</string>|<string>$INSTALL_DIR</string>|g" /tmp/com.systemmonitor.client.plist.tmp

  # Create launchd directory if it doesn't exist
  if [ ! -d "$launchd_dir" ]; then
    print_info "Creating launchd directory: $launchd_dir"
    if [ "$install_type" = "system" ]; then
      sudo mkdir -p "$launchd_dir"
    else
      mkdir -p "$launchd_dir"
    fi
  fi

  # Copy plist file to launchd directory
  print_info "Installing service file to $launchd_dir"
  if [ "$install_type" = "system" ]; then
    sudo cp /tmp/com.systemmonitor.client.plist.tmp "$launchd_dir/$PLIST_FILE"
    sudo chmod 644 "$launchd_dir/$PLIST_FILE"
    sudo chown root:wheel "$launchd_dir/$PLIST_FILE"
  else
    cp /tmp/com.systemmonitor.client.plist.tmp "$launchd_dir/$PLIST_FILE"
    chmod 644 "$launchd_dir/$PLIST_FILE"
  fi
  rm /tmp/com.systemmonitor.client.plist.tmp

  # Load the service
  print_info "Loading service"
  if [ "$install_type" = "system" ]; then
    sudo launchctl load "$launchd_dir/$PLIST_FILE"
  else
    launchctl load "$launchd_dir/$PLIST_FILE"
  fi

  echo ""
  print_success "System Monitor Client installed successfully!"
  echo ""
  echo "Service Management Commands:"
  if [ "$install_type" = "system" ]; then
    echo "  Load:    sudo launchctl load $launchd_dir/$PLIST_FILE"
    echo "  Unload:  sudo launchctl unload $launchd_dir/$PLIST_FILE"
    echo "  Start:   sudo launchctl start $SERVICE_NAME"
    echo "  Stop:    sudo launchctl stop $SERVICE_NAME"
  else
    echo "  Load:    launchctl load $launchd_dir/$PLIST_FILE"
    echo "  Unload:  launchctl unload $launchd_dir/$PLIST_FILE"
    echo "  Start:   launchctl start $SERVICE_NAME"
    echo "  Stop:    launchctl stop $SERVICE_NAME"
  fi
  echo "  Status:  launchctl list | grep systemmonitor"
  echo "  Logs:    tail -f /tmp/system-monitor-client.log"
  echo "  Errors:  tail -f /tmp/system-monitor-client.error.log"
  echo ""
  echo "The service will start automatically on system boot."
}

# Function to uninstall the service
uninstall_service() {
  local install_type=$(get_install_type)
  local launchd_dir=$(get_launchd_dir "$install_type")
  
  echo "Uninstalling System Monitor Client service..."
  echo ""

  # Check if service is loaded
  if launchctl list | grep -q "$SERVICE_NAME"; then
    print_info "Unloading service"
    if [ "$install_type" = "system" ]; then
      sudo launchctl unload "$launchd_dir/$PLIST_FILE" 2>/dev/null || true
    else
      launchctl unload "$launchd_dir/$PLIST_FILE" 2>/dev/null || true
    fi
  fi

  # Remove plist file
  if [ -f "$launchd_dir/$PLIST_FILE" ]; then
    print_info "Removing service file"
    if [ "$install_type" = "system" ]; then
      sudo rm "$launchd_dir/$PLIST_FILE"
    else
      rm "$launchd_dir/$PLIST_FILE"
    fi
  fi

  # Ask if user wants to remove installation directory
  echo ""
  read -p "Do you want to remove the installation directory ($INSTALL_DIR)? [y/N] " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Removing installation directory"
    if [ "$install_type" = "system" ]; then
      sudo rm -rf "$INSTALL_DIR"
    else
      rm -rf "$INSTALL_DIR"
    fi
  fi

  # Remove log files
  echo ""
  read -p "Do you want to remove log files? [y/N] " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Removing log files"
    rm -f /tmp/system-monitor-client.log
    rm -f /tmp/system-monitor-client.error.log
  fi

  echo ""
  print_success "System Monitor Client uninstalled successfully!"
}

# Function to show service status
show_status() {
  echo "Service Status:"
  echo ""
  
  if launchctl list | grep -q "$SERVICE_NAME"; then
    print_success "Service is loaded"
    echo ""
    launchctl list | grep systemmonitor
    echo ""
    echo "Recent logs:"
    if [ -f /tmp/system-monitor-client.log ]; then
      tail -20 /tmp/system-monitor-client.log
    else
      echo "No logs found at /tmp/system-monitor-client.log"
    fi
  else
    print_error "Service is not loaded"
  fi
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
    echo "macOS Service Installation Script"
    echo ""
    echo "Usage:"
    echo "  ./install-macos-service.sh install   - Install and start the service"
    echo "  ./install-macos-service.sh uninstall - Stop and uninstall the service"
    echo "  ./install-macos-service.sh status    - Show service status"
    echo ""
    echo "Installation Types:"
    echo "  User:   Run without sudo (installs to ~/Library/LaunchAgents)"
    echo "  System: Run with sudo (installs to /Library/LaunchDaemons)"
    echo ""
    echo "Prerequisites:"
    echo "  1. Run 'npm install' to install dependencies"
    echo "  2. Run 'npm run build' to compile TypeScript code"
    echo "  3. Create config.json with your configuration"
    echo ""
    echo "Note: User installation is recommended for testing."
    echo "      System installation requires sudo and runs at system startup."
    exit 1
    ;;
esac
