import { Jetstream } from '@skyware/jetstream';
import { BskyAgent, RichText } from '@atproto/api';
import * as dotenv from 'dotenv';
import express from 'express';

// Load environment variables
dotenv.config();

interface BotConfig {
  handle: string;
  password: string;
  hashtag: string;
}

class FirehoseBot {
  private agent: BskyAgent;
  private config: BotConfig;
  private processedPosts = new Set<string>();

  constructor(config: BotConfig) {
    this.config = config;
    this.agent = new BskyAgent({ service: 'https://bsky.social' });
  }

  async start() {
    // Login
    await this.agent.login({
      identifier: this.config.handle,
      password: this.config.password
    });
    console.log(`✅ Logged in as ${this.config.handle}`);

    // Start Express server for Railway health checks
    const app = express();
    const PORT = process.env.PORT || 3000;
    
    app.get('/', (req, res) => {
      res.send('Bluesky VideoPrivacy Bot is running 🤖');
    });
    
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
    
    app.listen(PORT, () => {
      console.log(`🏥 Health check server running on port ${PORT}`);
    });

    // Connect to Firehose
    const jetstream = new Jetstream({
      wantedCollections: ['app.bsky.feed.post']
    });

    jetstream.on('open', () => {
      console.log('🔥 Connected to Bluesky Firehose');
    });

    jetstream.on('error', (error) => {
      console.error('❌ Firehose error:', error);
    });

    jetstream.on('close', () => {
      console.log('🔌 Firehose connection closed, reconnecting...');
      setTimeout(() => jetstream.start(), 5000);
    });

    // Listen for new posts
    jetstream.onCreate('app.bsky.feed.post', async (event) => {
      try {
        const post = event.commit.record as any;
        
        // Skip if no text
        if (!post.text) return;
        
        // Skip our own posts
        if (event.did === this.agent.session?.did) return;
        
        // Skip if already processed
        const postUri = `at://${event.did}/${event.commit.collection}/${event.commit.rkey}`;
        if (this.processedPosts.has(postUri)) return;
        
        // Check for hashtag (case-insensitive)
        const hashtag = this.config.hashtag.toLowerCase().replace('#', '');
        if (!post.text.toLowerCase().includes(hashtag)) return;
        
        console.log(`\n🎯 Found post with ${this.config.hashtag}:`);
        console.log(`   Author: ${event.did}`);
        console.log(`   Text: ${post.text.substring(0, 100)}...`);
        console.log(`   URI: ${postUri}`);
        
        // Mark as processed
        this.processedPosts.add(postUri);
        
        // Check if already replied to this post
        const alreadyReplied = await this.hasAlreadyReplied(postUri);
        if (alreadyReplied) {
          console.log('   ⏭️  Already replied, skipping');
          return;
        }
        
        // If this is a reply, we need to get the video from the parent post
        let videoSourcePost = post;
        
        if (post.reply?.parent?.uri) {
          console.log('   📝 This is a reply, fetching parent post for video...');
          try {
            const parentThread = await this.agent.getPostThread({ uri: post.reply.parent.uri });
            if ('post' in parentThread.data.thread) {
              videoSourcePost = (parentThread.data.thread as any).post.record;
              console.log(`   👆 Parent post URI: ${post.reply.parent.uri}`);
            }
          } catch (error) {
            console.log('   ⚠️  Could not fetch parent post, using current post');
          }
        }
        
        // Process: reply to postUri (the one with hashtag), but get video from videoSourcePost
        await this.processPost(postUri, videoSourcePost);
        
      } catch (error) {
        console.error('Error processing post:', error);
      }
    });

    jetstream.start();
    console.log('🚀 Firehose bot started, monitoring for posts...');
    
    // Handle shutdown signals
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      jetstream.close();
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down gracefully...');
      jetstream.close();
      process.exit(0);
    });
    
    // Keep the process alive indefinitely
    // This prevents the start() method from returning
    await new Promise(() => {});
  }

  private async hasAlreadyReplied(postUri: string): Promise<boolean> {
    try {
      const thread = await this.agent.getPostThread({ uri: postUri });
      if ('replies' in thread.data.thread && Array.isArray((thread.data.thread as any).replies)) {
        return (thread.data.thread as any).replies.some((reply: any) => 
          reply.post?.author?.did === this.agent.session?.did
        );
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private async processPost(postUri: string, post: any) {
    // Extract video URL from embed
    let videoUrl: string | null = null;
    
    if (post.embed?.external?.uri) {
      videoUrl = post.embed.external.uri;
    }
    
    if (!videoUrl) {
      console.log('   ⏭️  No video URL found in embed');
      return;
    }
    
    // Check if it's a YouTube URL
    if (!this.isYouTubeUrl(videoUrl)) {
      console.log(`   ⏭️  Not a YouTube URL: ${videoUrl}`);
      return;
    }
    
    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) {
      console.log('   ⏭️  Could not extract video ID');
      return;
    }
    
    console.log(`   🎬 YouTube video ID: ${videoId}`);
    
    // Create privacy link
    const privacyUrl = `https://videoprivacy.org/video?video=${videoId}`;
    
    // Reply with privacy link
    await this.replyWithPrivacyLink(postUri, privacyUrl, videoId);
  }

  private isYouTubeUrl(url: string): boolean {
    return /(?:youtube\.com|youtu\.be)/i.test(url);
  }

  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private async replyWithPrivacyLink(postUri: string, privacyUrl: string, videoId: string) {
    try {
      console.log(`   💬 Creating reply with privacy link...`);
      
      // Fetch video metadata
      const metadata = await this.fetchVideoMetadata(videoId);
      
      // Build reply text
      const replyText = `The Video Privacy Link You Requested:\n${privacyUrl}\n\nPost the hashtag ${this.config.hashtag} on any post containing a YouTube video to have an ad-free version provided.`;
      
      // Create rich text with clickable link
      const rt = new RichText({ text: replyText });
      await rt.detectFacets(this.agent);
      
      // Get thumbnail
      const thumbnailBlob = await this.fetchThumbnail(videoId);
      
      // Create reply
      await this.agent.post({
        text: rt.text,
        facets: rt.facets,
        reply: {
          root: { uri: postUri, cid: await this.getPostCid(postUri) },
          parent: { uri: postUri, cid: await this.getPostCid(postUri) }
        },
        embed: thumbnailBlob ? {
          $type: 'app.bsky.embed.external',
          external: {
            uri: privacyUrl,
            title: metadata?.title || 'Watch on VideoPrivacy.org',
            description: metadata?.description || `Watch ${videoId} by ${metadata?.author || 'YouTube'}`,
            thumb: thumbnailBlob
          }
        } : undefined
      });
      
      console.log(`   ✅ Reply posted successfully!`);
      
    } catch (error) {
      console.error('   ❌ Error posting reply:', error);
    }
  }

  private async getPostCid(uri: string): Promise<string> {
    const thread = await this.agent.getPostThread({ uri });
    return (thread.data.thread as any).post.cid;
  }

  private async fetchVideoMetadata(videoId: string) {
    try {
      const response = await fetch(`https://videoprivacy.org/api/metadata?videoId=${videoId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log('   ⚠️  Could not fetch metadata');
    }
    return null;
  }

  private async fetchThumbnail(videoId: string) {
    try {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      const overlayUrl = `https://videoprivacy.org/api/og-video-image?thumbnail=${encodeURIComponent(thumbnailUrl)}`;
      
      const response = await fetch(overlayUrl);
      if (!response.ok) return null;
      
      const imageBuffer = await response.arrayBuffer();
      const uploadResponse = await this.agent.uploadBlob(new Uint8Array(imageBuffer), {
        encoding: 'image/jpeg'
      });
      
      return uploadResponse.data.blob;
    } catch (error) {
      console.log('   ⚠️  Could not fetch thumbnail');
      return null;
    }
  }
}

// Run the bot
async function main() {
  const config: BotConfig = {
    handle: process.env.BLUESKY_HANDLE || '',
    password: process.env.BLUESKY_PASSWORD || '',
    hashtag: process.env.HASHTAG_TO_MONITOR || '#videoprivacy'
  };

  if (!config.handle || !config.password) {
    console.error('❌ Missing BLUESKY_HANDLE or BLUESKY_PASSWORD environment variables');
    process.exit(1);
  }

  const bot = new FirehoseBot(config);
  await bot.start();
}

main().catch(console.error);
