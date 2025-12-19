/**
 * Disk information interface
 * Contains information about a single disk drive
 */
export interface DiskInfo {
  device: string;              // Device identifier (e.g., '/dev/sda', 'C:')
  size: number;                // Disk size in bytes
  type: string;                // Disk type (SSD, HDD, NVMe, etc.)
  interfaceType?: string;      // Interface type (SATA, NVMe, etc.)
}

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
  totalDisk: number;            // Total disk capacity in bytes (sum of all disks)
  disks: DiskInfo[];            // Array of disk information
  location: string;             // Client geographic location (country/city)
  timezone: string;             // Client timezone (e.g., Asia/Shanghai)
}

/**
 * Disk usage information interface
 * Contains usage information for a single disk
 */
export interface DiskUsage {
  device: string;              // Device identifier (e.g., '/dev/sda1', 'C:')
  size: number;                // Total disk size in bytes
  used: number;                // Used disk space in bytes
  available: number;           // Available disk space in bytes
  usagePercent: number;        // Disk usage percentage (0-100)
  mountpoint?: string;         // Mount point (for Unix systems)
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
  diskUsage: number;            // Overall disk usage percentage (0-100)
  diskUsages: DiskUsage[];      // Array of individual disk usage information
  networkUpload: number;        // Network upload speed in bytes/second
  networkDownload: number;      // Network download speed in bytes/second
  timestamp: number;            // Collection timestamp (Unix milliseconds)
}
