import { ClientConfig } from './types';
import * as os from 'os';
import * as fs from 'fs';

/**
 * ConfigManager class
 * Manages client configuration loading, validation, and default values
 */
export class ConfigManager {
  private configPath: string;

  constructor(configPath: string = 'config.json') {
    this.configPath = configPath;
  }
  /**
   * Get default configuration values
   * Provide default values for missing configuration
   */
  getDefaultConfig(): ClientConfig {
    return {
      clientName: os.hostname(), // Use hostname as default name (Requirement 6.3)
      clientTags: [], // Empty tags by default
      clientPurpose: '', // Empty purpose by default
      serverUrl: 'http://localhost:7788', // Default server URL
      reportInterval: 60000, // Default: 60 seconds
      minReportInterval: 10000, // Minimum: 10 seconds
      maxRetries: 3, // Default: 3 retry attempts
      cacheSize: 100, // Default: cache up to 100 reports
    };
  }

  /**
   * Load configuration from file
   * Read configuration from config file
   * Use default values if config file doesn't exist or fields are missing
   */
  loadConfig(): ClientConfig {
    try {
      // Check if config file exists
      if (!fs.existsSync(this.configPath)) {
        console.log(`Config file not found at ${this.configPath}, using default configuration`);
        return this.getDefaultConfig();
      }

      // Read and parse config file
      const configContent = fs.readFileSync(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configContent) as Partial<ClientConfig>;

      // Validate and merge with defaults
      const validatedConfig = this.validateConfig(parsedConfig);

      console.log('Configuration loaded successfully');
      return validatedConfig;
    } catch (error) {
      console.error('Error loading configuration:', error);
      console.log('Using default configuration');
      return this.getDefaultConfig();
    }
  }

  /**
   * Validate and merge configuration with defaults
   * Validate configuration and use defaults for missing fields
   */
  validateConfig(config: Partial<ClientConfig>): ClientConfig {
    const defaults = this.getDefaultConfig();

    // Merge with defaults
    const merged: ClientConfig = {
      ...defaults,
      ...config,
    };

    // Requirement 6.3: Use hostname if clientName is empty
    if (!merged.clientName || merged.clientName.trim() === '') {
      merged.clientName = os.hostname();
    }

    // Requirement 6.4: Enforce minimum report interval
    if (merged.reportInterval < merged.minReportInterval) {
      console.warn(
        `Report interval ${merged.reportInterval}ms is below minimum ${merged.minReportInterval}ms. ` +
          `Using minimum value.`
      );
      merged.reportInterval = merged.minReportInterval;
    }

    // Ensure arrays are properly initialized
    if (!Array.isArray(merged.clientTags)) {
      merged.clientTags = [];
    }

    return merged;
  }
}
