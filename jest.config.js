/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  watchPathIgnorePatterns: ['globalConfig'],
  verbose: true,
  collectCoverageFrom: ['./src/**'],
  coveragePathIgnorePatterns: ['node_modules', 'models', 'src/index.ts'],
};
