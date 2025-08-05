import { ConfigMap } from 'fyo/core/types';
import type { IPC } from 'main/preload';

// We declare 'ipc' globally only if running in Electron with preload exposing it.
// In browser, 'ipc' is undefined and won't be used.
declare const ipc: IPC | undefined;

export class Config {
  config: Map<string, unknown> | IPC['store'];

  constructor(isElectron: boolean) {
    if (isElectron && typeof ipc !== 'undefined' && ipc?.store) {
      // Electron mode with IPC store available
      this.config = ipc.store;
    } else {
      // Browser mode or Electron without ipc store fallback to Map
      this.config = new Map();
    }
  }

  get<K extends keyof ConfigMap>(
    key: K,
    defaultValue?: ConfigMap[K]
  ): ConfigMap[K] | undefined {
    const value = this.config.get(key) as ConfigMap[K] | undefined;
    return value ?? defaultValue;
  }

  set<K extends keyof ConfigMap>(key: K, value: ConfigMap[K]) {
    this.config.set(key, value);
  }

  delete(key: keyof ConfigMap) {
    this.config.delete(key);
  }
}

