import { FirehoseBot, loadConfig } from './firehose-bot.js';

// Usage: node dist/replay.js [--dry-run] <bsky.app post URL | at:// URI> [...more]
//
// Re-runs the bot's normal pipeline on specific posts - the ones the live
// firehose path dropped because of a bug that has since been fixed. The
// firehose never replays, so without this those posts would never get a reply.
// --dry-run runs everything (metadata, thumbnail, reply text) but posts nothing.
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targets = args.filter(a => !a.startsWith('--'));

  if (targets.length === 0) {
    console.error('Usage: node dist/replay.js [--dry-run] <post URL or at:// URI> [...]');
    process.exit(2);
  }

  const bot = new FirehoseBot(loadConfig());
  bot.dryRun = dryRun;
  await bot.login();
  if (dryRun) console.log('🧪 DRY RUN - nothing will be posted');

  for (const target of targets) {
    try {
      await bot.replay(target);
    } catch (error) {
      console.error(`❌ Replay failed for ${target}:`, error);
      process.exitCode = 1;
    }
  }

  // The bot's cleanup interval would otherwise keep the process alive
  process.exit(process.exitCode ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
