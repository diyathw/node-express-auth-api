/** @type {import('jest').Config} */
export default {
  clearMocks: true,
  collectCoverageFrom: [
    'src/services/auth.service.ts',
    'src/routes/access-control.router.ts',
    'src/routes/system.router.ts',
    'src/middleware/request-context.middleware.ts',
    'src/middleware/validate.ts',
  ],
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coverageThreshold: {
    global: { branches: 85, functions: 90, lines: 90, statements: 90 },
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['babel-jest', { configFile: './babel.config.cjs' }],
  },
};
