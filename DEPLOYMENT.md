# Status-Client - Deployment Guide

This guide explains how to deploy the System Monitor Client as a background service on Windows, Linux, and macOS.

## Prerequisites

Before deploying, ensure you have:

1. **Built the project**: Run `npm run build` to compile TypeScript to JavaScript
2. **Created configuration**: Copy `config.example.json` to `config.json` and configure it
3. **Installed dependencies**: Run `npm install` to install all required packages

## Platform-Specific Deployment

### Windows Service

The client can be installed as a Windows service using the `node-windows` package.

#### Installation Steps

1. Install node-windows (if not already installed):
   ```powershell
   npm install --save-dev node-windows
   ```

2. Build the project:
   ```powershell
   npm run build
   ```

3. Create and configure `config.json`

4. Run the installation script with administrator privileges:
   ```powershell
   node install-windows-service.js install
   ```

#### Service Management


- **Start**: `net start SystemMonitorClient`
- **Stop**: `net stop SystemMonitorClient`
- **Restart**: `net stop SystemMonitorClient && net start SystemMonitorClient`
- **Uninstall**: `node install-windows-service.js uninstall`

You can also manage the service through Windows Services (`services.msc`).

#### Files

- `install-windows-service.js` - Installation script

---

### Linux systemd Service

The client can be installed as a systemd service on Linux distributions.

#### Installation Steps

1. Build the project:
   ```bash
   npm run build
   ```

2. Create and configure `config.json`

3. Make the installation script executable:
   ```bash
   chmod +x install-linux-service.sh
   ```

4. Run the installation script with sudo:
   ```bash
   sudo ./install-linux-service.sh install
   ```

The script will:
- Copy files to `/opt/system-monitor-client`
- Install the systemd service file
- Enable the service to start on boot
- Start the service immediately


#### Service Management

- **Start**: `sudo systemctl start system-monitor-client`
- **Stop**: `sudo systemctl stop system-monitor-client`
- **Restart**: `sudo systemctl restart system-monitor-client`
- **Status**: `sudo systemctl status system-monitor-client`
- **Logs**: `sudo journalctl -u system-monitor-client -f`
- **Uninstall**: `sudo ./install-linux-service.sh uninstall`

#### Manual Installation

If you prefer to install manually:

1. Edit `system-monitor-client.service` and update the paths
2. Copy the service file:
   ```bash
   sudo cp system-monitor-client.service /etc/systemd/system/
   ```
3. Reload systemd:
   ```bash
   sudo systemctl daemon-reload
   ```
4. Enable and start:
   ```bash
   sudo systemctl enable system-monitor-client
   sudo systemctl start system-monitor-client
   ```

#### Files

- `system-monitor-client.service` - systemd service file
- `install-linux-service.sh` - Installation script

---


### macOS launchd Service

The client can be installed as a launchd service on macOS.

#### Installation Steps

1. Build the project:
   ```bash
   npm run build
   ```

2. Create and configure `config.json`

3. Make the installation script executable:
   ```bash
   chmod +x install-macos-service.sh
   ```

4. Run the installation script:
   
   **For user installation** (recommended for testing):
   ```bash
   ./install-macos-service.sh install
   ```
   
   **For system-wide installation** (requires sudo):
   ```bash
   sudo ./install-macos-service.sh install
   ```

The script will:
- Copy files to `/opt/system-monitor-client`
- Install the launchd plist file
- Load and start the service

#### Service Management

**User installation**:
- **Load**: `launchctl load ~/Library/LaunchAgents/com.systemmonitor.client.plist`
- **Unload**: `launchctl unload ~/Library/LaunchAgents/com.systemmonitor.client.plist`
- **Start**: `launchctl start com.systemmonitor.client`
- **Stop**: `launchctl stop com.systemmonitor.client`


**System installation**:
- **Load**: `sudo launchctl load /Library/LaunchDaemons/com.systemmonitor.client.plist`
- **Unload**: `sudo launchctl unload /Library/LaunchDaemons/com.systemmonitor.client.plist`
- **Start**: `sudo launchctl start com.systemmonitor.client`
- **Stop**: `sudo launchctl stop com.systemmonitor.client`

**Common commands**:
- **Status**: `launchctl list | grep systemmonitor`
- **Logs**: `tail -f /tmp/system-monitor-client.log`
- **Errors**: `tail -f /tmp/system-monitor-client.error.log`
- **Uninstall**: `./install-macos-service.sh uninstall` (or with sudo)

#### Manual Installation

If you prefer to install manually:

1. Edit `com.systemmonitor.client.plist` and update the paths
2. Copy the plist file:
   ```bash
   # User installation
   cp com.systemmonitor.client.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.systemmonitor.client.plist
   
   # System installation
   sudo cp com.systemmonitor.client.plist /Library/LaunchDaemons/
   sudo launchctl load /Library/LaunchDaemons/com.systemmonitor.client.plist
   ```

#### Files

- `com.systemmonitor.client.plist` - launchd service file
- `install-macos-service.sh` - Installation script


---

## Configuration

Before deploying, create a `config.json` file based on `config.example.json`:

```json
{
  "clientName": "My Server",
  "clientTags": ["production", "web-server"],
  "clientPurpose": "Main web application server",
  "serverUrl": "http://your-server:7788",
  "reportInterval": 60000
}
```

### Configuration Options

- **clientName**: Custom name for this client (defaults to hostname)
- **clientTags**: Array of tags for filtering and grouping
- **clientPurpose**: Description of what this client is used for
- **serverUrl**: URL of the monitoring server
- **reportInterval**: How often to report data (milliseconds, minimum 10000)

## Troubleshooting

### Windows

- **Service won't start**: Check Windows Event Viewer for errors
- **Permission denied**: Run PowerShell as Administrator
- **Node not found**: Ensure Node.js is in system PATH

### Linux

- **Service fails to start**: Check logs with `sudo journalctl -u system-monitor-client -xe`
- **Permission denied**: Ensure script is executable and run with sudo
- **Port already in use**: Check if another instance is running

### macOS

- **Service won't load**: Check syntax with `plutil -lint com.systemmonitor.client.plist`
- **Permission denied**: Ensure script is executable
- **Node not found**: Update the node path in the plist file


## Security Considerations

1. **Run as dedicated user**: Create a dedicated user account for the service (especially on Linux/macOS)
2. **Restrict file permissions**: Ensure config files are only readable by the service user
3. **Use HTTPS**: Configure the server to use HTTPS for secure communication
4. **Firewall rules**: Configure firewall to allow outbound connections to the monitoring server
5. **Keep updated**: Regularly update Node.js and dependencies

## Monitoring the Service

After deployment, verify the service is working:

1. **Check service status** using platform-specific commands
2. **View logs** to ensure data is being collected and reported
3. **Check the monitoring dashboard** to see if data is appearing
4. **Monitor resource usage** to ensure the client isn't consuming excessive resources

## Updating the Client

To update the client to a new version:

1. Stop the service
2. Pull the latest code or copy new files
3. Run `npm install` to update dependencies
4. Run `npm run build` to rebuild
5. Start the service

The service configuration will be preserved.

## Uninstalling

Use the platform-specific uninstall commands:

- **Windows**: `node install-windows-service.js uninstall`
- **Linux**: `sudo ./install-linux-service.sh uninstall`
- **macOS**: `./install-macos-service.sh uninstall` (or with sudo)

This will stop and remove the service. You can optionally remove the installation directory and log files when prompted.
