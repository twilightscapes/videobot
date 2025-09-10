const { URLUtils } = require('./dist/utils');

// Test URL detection
const testTexts = [
  'Check this out #videoprivacy https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  '#videoprivacy www.youtube.com/watch?v=SmmL',
  'Look at this video https://youtu.be/dQw4w9WgXcQ #videoprivacy',
  '#videoprivacy'
];

console.log('Testing URL detection:');
testTexts.forEach((text, index) => {
  console.log(`\nTest ${index + 1}: "${text}"`);
  const result = URLUtils.extractVideoInfo(text);
  console.log('Result:', result);
});
