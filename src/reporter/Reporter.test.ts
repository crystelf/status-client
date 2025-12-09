import { Reporter } from './Reporter';
import { ClientConfig } from '../config';
import { StaticSystemInfo, DynamicSystemStatus } from '../collector';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-client-id'),
}));

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock fs
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock os
jest.mock('os');
const mockedOs = os as jest.Mocked<typeof os>;

describe('Reporter', () => {
  let reporter: Reporter;
  let mockConfig: ClientConfig;
  let mockStaticInfo: StaticSystemInfo;
  let mockDynamicStatus: DynamicSystemStatus;
  const testCacheDir = '.test-cache';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock config
    mockConfig = {
      clientName: 'test-client',
      clientTags: ['tag1', 'tag2'],
      clientPurpose: 'testing',
      serverUrl: 'http://localhost:7788',
      reportInterval: 60000,
      minReportInterval: 10000,
      maxRetries: 3,
      cacheSize: 100,
    };

    // Setup mock static info
    mockStaticInfo = {
      cpuModel: 'Intel Core i7',
      cpuCores: 8,
      cpuArch: 'x64',
      systemVersion: 'Windows 11',
      systemModel: 'Dell XPS',
      totalMemory: 16000000000,
      totalSwap: 8000000000,
      totalDisk: 500000000000,
      diskType: 'SSD',
      location: 'New York',
    };

    // Setup mock dynamic status
    mockDynamicStatus = {
      cpuUsage: 50,
      cpuFrequency: 3.5,
      memoryUsage: 60,
      swapUsage: 10,
      diskUsage: 70,
      networkUpload: 1000000,
      networkDownload: 5000000,
      timestamp: Date.now(),
    };

    // Mock os functions
    mockedOs.platform.mockReturnValue('win32');
    mockedOs.hostname.mockReturnValue('test-hostname');

    // Mock fs functions
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.mkdirSync.mockImplementation(() => undefined);
    mockedFs.writeFileSync.mockImplementation(() => undefined);
    mockedFs.readFileSync.mockReturnValue('test-client-id');

    // Create reporter instance
    reporter = new Reporter(mockConfig, testCacheDir);
    reporter.setStaticInfo(mockStaticInfo);
  });

  describe('buildPayload', () => {
    it('should build complete payload with all required fields', () => {
      // Requirement 2.2: Report must include all required fields
      const payload = reporter.buildPayload(mockDynamicStatus);

      expect(payload).toHaveProperty('clientId');
      expect(payload).toHaveProperty('clientName');
      expect(payload).toHaveProperty('clientTags');
      expect(payload).toHaveProperty('clientPurpose');
      expect(payload).toHaveProperty('hostname');
      expect(payload).toHaveProperty('platform');
      expect(payload).toHaveProperty('staticInfo');
      expect(payload).toHaveProperty('dynamicStatus');
    });

    it('should include correct client configuration', () => {
      const payload = reporter.buildPayload(mockDynamicStatus);

      expect(payload.clientName).toBe('test-client');
      expect(payload.clientTags).toEqual(['tag1', 'tag2']);
      expect(payload.clientPurpose).toBe('testing');
    });

    it('should include static system info', () => {
      const payload = reporter.buildPayload(mockDynamicStatus);

      expect(payload.staticInfo).toEqual(mockStaticInfo);
    });

    it('should include dynamic system status', () => {
      const payload = reporter.buildPayload(mockDynamicStatus);

      expect(payload.dynamicStatus).toEqual(mockDynamicStatus);
    });

    it('should include hostname and platform', () => {
      const payload = reporter.buildPayload(mockDynamicStatus);

      expect(payload.hostname).toBe('test-hostname');
      expect(payload.platform).toBe('windows');
    });

    it('should throw error if static info not set', () => {
      const newReporter = new Reporter(mockConfig, testCacheDir);

      expect(() => {
        newReporter.buildPayload(mockDynamicStatus);
      }).toThrow('Static system info not set');
    });
  });

  describe('report', () => {
    it('should send HTTP POST request to server', async () => {
      // Requirement 2.1: Send data via HTTP POST
      mockedAxios.post.mockResolvedValue({ status: 200, data: { success: true } });

      const payload = reporter.buildPayload(mockDynamicStatus);
      await reporter.report(payload);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:7788/api/reports',
        payload,
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should clear cache on successful report', async () => {
      // Requirement 2.4: Clear cache on success
      mockedAxios.post.mockResolvedValue({ status: 200, data: { success: true } });

      const payload = reporter.buildPayload(mockDynamicStatus);

      // First cache a report
      reporter.cacheFailedReport(payload);
      expect(reporter.getCacheSize()).toBe(1);

      // Then send successfully
      await reporter.report(payload);
      expect(reporter.getCacheSize()).toBe(0);
    });

    it('should cache report on failure', async () => {
      // Requirement 2.3: Cache data on failure
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const payload = reporter.buildPayload(mockDynamicStatus);

      await expect(reporter.report(payload)).rejects.toThrow();
      expect(reporter.getCacheSize()).toBe(1);
    });

    it('should cache report on server error', async () => {
      mockedAxios.post.mockResolvedValue({ status: 500, data: { error: 'Server error' } });

      const payload = reporter.buildPayload(mockDynamicStatus);

      await expect(reporter.report(payload)).rejects.toThrow();
      expect(reporter.getCacheSize()).toBe(1);
    });
  });

  describe('cacheFailedReport', () => {
    it('should add report to cache', () => {
      // Requirement 2.3: Cache failed reports
      const payload = reporter.buildPayload(mockDynamicStatus);

      reporter.cacheFailedReport(payload);
      expect(reporter.getCacheSize()).toBe(1);
    });

    it('should enforce cache size limit', () => {
      const smallConfig = { ...mockConfig, cacheSize: 2 };
      const smallReporter = new Reporter(smallConfig, testCacheDir);
      smallReporter.setStaticInfo(mockStaticInfo);

      const payload1 = smallReporter.buildPayload(mockDynamicStatus);
      const payload2 = smallReporter.buildPayload(mockDynamicStatus);
      const payload3 = smallReporter.buildPayload(mockDynamicStatus);

      smallReporter.cacheFailedReport(payload1);
      smallReporter.cacheFailedReport(payload2);
      smallReporter.cacheFailedReport(payload3);

      expect(smallReporter.getCacheSize()).toBe(2);
    });

    it('should persist cache to disk', () => {
      // Requirement 2.5: Persist cached data
      const payload = reporter.buildPayload(mockDynamicStatus);

      reporter.cacheFailedReport(payload);

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('retryCachedReports', () => {
    it('should retry all cached reports', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: { success: true } });

      const payload1 = reporter.buildPayload(mockDynamicStatus);
      const payload2 = reporter.buildPayload(mockDynamicStatus);

      reporter.cacheFailedReport(payload1);
      reporter.cacheFailedReport(payload2);

      await reporter.retryCachedReports();

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(reporter.getCacheSize()).toBe(0);
    });

    it('should keep failed reports in cache', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const payload = reporter.buildPayload(mockDynamicStatus);
      reporter.cacheFailedReport(payload);

      await reporter.retryCachedReports();

      expect(reporter.getCacheSize()).toBe(1);
    });

    it('should drop reports after max retries', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const payload = reporter.buildPayload(mockDynamicStatus);
      reporter.cacheFailedReport(payload);

      // Retry multiple times
      await reporter.retryCachedReports();
      await reporter.retryCachedReports();
      await reporter.retryCachedReports();
      await reporter.retryCachedReports(); // Should drop after 3 retries

      expect(reporter.getCacheSize()).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached reports', () => {
      // Requirement 2.4: Clear cache
      const payload = reporter.buildPayload(mockDynamicStatus);

      reporter.cacheFailedReport(payload);
      expect(reporter.getCacheSize()).toBe(1);

      reporter.clearCache();
      expect(reporter.getCacheSize()).toBe(0);
    });

    it('should persist empty cache to disk', () => {
      const payload = reporter.buildPayload(mockDynamicStatus);
      reporter.cacheFailedReport(payload);

      jest.clearAllMocks();
      reporter.clearCache();

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });
});
