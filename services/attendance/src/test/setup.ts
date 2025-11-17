// Test setup file for Attendance Service
jest.setTimeout(10000);

// Mock EventEmitter
jest.mock('@nestjs/event-emitter');

// Mock HttpService for external service calls
jest.mock('@nestjs/axios');
