jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000

require('../../node_modules/jasmine-expect') // hack to load jasmine-matchers before out specs so it gets bundled

export * from './assetsSpec'
export * from './indexSpec'