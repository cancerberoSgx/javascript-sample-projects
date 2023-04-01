// Tool to mock config in tests. To use it you need to set `ALLOW_CONFIG_MUTATIONS` environment variable. Example:
// `ALLOW_CONFIG_MUTATIONS=true npm run test...`

import * as config from 'config';

const originalConfig = { ...config };

function checkEnvVars() {
  if (!process.env.ALLOW_CONFIG_MUTATIONS) {
    throw new Error('You need to set ALLOW_CONFIG_MUTATIONS env var in order to mock config');
  }
}

export function mockConfig(customConfig: any) {
  checkEnvVars();
  Object.assign(config, config.util.extendDeep(config.util.toObject(), customConfig));
}

export function unMockConfig() {
  checkEnvVars();
  Object.assign(config, config.util.extendDeep(config.util.toObject(), originalConfig));
}
