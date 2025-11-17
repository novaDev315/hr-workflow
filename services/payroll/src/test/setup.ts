// Test setup file for Payroll Service
jest.setTimeout(10000);

// Mock EventEmitter
jest.mock('@nestjs/event-emitter');

// Mock HttpService for external service calls
jest.mock('@nestjs/axios');

// Mock pdfkit
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    end: jest.fn(),
    pipe: jest.fn(),
  }));
});
