import { ConfigMap } from 'fyo/core/types';
import type { IPC } from 'main/preload';


export class Config {
  config: Map<string, unknown> | IPC['store'];

  constructor(isElectron: boolean) {
    // In Electron, preload exposes 'ipc' on window (globalThis).
    const ipcRuntime = (globalThis as any).ipc as IPC | undefined;

    if (isElectron && ipcRuntime && ipcRuntime.store) {
      this.config = ipcRuntime.store;
    } else {
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
