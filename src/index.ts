import { BskyBot } from './bot';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const bot = new BskyBot({
    handle: process.env.BLUESKY_HANDLE!,
    password: process.env.BLUESKY_PASSWORD!,
    hashtag: process.env.HASHTAG_TO_MONITOR || '#videoprivacy',
    privacyDomain: process.env.PRIVACY_DOMAIN || 'your-domain.org'
  });

  console.log('Starting Bluesky Video Privacy Bot...');
  
  try {
    await bot.start();
  } catch (error) {
    console.error('Bot crashed:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\nShutting down bot...');
  process.exit(0);
});

main().catch(console.error);
