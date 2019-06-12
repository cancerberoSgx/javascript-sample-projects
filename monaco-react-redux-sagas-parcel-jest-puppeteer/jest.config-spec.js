module.exports = {
  "testEnvironment": "node",
  // "testRegex": "src/__tests__/.*\.*Test\.[t]sx?$",
  "testRegex": "/src/__tests__/spec/.*[^d]\.ts?$",
  "transform": {
    ".(ts|tsx)": "ts-jest"
  },
  "moduleFileExtensions": [
    "ts",
    "tsx",
    "js"
  ]
}