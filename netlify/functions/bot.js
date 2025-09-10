// Netlify Background Function for Bluesky Bot
const { BskyBot } = require('../../dist/bot.js');

exports.handler = async (event, context) => {
  console.log('Netlify function: Bot check triggered');
  
  try {
    const bot = new BskyBot({
      handle: process.env.BLUESKY_HANDLE,
      password: process.env.BLUESKY_PASSWORD,
      hashtag: process.env.HASHTAG_TO_MONITOR || '#videoprivacy',
      privacyDomain: process.env.PRIVACY_DOMAIN || 'your-domain.org'
    });

    // Run a single check cycle
    await bot.runSingleCheck();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        message: 'Bot check completed successfully',
        timestamp: new Date().toISOString()
      }),
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
  } catch (error) {
    console.error('Netlify bot function error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false,
        error: 'Bot function failed',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      headers: {
        'Content-Type': 'application/json',
      }
    };
  }
};
