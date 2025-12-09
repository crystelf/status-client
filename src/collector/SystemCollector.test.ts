import { SystemCollector } from './SystemCollector';

describe('SystemCollector', () => {
  let collector: SystemCollector;

  beforeEach(() => {
    collector = new SystemCollector();
  });

  describe('getPlatform', () => {
    it('should return a valid platform type', () => {
      const platform = collector.getPlatform();
      expect(['windows', 'linux', 'darwin']).toContain(platform);
    });
  });

  describe('collectStaticInfo', () => {
    it('should collect all required static system information fields', async () => {
      const staticInfo = await collector.collectStaticInfo();

      // Verify all required fields are present
      expect(staticInfo).toHaveProperty('cpuModel');
      expect(staticInfo).toHaveProperty('cpuCores');
      expect(staticInfo).toHaveProperty('cpuArch');
      expect(staticInfo).toHaveProperty('systemVersion');
      expect(staticInfo).toHaveProperty('systemModel');
      expect(staticInfo).toHaveProperty('totalMemory');
      expect(staticInfo).toHaveProperty('totalSwap');
      expect(staticInfo).toHaveProperty('totalDisk');
      expect(staticInfo).toHaveProperty('diskType');
      expect(staticInfo).toHaveProperty('location');

      // Verify key fields are not empty
      expect(staticInfo.cpuModel).toBeTruthy();
      expect(staticInfo.cpuCores).toBeGreaterThan(0);
      expect(staticInfo.cpuArch).toBeTruthy();
      expect(staticInfo.totalMemory).toBeGreaterThan(0);
    }, 10000);
  });

  describe('collectDynamicStatus', () => {
    it('should collect all required dynamic system status fields', async () => {
      const dynamicStatus = await collector.collectDynamicStatus();

      // Verify all required fields are present
      expect(dynamicStatus).toHaveProperty('cpuUsage');
      expect(dynamicStatus).toHaveProperty('cpuFrequency');
      expect(dynamicStatus).toHaveProperty('memoryUsage');
      expect(dynamicStatus).toHaveProperty('swapUsage');
      expect(dynamicStatus).toHaveProperty('diskUsage');
      expect(dynamicStatus).toHaveProperty('networkUpload');
      expect(dynamicStatus).toHaveProperty('networkDownload');
      expect(dynamicStatus).toHaveProperty('timestamp');

      // Verify values are within expected ranges
      expect(dynamicStatus.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(dynamicStatus.cpuUsage).toBeLessThanOrEqual(100);
      expect(dynamicStatus.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(dynamicStatus.memoryUsage).toBeLessThanOrEqual(100);
      expect(dynamicStatus.diskUsage).toBeGreaterThanOrEqual(0);
      expect(dynamicStatus.diskUsage).toBeLessThanOrEqual(100);
      expect(dynamicStatus.timestamp).toBeGreaterThan(0);
    }, 10000);

    it('should include timestamp in the collected data', async () => {
      const beforeTimestamp = Date.now();
      const dynamicStatus = await collector.collectDynamicStatus();
      const afterTimestamp = Date.now();

      expect(dynamicStatus.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(dynamicStatus.timestamp).toBeLessThanOrEqual(afterTimestamp);
    }, 10000);
  });
});
