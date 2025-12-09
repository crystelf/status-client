import axios, { AxiosError } from 'axios';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ReportPayload, CachedReport } from './types';
import { StaticSystemInfo, DynamicSystemStatus } from '../collector';
import { ClientConfig } from '../config';
import { Logger } from '../utils/logger';

/**
 * Reporter class
 * Responsible for reporting collected data to the server
 * Handle reporting, caching, and retry logic
 * Error handling and logging
 */
export class Reporter {
  private clientId: string;
  private config: ClientConfig;
  private cache: CachedReport[] = [];
  private cacheFilePath: string;
  private staticInfo: StaticSystemInfo | null = null;
  private logger: Logger;

  constructor(config: ClientConfig, cacheDir: string = '.cache') {
    this.logger = new Logger('Reporter');
    this.config = config;
    this.cacheFilePath = path.join(cacheDir, 'failed-reports.json');

    // Load or generate client ID
    this.clientId = this.loadOrGenerateClientId(cacheDir);

    // Load cached reports from disk
    this.loadCacheFromDisk();
  }

  /**
   * Load or generate a persistent client ID
   * The client ID is stored in a file to persist across restarts
   * Log errors with details
   */
  private loadOrGenerateClientId(cacheDir: string): string {
    const idFilePath = path.join(cacheDir, 'client-id.txt');

    try {
      // Create cache directory if it doesn't exist
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // Try to load existing ID
      if (fs.existsSync(idFilePath)) {
        const id = fs.readFileSync(idFilePath, 'utf-8').trim();
        if (id) {
          return id;
        }
      }

      // Generate new ID
      const newId = uuidv4();
      fs.writeFileSync(idFilePath, newId, 'utf-8');
      return newId;
    } catch (error) {
      this.logger.error('Error loading/generating client ID', error);
      // Fallback to generating a new ID without persistence
      return uuidv4();
    }
  }

  /**
   * Set static system information
   * This should be called once at startup with the collected static info
   */
  setStaticInfo(staticInfo: StaticSystemInfo): void {
    this.staticInfo = staticInfo;
  }

  /**
   * Build report payload
   * Assemble complete report payload with all required fields
   * @param dynamicStatus Current dynamic system status
   * @returns Complete report payload
   */
  buildPayload(dynamicStatus: DynamicSystemStatus): ReportPayload {
    if (!this.staticInfo) {
      throw new Error('Static system info not set. Call setStaticInfo() first.');
    }

    const platform = os.platform();
    const platformName =
      platform === 'win32' ? 'windows' : platform === 'darwin' ? 'darwin' : 'linux';

    return {
      clientId: this.clientId,
      clientName: this.config.clientName,
      clientTags: this.config.clientTags,
      clientPurpose: this.config.clientPurpose,
      hostname: os.hostname(),
      platform: platformName,
      staticInfo: this.staticInfo,
      dynamicStatus: dynamicStatus,
    };
  }

  /**
   * Report data to server
   * Send data to server via HTTP POST
   * Cache data on failure
   * Clear cache on success
   * Log errors with details
   * @param payload Report payload to send
   */
  async report(payload: ReportPayload): Promise<void> {
    try {
      // Send HTTP POST request to server
      const response = await axios.post(`${this.config.serverUrl}/api/reports`, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.info('Report sent successfully');
        // Clear cache on successful report
        this.clearCache();
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (error) {
      this.logger.error('Failed to send report: ' + this.getErrorMessage(error), error);
      this.cacheFailedReport(payload);
      throw error;
    }
  }

  /**
   * Cache a failed report
   * Cache data when report fails or network is unavailable
   * @param payload Report payload to cache
   */
  cacheFailedReport(payload: ReportPayload): void {
    const cachedReport: CachedReport = {
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Add to in-memory cache
    this.cache.push(cachedReport);

    // Enforce cache size limit
    if (this.cache.length > this.config.cacheSize) {
      // Remove oldest entries
      this.cache = this.cache.slice(-this.config.cacheSize);
      this.logger.warn(`Cache size limit reached. Removed oldest entries.`);
    }

    // Persist cache to disk
    this.saveCacheToDisk();
    this.logger.info(`Report cached. Total cached reports: ${this.cache.length}`);
  }

  /**
   * Retry sending cached reports
   * Attempts to send all cached reports to the server
   * Log errors during retry
   */
  async retryCachedReports(): Promise<void> {
    if (this.cache.length === 0) {
      return;
    }

    this.logger.info(`Retrying ${this.cache.length} cached reports...`);
    const failedReports: CachedReport[] = [];

    for (const cachedReport of this.cache) {
      try {
        // Attempt to send the cached report
        const response = await axios.post(
          `${this.config.serverUrl}/api/reports`,
          cachedReport.payload,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        if (response.status >= 200 && response.status < 300) {
          this.logger.info('Cached report sent successfully');
          // Don't add to failedReports - it succeeded
        } else {
          throw new Error(`Server returned status ${response.status}`);
        }
      } catch (error) {
        // Increment retry count
        cachedReport.retryCount++;
        // Only keep if under max retries
        if (cachedReport.retryCount < this.config.maxRetries) {
          failedReports.push(cachedReport);
        } else {
          this.logger.warn(
            `Dropping cached report after ${this.config.maxRetries} failed attempts`
          );
        }
      }
    }

    // Update cache with only the failed reports
    this.cache = failedReports;
    this.saveCacheToDisk();

    if (this.cache.length > 0) {
      this.logger.info(`${this.cache.length} reports still cached after retry`);
    } else {
      this.logger.info('All cached reports sent successfully');
    }
  }

  /**
   * Clear all cached reports
   * Clear cache after successful report
   */
  clearCache(): void {
    if (this.cache.length > 0) {
      this.cache = [];
      this.saveCacheToDisk();
      this.logger.info('Cache cleared');
    }
  }

  /**
   * Get the number of cached reports
   */
  getCacheSize(): number {
    return this.cache.length;
  }

  /**
   * Save cache to disk for persistence
   * Persist cached data locally
   */
  private saveCacheToDisk(): void {
    try {
      const cacheDir = path.dirname(this.cacheFilePath);

      // Create cache directory if it doesn't exist
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // Write cache to file
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Error saving cache to disk', error);
    }
  }

  /**
   * Load cache from disk
   * Load persisted cached data on startup
   */
  private loadCacheFromDisk(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const cacheContent = fs.readFileSync(this.cacheFilePath, 'utf-8');
        this.cache = JSON.parse(cacheContent) as CachedReport[];
        this.logger.info(`Loaded ${this.cache.length} cached reports from disk`);
      }
    } catch (error) {
      this.logger.error('Error loading cache from disk', error);
      this.cache = [];
    }
  }

  /**
   * Extract error message from various error types
   */
  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        return `Server error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`;
      } else if (axiosError.request) {
        return 'No response from server (network error)';
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
