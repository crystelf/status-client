import * as si from 'systeminformation';
import * as os from 'os';
import { DynamicSystemStatus, StaticSystemInfo, DiskInfo, DiskUsage } from './types';
import { Logger } from '../utils/logger';

/**
 * SystemCollector class
 * Responsible for collecting both static system information and dynamic system status
 */
export class SystemCollector {
  private lastNetworkStats: { rx: number; tx: number; timestamp: number } | null = null;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('SystemCollector');
  }

  /**
   * Get the current platform type
   * @returns Platform identifier: 'windows', 'linux', or 'darwin'
   */
  getPlatform(): 'windows' | 'linux' | 'darwin' {
    const platform = os.platform();
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'darwin';
    return 'linux';
  }

  /**
   * Collect static system information
   * This includes hardware specs and system details that don't change frequently
   * @returns Promise resolving to StaticSystemInfo
   */
  async collectStaticInfo(): Promise<StaticSystemInfo> {
    try {
      // Collect CPU information
      const cpuInfo = await si.cpu();

      // Collect system information
      const systemInfo = await si.system();
      const osInfo = await si.osInfo();

      // Collect memory information
      const memInfo = await si.mem();

      // Collect disk information
      const diskLayout = await si.diskLayout();
      const fsSize = await si.fsSize();

      // Calculate total disk capacity
      const totalDisk = fsSize.reduce((sum, disk) => sum + disk.size, 0);

      // Create disk information array
      const disks: DiskInfo[] = [];
      const processedDevices = new Set<string>();

      for (const disk of diskLayout) {
        // Skip duplicate devices
        if (processedDevices.has(disk.device)) {
          continue;
        }
        processedDevices.add(disk.device);

        // Determine disk type
        let diskType = 'HDD';
        if (disk.interfaceType?.toLowerCase().includes('nvme')) {
          diskType = 'NVMe';
        } else if (disk.type?.toLowerCase().includes('ssd')) {
          diskType = 'SSD';
        } else if (disk.type) {
          diskType = disk.type;
        }

        disks.push({
          device: disk.device,
          size: disk.size,
          type: diskType,
          interfaceType: disk.interfaceType,
        });
      }

      // Get geographic location (simplified - using timezone as proxy)
      // In production, this could use IP geolocation services
      const location = this.getLocationFromTimezone();

      return {
        cpuModel: cpuInfo.brand || 'Unknown',
        cpuCores: cpuInfo.cores || os.cpus().length,
        cpuArch: os.arch(),
        systemVersion: `${osInfo.distro} ${osInfo.release}`.trim() || osInfo.platform,
        systemModel: `${systemInfo.manufacturer} ${systemInfo.model}`.trim() || 'Unknown',
        totalMemory: memInfo.total,
        totalSwap: memInfo.swaptotal,
        totalDisk: totalDisk,
        disks: disks,
        location: location,
      };
    } catch (error) {
      this.logger.error('Failed to collect static system info', error);
      throw new Error(
        `Failed to collect static system info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Collect dynamic system status
   * This includes real-time metrics like CPU usage, memory usage, etc.
   * Handle collection failures with error logging
   * @returns Promise resolving to DynamicSystemStatus
   */
  async collectDynamicStatus(): Promise<DynamicSystemStatus> {
    try {
      const timestamp = Date.now();

      // Collect current CPU load
      const currentLoad = await si.currentLoad();

      // Collect CPU speed
      const cpuSpeed = await si.cpuCurrentSpeed();

      // Collect memory usage
      const memInfo = await si.mem();

      // Collect disk usage
      const fsSize = await si.fsSize();
      const totalDiskSize = fsSize.reduce((sum, disk) => sum + disk.size, 0);
      const usedDiskSize = fsSize.reduce((sum, disk) => sum + disk.used, 0);
      const diskUsage = totalDiskSize > 0 ? (usedDiskSize / totalDiskSize) * 100 : 0;

      // Create disk usage information array
      const diskUsages: DiskUsage[] = [];
      for (const disk of fsSize) {
        diskUsages.push({
          device: disk.fs,
          size: disk.size,
          used: disk.used,
          available: disk.available,
          usagePercent: disk.use || 0,
          mountpoint: disk.mount,
        });
      }

      // Collect network stats
      // Collect network stats
      const networkStats = await si.networkStats();
      this.logger.info(`Network stats received: ${networkStats.length} interfaces`);
      
      // Log first few interfaces for debugging
      networkStats.slice(0, 3).forEach((stat, index) => {
        this.logger.info(`Interface ${index}: ${stat.iface}, operstate: ${stat.operstate}, rx_bytes: ${stat.rx_bytes}, tx_bytes: ${stat.tx_bytes}`);
      });
      
      const { upload, download } = this.calculateNetworkSpeed(networkStats, timestamp);
      this.logger.info(`Network speeds calculated - Upload: ${upload} B/s, Download: ${download} B/s`);

      // Calculate memory usage percentage
      const memoryUsage = memInfo.total > 0 ? (memInfo.used / memInfo.total) * 100 : 0;

      // Calculate swap usage percentage
      const swapUsage = memInfo.swaptotal > 0 ? (memInfo.swapused / memInfo.swaptotal) * 100 : 0;

      return {
        cpuUsage: currentLoad.currentLoad || 0,
        cpuFrequency: cpuSpeed.avg || 0,
        memoryUsage: memoryUsage,
        swapUsage: swapUsage,
        diskUsage: diskUsage,
        diskUsages: diskUsages,
        networkUpload: upload,
        networkDownload: download,
        timestamp: timestamp,
      };
    } catch (error) {
      this.logger.error('Failed to collect dynamic system status', error);
      throw new Error(
        `Failed to collect dynamic system status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Calculate network upload and download speeds
   * Uses delta between current and previous measurements
   * @param networkStats Current network statistics
   * @param timestamp Current timestamp
   * @returns Object with upload and download speeds in bytes/second
   */
  private calculateNetworkSpeed(
    networkStats: si.Systeminformation.NetworkStatsData[],
    timestamp: number
  ): { upload: number; download: number } {
    // Log network stats for debugging
    this.logger.debug(`Network interfaces found: ${networkStats.length}`);
    
    // Filter out loopback interfaces
    const activeInterfaces = networkStats.filter(stat => {
      // Skip loopback interfaces (lo on Linux, Loopback on Windows)
      const isLoopback = stat.iface.startsWith('lo') || stat.iface.toLowerCase().includes('loopback');
      // Skip inactive interfaces if operstate is available
      const isActive = !stat.operstate || stat.operstate === 'up' || stat.operstate === 'unknown';
      // Only include interfaces with data
      const hasData = (stat.rx_bytes || 0) > 0 || (stat.tx_bytes || 0) > 0;
      
      this.logger.debug(`Interface ${stat.iface}: operstate=${stat.operstate}, rx_bytes=${stat.rx_bytes}, tx_bytes=${stat.tx_bytes}, isLoopback=${isLoopback}, isActive=${isActive}, hasData=${hasData}`);
      
      return !isLoopback && isActive;
    });
    
    this.logger.debug(`Active interfaces: ${activeInterfaces.length}`);
    
    if (activeInterfaces.length === 0) {
      return { upload: 0, download: 0 };
    }

    // Sum up all active network interfaces
    const totalRx = activeInterfaces.reduce((sum, stat) => sum + (stat.rx_bytes || 0), 0);
    const totalTx = activeInterfaces.reduce((sum, stat) => sum + (stat.tx_bytes || 0), 0);
    
    this.logger.debug(`Total Rx: ${totalRx}, Total Tx: ${totalTx}`);

    // If this is the first measurement, store it and return 0
    if (!this.lastNetworkStats) {
      this.logger.debug('First measurement, storing initial stats');
      this.lastNetworkStats = { rx: totalRx, tx: totalTx, timestamp };
      return { upload: 0, download: 0 };
    }

    // Calculate time delta in seconds
    const timeDelta = (timestamp - this.lastNetworkStats.timestamp) / 1000;
    
    this.logger.debug(`Time delta: ${timeDelta}s`);

    if (timeDelta <= 0) {
      return { upload: 0, download: 0 };
    }

    // Calculate bytes transferred since last measurement
    const rxDelta = totalRx - this.lastNetworkStats.rx;
    const txDelta = totalTx - this.lastNetworkStats.tx;
    
    this.logger.debug(`Rx delta: ${rxDelta}, Tx delta: ${txDelta}`);

    // Calculate speeds in bytes/second
    const download = Math.max(0, rxDelta / timeDelta);
    const upload = Math.max(0, txDelta / timeDelta);
    
    this.logger.debug(`Calculated speeds - Upload: ${upload} B/s, Download: ${download} B/s`);

    // Update last stats
    this.lastNetworkStats = { rx: totalRx, tx: totalTx, timestamp };

    return { upload, download };
  }

  /**
   * Get approximate location from system timezone
   * This is a simplified approach - production systems should use IP geolocation
   * @returns Location string
   */
  private getLocationFromTimezone(): string {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Extract city/region from timezone (e.g., "America/New_York" -> "New York")
      if (timezone.includes('/')) {
        const parts = timezone.split('/');
        return parts[parts.length - 1].replace(/_/g, ' ');
      }
      return timezone;
    } catch (error) {
      this.logger.error('Failed to getLocationFromTimezone', error);
      return 'Unknown';
    }
  }
}
