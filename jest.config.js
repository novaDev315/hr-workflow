module.exports = {
  projects: [
    '<rootDir>/services/employee',
    '<rootDir>/services/attendance',
    '<rootDir>/services/leave',
    '<rootDir>/services/location',
    '<rootDir>/services/payroll',
    '<rootDir>/services/recruitment',
    '<rootDir>/services/analytics',
  ],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'services/**/src/**/*.ts',
    '!services/**/src/**/*.spec.ts',
    '!services/**/src/**/*.e2e-spec.ts',
    '!services/**/src/main.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
