module.exports = {
  testEnvironment: 'node',
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  transform: { '^.+\\.ts$': 'babel-jest' },
  moduleFileExtensions: ['ts', 'js', 'json'],
};
