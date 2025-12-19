/**
 * Main entry point for the system monitor client
 */

import { ConfigManager } from './config';
import { SystemCollector } from './collector';
import { Reporter } from './reporter';
import { Logger } from './utils/logger';

/**
 * MonitorClient class
 * Main client program that orchestrates collection and reporting
 */
class MonitorClient {
  private config: ReturnType<ConfigManager['loadConfig']>;
  private collector: SystemCollector;
  private reporter: Reporter;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MonitorClient');

    // Load configuration
    const configManager = new ConfigManager();
    this.config = configManager.loadConfig();

    // Initialize collector and reporter
    this.collector = new SystemCollector(this.config);
    this.reporter = new Reporter(this.config);
  }

  /**
   * Start the monitoring client
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Client is already running');
      return;
    }

    this.logger.info('Starting System Monitor Client...');
    this.logger.info(`Client Name: ${this.config.clientName}`);
    this.logger.info(`Server URL: ${this.config.serverUrl}`);
    this.logger.info(`Report Interval: ${this.config.reportInterval}ms`);
    this.logger.info(`Tags: ${this.config.clientTags.join(', ') || 'None'}`);
    this.logger.info(`Purpose: ${this.config.clientPurpose || 'Not specified'}`);

    try {
      // Collect static system information at startup
      this.logger.info('Collecting static system information...');
      const staticInfo = await this.collector.collectStaticInfo();
      this.reporter.setStaticInfo(staticInfo);
      this.logger.info('Static system information collected successfully');

      // Try to send any cached reports from previous runs
      this.logger.info('Checking for cached reports...');
      await this.reporter.retryCachedReports();

      // Mark as running
      this.isRunning = true;

      // Start the periodic collection and reporting loop
      this.startReportingLoop();

      this.logger.info('System Monitor Client started successfully');
    } catch (error) {
      this.logger.error('Failed to start client', error);
      throw error;
    }
  }

  /**
   * Start the periodic reporting loop
   * Requirements: 1.1, 2.1 - Periodically collect and report system status
   */
  private startReportingLoop(): void {
    // Immediately collect and report once
    this.collectAndReport();

    // Then set up periodic collection and reporting
    this.intervalId = setInterval(() => {
      this.collectAndReport();
    }, this.config.reportInterval);
  }

  /**
   * Collect current system status and report to server
   * Periodically collect dynamic system status
   * Report data to server
   */
  private async collectAndReport(): Promise<void> {
    try {
      // Collect dynamic system status
      const dynamicStatus = await this.collector.collectDynamicStatus();

      // Build report payload
      const payload = this.reporter.buildPayload(dynamicStatus);

      // Report to server
      await this.reporter.report(payload);

      this.logger.info('Report sent successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('collect')) {
        this.logger.error('Failed to collect system status', error);
      } else {
        this.logger.error('Failed to report data to server', error);
      }
      // Error handling is done in the reporter (caching)
      // The loop will continue and retry in the next interval
    }
  }

  /**
   * Stop the monitoring client
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger.warn('Client is not running');
      return;
    }

    this.logger.info('Stopping System Monitor Client...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.logger.info('System Monitor Client stopped');
  }

  /**
   * Check if the client is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Main function to run the client
 * Handle errors and log them with stack traces
 */
async function main() {
  const logger = new Logger('Main');
  const client = new MonitorClient();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    client.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    client.stop();
    process.exit(0);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', reason);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
    client.stop();
    process.exit(1);
  });

  try {
    await client.start();
  } catch (error) {
    logger.error('Fatal error during startup', error);
    process.exit(1);
  }
}

// Run the client if this is the main module
if (require.main === module) {
  main();
}

export { MonitorClient };
