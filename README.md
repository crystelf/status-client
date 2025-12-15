# Status-Client

The monitoring client that collects system information and reports it to the monitoring server.

## Features

- Collects static system information (CPU, memory, disk, etc.)
- Periodically collects dynamic system status (CPU usage, memory usage, etc.)
- Reports data to the monitoring server
- Caches failed reports and retries automatically
- Comprehensive error handling and logging
- Cross-platform support (Windows, Linux, macOS)

## Installation

```bash
npm install
npm run build
#or use pnpm √
```

## Configuration

Create a `config.json` file in the client directory. See `config.example.json` for reference:

```bash
cp config.example.json config.json
nano config.json
```

```json
{
  "clientName": "My Server",
  "clientTags": ["production", "web-server", "us-east"],
  "clientPurpose": "Main production web server",
  "serverUrl": "http://localhost:7788",
  "reportInterval": 60000,
  "minReportInterval": 10000,
  "maxRetries": 3,
  "cacheSize": 100
}
```

### Configuration Options

- **clientName**: Custom name for this client (defaults to hostname if not specified)
- **clientTags**: Array of tags for categorizing this client
- **clientPurpose**: Description of what this client is used for
- **serverUrl**: URL of the monitoring server
- **reportInterval**: How often to report data (in milliseconds, minimum 10000)
- **minReportInterval**: Minimum allowed report interval (in milliseconds)
- **maxRetries**: Maximum number of retry attempts for failed reports
- **cacheSize**: Maximum number of reports to cache when offline

## Usage

### Production Mode(recommended)

```bash
npm run build
npm start
```

### Development Mode

```bash
npm run dev
```

## How It Works

1. **Startup**: The client loads configuration and collects static system information
2. **Periodic Collection**: Every `reportInterval` milliseconds, the client:
   - Collects current system status (CPU usage, memory usage, etc.)
   - Builds a report payload with both static and dynamic data
   - Sends the report to the server
3. **Error Handling**:
   - If collection fails, the error is logged and the client retries in the next cycle
   - If reporting fails, the data is cached locally and retried later
   - Cached reports are automatically sent when the connection is restored

## Logging

The client uses structured logging with timestamps and log levels:

- **INFO**: Normal operations (startup, successful reports, etc.)
- **WARN**: Warnings (cache size limit, configuration issues, etc.)
- **ERROR**: Errors with full stack traces (collection failures, network errors, etc.)

## Testing

```bash
npm test
```

## Requirements

- Node.js 18 or higher
- Network access to the monitoring server
- Appropriate system permissions to read system information

## Troubleshooting

### Client won't start

- Check that the configuration file is valid JSON
- Ensure the server URL is correct and accessible
- Check system permissions

### Reports not being sent

- Verify network connectivity to the server
- Check the server logs for errors
- Look for cached reports in the `.cache` directory

### High CPU usage

- Increase the `reportInterval` to reduce collection frequency
- Check for system-specific issues with the `systeminformation` library

---

MIT license ❤