/** Unit tests target the pure-TS protocol layer (src/sources) — no React
 * Native runtime needed, so plain ts-jest keeps them fast and dependency-free. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};
