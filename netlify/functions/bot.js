// Netlify Background Function for Bluesky Bot
// This function runs periodically to check for new posts

import { BskyBot } from '../../dist/bot.js';

export default async (req, context) => {
  console.log('Netlify function: Bot check triggered');
  
  try {
    const bot = new BskyBot({
      handle: process.env.BLUESKY_HANDLE,
      password: process.env.BLUESKY_PASSWORD,
      hashtag: process.env.HASHTAG_TO_MONITOR || '#youtubeprivacy',
      privacyDomain: process.env.PRIVACY_DOMAIN || 'videoprivacy.org'
    });

    // Run a single check cycle
    await bot.runSingleCheck();
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Bot check completed successfully',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
  } catch (error) {
    console.error('Netlify bot function error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Bot function failed',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }
};
