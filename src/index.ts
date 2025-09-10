import { BskyBot } from './bot';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  const bot = new BskyBot({
    handle: process.env.BLUESKY_HANDLE!,
    password: process.env.BLUESKY_PASSWORD!,
    hashtag: process.env.HASHTAG_TO_MONITOR || '#youtubeprivacy',
    privacyDomain: process.env.PRIVACY_DOMAIN || 'your-domain.org'
  });

  console.log('Starting Bluesky YouTube Privacy Bot...');
  
  try {
    await bot.start();
  } catch (error) {
    console.error('Bot crashed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down bot...');
  process.exit(0);
});

main().catch(console.error);
