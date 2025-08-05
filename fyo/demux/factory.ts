// fyo/demux/factory.ts
import { DatabaseDemux } from './db';
import { detectEnvironment } from 'utils/env';

export class DatabaseFactory {
  private static instance: DatabaseDemux | null = null;
  private static config: EnvironmentConfig | null = null;

  static createDatabase(forceMode?: 'electron' | 'browser', apiUrl?: string): DatabaseDemux {
    // Detect environment if not forced
    const env = detectEnvironment();
    
    // Allow override for testing/development
    const useElectron = forceMode ? forceMode === 'electron' : env.isElectron;
    const finalApiUrl = apiUrl || env.apiUrl;
    
    // Store config for reference
    this.config = {
      ...env,
      isElectron: useElectron,
      isBrowser: !useElectron,
      apiUrl: finalApiUrl
    };
    
    console.log(`🔧 Creating DatabaseDemux in ${useElectron ? 'Electron' : 'Browser'} mode`);
    if (!useElectron) {
      console.log(`🌐 API URL: ${finalApiUrl}`);
    }
    
    // Create singleton instance
    if (!this.instance) {
      this.instance = new DatabaseDemux(useElectron, finalApiUrl);
    }
    
    return this.instance;
  }
  
  static getInstance(): DatabaseDemux | null {
    return this.instance;
  }
  
  static getConfig(): EnvironmentConfig | null {
    return this.config;
  }
  
  static reset(): void {
    this.instance = null;
    this.config = null;
  }
}