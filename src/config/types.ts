/**
 * Client configuration interface
 * Defines all configuration options for the monitoring client
 */
export interface ClientConfig {
  clientName: string;          // Client custom name
  clientTags: string[];        // Client tags list
  clientPurpose: string;       // Client purpose description
  serverUrl: string;           // Server endpoint URL
  reportInterval: number;      // Report interval in milliseconds
  minReportInterval: number;   // Minimum allowed report interval in milliseconds
  maxRetries: number;          // Maximum retry attempts for failed reports
  cacheSize: number;           // Local cache size limit
}
