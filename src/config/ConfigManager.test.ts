import { ConfigManager } from './ConfigManager';
import { ClientConfig } from './types';
import * as fs from 'fs';
import * as os from 'os';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const testConfigPath = 'test-config.json';

  beforeEach(() => {
    configManager = new ConfigManager(testConfigPath);
    // Clean up any existing test config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    // Clean up test config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration with hostname as clientName', () => {
      const config = configManager.getDefaultConfig();
      
      expect(config.clientName).toBe(os.hostname());
      expect(config.clientTags).toEqual([]);
      expect(config.clientPurpose).toBe('');
      expect(config.serverUrl).toBe('http://localhost:7788');
      expect(config.reportInterval).toBe(60000);
      expect(config.minReportInterval).toBe(10000);
      expect(config.maxRetries).toBe(3);
      expect(config.cacheSize).toBe(100);
    });
  });

  describe('loadConfig', () => {
    it('should return default config when file does not exist', () => {
      const config = configManager.loadConfig();
      
      expect(config.clientName).toBe(os.hostname());
      expect(config.serverUrl).toBe('http://localhost:7788');
    });

    it('should load and merge config from file', () => {
      const testConfig: Partial<ClientConfig> = {
        clientName: 'test-client',
        clientTags: ['production', 'web-server'],
        clientPurpose: 'Web server monitoring',
        serverUrl: 'http://example.com:3000',
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig));

      const config = configManager.loadConfig();
      
      expect(config.clientName).toBe('test-client');
      expect(config.clientTags).toEqual(['production', 'web-server']);
      expect(config.clientPurpose).toBe('Web server monitoring');
      expect(config.serverUrl).toBe('http://example.com:3000');
      // Should still have default values for missing fields
      expect(config.reportInterval).toBe(60000);
      expect(config.maxRetries).toBe(3);
    });

    it('should handle invalid JSON gracefully', () => {
      fs.writeFileSync(testConfigPath, 'invalid json');

      const config = configManager.loadConfig();
      
      // Should return default config on error
      expect(config.clientName).toBe(os.hostname());
    });
  });

  describe('validateConfig', () => {
    it('should use hostname when clientName is empty', () => {
      const config = configManager.validateConfig({ clientName: '' });
      
      expect(config.clientName).toBe(os.hostname());
    });

    it('should use hostname when clientName is whitespace', () => {
      const config = configManager.validateConfig({ clientName: '   ' });
      
      expect(config.clientName).toBe(os.hostname());
    });

    it('should enforce minimum report interval', () => {
      const config = configManager.validateConfig({ 
        reportInterval: 5000,  // Below minimum of 10000
      });
      
      expect(config.reportInterval).toBe(10000);
    });

    it('should allow report interval above minimum', () => {
      const config = configManager.validateConfig({ 
        reportInterval: 30000,
      });
      
      expect(config.reportInterval).toBe(30000);
    });

    it('should ensure clientTags is an array', () => {
      const config = configManager.validateConfig({ 
        clientTags: 'not-an-array' as any,
      });
      
      expect(Array.isArray(config.clientTags)).toBe(true);
      expect(config.clientTags).toEqual([]);
    });

    it('should merge partial config with defaults', () => {
      const config = configManager.validateConfig({ 
        clientName: 'custom-name',
        serverUrl: 'http://custom.com',
      });
      
      expect(config.clientName).toBe('custom-name');
      expect(config.serverUrl).toBe('http://custom.com');
      expect(config.reportInterval).toBe(60000); // Default
      expect(config.maxRetries).toBe(3); // Default
    });
  });
});
