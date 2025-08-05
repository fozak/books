import { Fyo } from 'fyo';
import { Fyo } from 'fyo';
import { detectEnvironment } from 'utils/env'; // Your env detection utility

const env = detectEnvironment();

export const fyo = new Fyo({
  isTest: false,
  isElectron: env.isElectron,  // set dynamically based on environment
  // optionally pass forceMode or apiUrl if you want to override
});

