# Test Files

This directory contains test scripts for the videobot project.

## Running Tests

```bash
# Run all tests
npm test

# Run individual tests
node tests/test-url.js
node tests/test-shorts.js
node tests/test-privacy-url.js
```

## Test Files

- **test-url.js** - Tests URL extraction for various video platforms
- **test-shorts.js** - Tests YouTube Shorts URL handling
- **test-privacy-url.js** - Tests privacy URL generation

## Adding New Tests

When adding a new video platform or feature:

1. Create a new test file: `test-[feature].js`
2. Test various URL formats and edge cases
3. Update this README with test description
4. Add test to `npm test` script in package.json

## Example Test Structure

```javascript
const { URLUtils } = require('../dist/utils');

console.log('Testing [Feature Name]...');

const testCases = [
  { input: 'test input', expected: 'expected output' }
];

testCases.forEach(test => {
  const result = URLUtils.someMethod(test.input);
  console.log(result === test.expected ? '✅' : '❌', test.input);
});
```

## Future Improvements

- Migrate to proper test framework (Jest, Mocha)
- Add unit tests for bot logic
- Add integration tests
- Add CI/CD test automation
