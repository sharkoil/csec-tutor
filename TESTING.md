# Testing Guide for CSEC Tutor

## 🧪 **Testing Infrastructure**

We've successfully set up a comprehensive testing suite for the CSEC Tutor application with Jest and React Testing Library.

### **Test Configuration**
- **Framework**: Jest with React Testing Library
- **Environment**: jsdom for DOM testing
- **Coverage**: Collection from components, lib, and app directories
- **Threshold**: 70% coverage for branches, functions, lines, and statements

## 📁 **Test Categories**

### **1. Unit Tests** (`tests/unit/`)
- **AI Coach Tests** (`ai-coach.test.ts`)
  - Test content generation methods
  - Mock OpenAI API calls
  - Validate response formatting
  - Test error handling

- **Vector Search Tests** (`vector-search.test.ts`)
  - Test content insertion with embeddings
  - Mock database operations
  - Test similarity search functionality
  - Test filter mechanisms

- **Database Tests** (`database-integration.test.ts`)
  - Real database connection testing
  - CRUD operations on all tables
  - Transaction handling
  - RLS policy compliance

### **2. Integration Tests** (`tests/integration/`)
- **Authentication Flow** (`auth.test.tsx`)
  - Complete user registration/login flow
  - Form validation and submission
  - Error handling and display
  - Protected route access

- **Component Integration** (`integration.test.tsx`)
  - End-to-end component testing
  - Responsive design verification
  - Accessibility compliance
  - Browser compatibility
  - Performance testing

### **3. Type Tests** (`tests/types.test.ts`)
- **Data Model Validation**
  - Type safety checking
  - Interface compliance
  - Edge case handling

### **4. Performance Tests** (`tests/performance.test.ts`)
- **Loading Performance**
  - Bundle size optimization
  - Memory leak detection
  - Network error handling
  - Error recovery mechanisms

## 🏃 **Running Tests**

### **Basic Test Command**
```bash
npm test
```

### **Coverage Command**
```bash
npm run test:coverage
```

### **Watch Mode**
```bash
npm run test:watch
```

## 📊 **Coverage Targets**

- **Branches**: 70% minimum
- **Functions**: 70% minimum  
- **Lines**: 70% minimum
- **Statements**: 70% minimum

## 🎯 **Test Files Structure**

```
tests/
├── setup.ts                 # Test setup and mocks
├── unit/
│   ├── ai-coach.test.ts
│   ├── vector-search.test.ts
│   └── database-integration.test.ts
├── integration/
│   ├── auth.test.tsx
│   ├── integration.test.tsx
│   └── basic.test.ts
├── types.test.ts
├── performance.test.ts
└── jest.config.js         # Jest configuration
```

## 🔧 **Mock Strategy**

### **API Mocks**
- OpenAI embeddings and chat completions
- Supabase database operations
- Authentication state management
- Network requests and responses

### **Environment Mocks**
- localStorage for client-side storage
- window.matchMedia for responsive testing
- Performance API for timing
- Crypto for UUID generation

## 🚀 **CI/CD Integration**

### **GitHub Actions Example**
```yaml
name: Test CSEC Tutor
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
```

## 📝 **Test Commands Reference**

### **Run All Tests**
```bash
npm test                          # Run all tests
npm run test:watch               # Run tests in watch mode
npm run test:coverage           # Run tests with coverage report
```

### **Run Specific Test Files**
```bash
npm test -- --testNamePattern="AI Coach"
npm test -- --testNamePattern="Vector Search"
npm test tests/unit/ai-coach.test.ts
npm test tests/integration/auth.test.tsx
```

### **Coverage Analysis**
```bash
npm run test:coverage -- --coverageReporters=text-lcov
open coverage/lcov-report/index.html
```

## 🐛 **Debugging Tests**

### **Debug Mode**
```bash
npm test -- --verbose --no-cache
```

### **Test Specific Component**
```bash
npm test -- --testNamePattern=".*AuthForm.*" --testPathPattern="components/.*"
```

## 📈 **Best Practices**

### **Test Naming**
- Use descriptive test names
- Follow "should [behavior] when [condition]" pattern
- Group related tests in describe blocks

### **Assertion Patterns**
- Use specific matchers over toBe(true/false)
- Test exact values when possible
- Use toContain() for array/object contents
- Use toThrow() for error conditions

### **Test Isolation**
- Each test should be independent
- Use beforeEach/afterEach for setup/teardown
- Clear mocks between tests

### **Data Management**
- Use factories for test data creation
- Keep test data minimal but realistic
- Clean up test artifacts

## 🔍 **Common Issues and Solutions**

### **Import/Export Issues**
```javascript
// ✅ Correct
import { myFunction } from '../lib/utils'

// ❌ Incorrect
const myFunction = require('../lib/utils')

// ✅ Correct
export { myFunction }
```

### **Async/Await Issues**
```javascript
// ✅ Correct
await act(() => {
  fireEvent.click(screen.getByRole('button'))
})

// ❌ Incorrect
fireEvent.click(screen.getByRole('button'))
```

### **Mock Configuration**
```javascript
// Clear mocks before each test
beforeEach(() => {
  jest.clearAllMocks()
})

// Reset mocks after all tests
afterAll(() => {
  jest.restoreAllMocks()
})
```

## 🎯 **Success Criteria**

- ✅ All tests pass in CI/CD
- ✅ Coverage meets minimum thresholds
- ✅ No performance regressions
- ✅ Accessibility standards met
- ✅ Cross-browser compatibility confirmed

This comprehensive testing setup ensures the CSEC Tutor platform is bulletproof and production-ready!