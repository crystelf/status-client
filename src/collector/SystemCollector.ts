import * as si from 'systeminformation';
import * as os from 'os';
import { DynamicSystemStatus, StaticSystemInfo, DiskInfo, DiskUsage } from './types';
import { Logger } from '../utils/logger';

/**
 * SystemCollector class
 * Responsible for collecting both static system information and dynamic system status
 */
export class SystemCollector {
  private logger: Logger;
  private lastNetSnapshot?: {
    rx: number;
    tx: number;
    time: number;
  };

  constructor() {
    this.logger = new Logger('SystemCollector');
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

      // Collect network stats - consistent approach across platforms
      const ifaces = (await si.networkInterfaces()).filter(
        (i) => i.operstate === 'up' && !i.internal && !i.iface.toLowerCase().includes('loopback')
      );

      let totalRx = 0;
      let totalTx = 0;

      for (const iface of ifaces) {
        try {
          const statsArr = await si.networkStats(iface.iface);
          const stat = statsArr[0];
          if (!stat) continue;

          totalRx += stat.rx_bytes || 0;
          totalTx += stat.tx_bytes || 0;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          /* empty */
        }
      }

      let upload = 0;
      let download = 0;

      if (this.lastNetSnapshot) {
        const dt = (timestamp - this.lastNetSnapshot.time) / 1000;
        if (dt > 0) {
          upload = (totalTx - this.lastNetSnapshot.tx) / dt;
          download = (totalRx - this.lastNetSnapshot.rx) / dt;
        }
      }

      this.lastNetSnapshot = {
        rx: totalRx,
        tx: totalTx,
        time: timestamp,
      };

      this.logger.info(
        `Network speeds (DELTA) - Upload: ${Math.round(upload)} B/s, Download: ${Math.round(download)} B/s`
      );

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
