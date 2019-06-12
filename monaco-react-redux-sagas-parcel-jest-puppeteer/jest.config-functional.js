module.exports = {
  "preset": "jest-puppeteer",
  "globalSetup": "jest-environment-puppeteer/setup",
  "globalTeardown": "jest-environment-puppeteer/teardown",
  "testEnvironment": "jest-environment-puppeteer",
  "testRegex": "/src/__tests__/functional/.*[^d]\.tsx?$",
  "transform": {
    ".(ts|tsx)": "ts-jest"
  },
  "moduleFileExtensions": [
    "ts",
    "tsx"
  ]

}