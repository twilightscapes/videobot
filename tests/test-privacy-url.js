// Test URL generation
const { URLUtils } = require('./dist/utils');

const testUrl = "https://youtu.be/MxmKc0OhsnU?si=KicBE3tt2pcLmgrF";
const privacyUrl = URLUtils.createPrivacyUrl(testUrl, "videoprivacy.org");

console.log("Original URL:", testUrl);
console.log("Privacy URL:", privacyUrl);
console.log("Privacy URL length:", privacyUrl.length);

const testText = `Here's a privacy-friendly youtube link: ${privacyUrl}`;
console.log("Full text:", testText);
console.log("Full text length:", testText.length);
