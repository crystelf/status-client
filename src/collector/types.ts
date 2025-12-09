/**
 * Static system information interface
 * Contains hardware and system information that doesn't change frequently
 */
export interface StaticSystemInfo {
  cpuModel: string;             // CPU model name
  cpuCores: number;             // Number of CPU cores
  cpuArch: string;              // CPU architecture (x86_64, arm64, arm, x86, etc.)
  systemVersion: string;        // OS version (e.g., Windows 11, Ubuntu 22.04)
  systemModel: string;          // System model/manufacturer
  totalMemory: number;          // Total memory in bytes
  totalSwap: number;            // Total swap space in bytes
  totalDisk: number;            // Total disk capacity in bytes
  diskType: string;             // Disk type (SSD, HDD, NVMe, etc.)
  location: string;             // Client geographic location (country/city)
}

/**
 * Dynamic system status interface
 * Contains real-time system metrics that change frequently
 */
export interface DynamicSystemStatus {
  cpuUsage: number;             // CPU usage percentage (0-100)
  cpuFrequency: number;         // Current CPU frequency in GHz
  memoryUsage: number;          // Memory usage percentage (0-100)
  swapUsage: number;            // Swap usage percentage (0-100)
  diskUsage: number;            // Disk usage percentage (0-100)
  networkUpload: number;        // Network upload speed in bytes/second
  networkDownload: number;      // Network download speed in bytes/second
  timestamp: number;            // Collection timestamp (Unix milliseconds)
}
