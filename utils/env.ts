// ==========================================
// 1. Enhanced Environment Detection
// ==========================================

// utils/env.ts
export interface EnvironmentConfig {
  isElectron: boolean;
  isBrowser: boolean;
  apiUrl?: string;
  mode: 'electron' | 'browser' | 'development';
}

export function detectEnvironment(): EnvironmentConfig {
  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && 
                    window.process?.versions?.electron !== undefined;
  
  // Check if running in development mode
  const isDev = process.env.NODE_ENV === 'development';
  
  // Determine API URL for browser mode
  const apiUrl = process.env.VUE_APP_API_URL || 
                 (isDev ? 'http://localhost:3001' : window.location.origin);
  
  return {
    isElectron,
    isBrowser: !isElectron,
    apiUrl: isElectron ? undefined : apiUrl,
    mode: isElectron ? 'electron' : (isDev ? 'development' : 'browser')
  };
}