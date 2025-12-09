/**
 * Windows Service Installation Script
 * Requirements: 6.1 - Deploy client as Windows service
 * 
 * Usage:
 *   node install-windows-service.js install   - Install the service
 *   node install-windows-service.js uninstall - Uninstall the service
 */

const Service = require('node-windows').Service;
const path = require('path');
const fs = require('fs');

// Service configuration
const SERVICE_NAME = 'SystemMonitorClient';
const SERVICE_DESCRIPTION = 'System Monitor Client - Collects and reports system metrics';

// Path to the main script (must be absolute)
const SCRIPT_PATH = path.join(__dirname, 'dist', 'index.js');

// Check if the script exists
if (!fs.existsSync(SCRIPT_PATH)) {
  console.error('Error: dist/index.js not found!');
  console.error('Please run "npm run build" first to compile the TypeScript code.');
  process.exit(1);
}

// Create a new service object
const svc = new Service({
  name: SERVICE_NAME,
  description: SERVICE_DESCRIPTION,
  script: SCRIPT_PATH,
  nodeOptions: [
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: 'NODE_ENV',
      value: 'production'
    }
  ]
});

// Get command from arguments
const command = process.argv[2];

if (command === 'install') {
  // Install the service
  console.log(`Installing ${SERVICE_NAME} as a Windows service...`);
  console.log(`Script path: ${SCRIPT_PATH}`);
  
  svc.on('install', () => {
    console.log(`✓ ${SERVICE_NAME} installed successfully!`);
    console.log('Starting the service...');
    svc.start();
  });

  svc.on('alreadyinstalled', () => {
    console.log(`${SERVICE_NAME} is already installed.`);
    console.log('To reinstall, first run: node install-windows-service.js uninstall');
  });

  svc.on('start', () => {
    console.log(`✓ ${SERVICE_NAME} started successfully!`);
    console.log('\nService Management Commands:');
    console.log('  Start:   net start ' + SERVICE_NAME);
    console.log('  Stop:    net stop ' + SERVICE_NAME);
    console.log('  Restart: net stop ' + SERVICE_NAME + ' && net start ' + SERVICE_NAME);
    console.log('\nYou can also manage the service through Windows Services (services.msc)');
  });

  svc.on('error', (err) => {
    console.error('Error:', err);
  });

  svc.install();

} else if (command === 'uninstall') {
  // Uninstall the service
  console.log(`Uninstalling ${SERVICE_NAME}...`);
  
  svc.on('uninstall', () => {
    console.log(`✓ ${SERVICE_NAME} uninstalled successfully!`);
  });

  svc.on('alreadyuninstalled', () => {
    console.log(`${SERVICE_NAME} is not installed.`);
  });

  svc.on('error', (err) => {
    console.error('Error:', err);
  });

  svc.uninstall();

} else {
  // Show usage
  console.log('Windows Service Installation Script');
  console.log('');
  console.log('Usage:');
  console.log('  node install-windows-service.js install   - Install and start the service');
  console.log('  node install-windows-service.js uninstall - Stop and uninstall the service');
  console.log('');
  console.log('Prerequisites:');
  console.log('  1. Run "npm run build" to compile TypeScript code');
  console.log('  2. Create config.json with your configuration');
  console.log('  3. Run this script with administrator privileges');
  console.log('');
  console.log('Note: This script requires node-windows package.');
  console.log('Install it with: npm install --save-dev node-windows');
}
