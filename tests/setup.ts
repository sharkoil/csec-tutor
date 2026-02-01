// Test setup file
const { expect, afterEach, beforeAll } = require('@jest/globals')

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
}

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  configurable: true,
})

// Mock crypto for UUID generation
const mockCrypto = {
  randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36)),
}

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
})

beforeAll(() => {
  // Global test setup
})

afterEach(() => {
  // Cleanup after each test
  jest.clearAllMocks()
})