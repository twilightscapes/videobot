const { URLUtils } = require('./dist/utils.js');

const shortsUrl = 'https://youtube.com/shorts/iSaCvsxEfFg?si=37C2Bz0h74ZP97tc';

console.log('Testing YouTube Shorts URL:', shortsUrl);

const videoInfo = URLUtils.extractVideoInfo(shortsUrl);
console.log('Extracted video info:', videoInfo);

if (videoInfo) {
  const privacyUrl = URLUtils.createPrivacyUrl(shortsUrl, 'adblock.video');
  console.log('Generated privacy URL:', privacyUrl);
}
