import { StaticSystemInfo, DynamicSystemStatus } from '../collector';

/**
 * Report payload interface
 * Contains all data sent to the server in each report
 * Requirements: 2.2 - Report must include client ID, name, tags, purpose, hostname, platform, static info, and dynamic status
 */
export interface ReportPayload {
  clientId: string; // Client unique identifier (UUID)
  clientName: string; // Client custom name
  clientTags: string[]; // Client tags list
  clientPurpose: string; // Client purpose description
  hostname: string; // System hostname
  platform: string; // Operating system type (windows, linux, darwin)
  staticInfo: StaticSystemInfo; // Static system information
  dynamicStatus: DynamicSystemStatus; // Dynamic system status
}

/**
 * Cached report entry
 * Used for storing failed reports locally
 */
export interface CachedReport {
  payload: ReportPayload;
  timestamp: number; // When the report was cached
  retryCount: number; // Number of retry attempts
}
