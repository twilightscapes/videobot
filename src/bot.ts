import { BskyAgent } from '@atproto/api';
import WebSocket from 'ws';
import { URLUtils, VideoUrlInfo } from './utils';

export interface BotConfig {
  handle: string;
  password: string;
  hashtag: string;
  privacyDomain: string;
}

export class BskyBot {
  private agent: BskyAgent;
  private config: BotConfig;
  private processedPosts = new Set<string>();

  constructor(config: BotConfig) {
    this.config = config;
    this.agent = new BskyAgent({
      service: 'https://bsky.social'
    });
  }

  async start(): Promise<void> {
    console.log(`Logging in as ${this.config.handle}...`);
    
    try {
      await this.agent.login({
        identifier: this.config.handle,
        password: this.config.password
      });
      
      console.log('Successfully logged in to Bluesky');
      console.log(`Monitoring for hashtag: ${this.config.hashtag}`);
      
      await this.startMonitoring();
    } catch (error) {
      console.error('Failed to login:', error);
      throw error;
    }
  }

  async runSingleCheck(): Promise<void> {
    console.log(`Running single check as ${this.config.handle}...`);
    
    try {
      await this.agent.login({
        identifier: this.config.handle,
        password: this.config.password
      });
      
      console.log('Successfully logged in to Bluesky');
      console.log(`Checking for hashtag: ${this.config.hashtag}`);
      
      // Run a single timeline check
      await this.checkTimeline();
      console.log('Single check completed');
    } catch (error) {
      console.error('Failed during single check:', error);
      throw error;
    }
  }

  private async startMonitoring(): Promise<void> {
    // For now, we'll use a simple polling approach
    // In a production bot, you'd want to use the firehose WebSocket
    console.log('Starting to monitor timeline...');
    
    setInterval(async () => {
      try {
        await this.checkTimeline();
      } catch (error) {
        console.error('Error checking timeline:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private async checkTimeline(): Promise<void> {
    try {
      const response = await this.agent.getTimeline({
        algorithm: 'reverse-chronological',
        limit: 20
      });

      for (const item of response.data.feed) {
        if (item.post.record && typeof item.post.record === 'object' && 'text' in item.post.record) {
          const text = item.post.record.text as string;
          
          // Check if post contains our hashtag and hasn't been processed
          if (text.includes(this.config.hashtag) && !this.processedPosts.has(item.post.uri)) {
            console.log(`Found post with hashtag: ${text.substring(0, 100)}...`);
            await this.processPost(item.post, text);
            this.processedPosts.add(item.post.uri);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  }

  private async processPost(post: any, text: string): Promise<void> {
    const videoInfo = URLUtils.extractVideoInfo(text);
    
    if (videoInfo) {
      console.log(`Found ${videoInfo.platform} URL: ${videoInfo.url} (${videoInfo.type || 'video'})`);
      await this.replyWithPrivacyLink(post, videoInfo);
    }
  }

  private extractYouTubeURL(text: string): string | null {
    const info = URLUtils.extractVideoInfo(text);
    return info && info.platform === 'youtube' ? info.url : null;
  }

  private async replyWithPrivacyLink(originalPost: any, videoInfo: VideoUrlInfo): Promise<void> {
    try {
      const privacyUrl = URLUtils.createPrivacyUrl(videoInfo.url, this.config.privacyDomain);
      
      const platformEmoji = this.getPlatformEmoji(videoInfo.platform);
      const replyText = `🔒 Here's a privacy-friendly ${videoInfo.platform} link: ${privacyUrl} ${platformEmoji}`;
      
      await this.agent.post({
        text: replyText,
        reply: {
          root: originalPost.uri,
          parent: originalPost.uri
        }
      });
      
      console.log(`Replied with privacy link: ${privacyUrl}`);
    } catch (error) {
      console.error('Error posting reply:', error);
    }
  }

  private getPlatformEmoji(platform: string): string {
    const emojis: { [key: string]: string } = {
      'youtube': '📺',
      'tiktok': '🎵',
      'vimeo': '🎬',
      'twitch': '🎮',
      'dailymotion': '📹'
    };
    return emojis[platform] || '🎥';
  }
}
