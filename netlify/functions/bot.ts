import { Handler } from '@netlify/functions';
import { BskyBot } from '../../src/bot';

const handler: Handler = async (event, context) => {
  console.log('Bot function triggered');
  
  try {
    const bot = new BskyBot({
      handle: process.env.BLUESKY_HANDLE!,
      password: process.env.BLUESKY_PASSWORD!,
      hashtag: process.env.HASHTAG_TO_MONITOR || '#youtubeprivacy',
      privacyDomain: process.env.PRIVACY_DOMAIN || 'videoprivacy.org'
    });

    // Run a single check cycle instead of continuous monitoring
    await bot.runSingleCheck();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Bot check completed successfully',
        timestamp: new Date().toISOString()
      }),
      headers: {
        'Content-Type': 'application/json',
      }
    };
  } catch (error) {
    console.error('Bot function error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
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

export { handler };
