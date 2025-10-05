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
  private isProcessing: boolean = false;
  private recentlyProcessed: Set<string> = new Set();
  private readonly CACHE_SIZE = 100;
  private readonly MAX_AGE_HOURS = 24;
  private readonly CHECK_INTERVAL_MS = 30000;

  constructor(config: BotConfig) {
    this.agent = new BskyAgent({
      service: 'https://bsky.social'
    });
    this.config = config;
  }

  private containsHashtag(text: string): boolean {
    return text.toLowerCase().includes(this.config.hashtag.toLowerCase());
  }

  private async hasAlreadyReplied(postUri: string): Promise<boolean> {
    try {
      const threadResponse = await this.agent.app.bsky.feed.getPostThread({
        uri: postUri,
        depth: 1
      });

      if (threadResponse.data.thread && 'replies' in threadResponse.data.thread) {
        const replies = (threadResponse.data.thread as any).replies || [];
        
        for (const reply of replies) {
          if (reply.post?.author?.handle === this.config.handle) {
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error(`Error checking replies for ${postUri}:`, error);
      return false;
    }
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
      await this.checkTimeline();
      console.log('Single check completed');
    } catch (error) {
      console.error('Failed during single check:', error);
      throw error;
    }
  }

  private async startMonitoring(): Promise<void> {
    console.log('Starting to monitor timeline...');
    
    setInterval(async () => {
      try {
        await this.checkTimeline();
      } catch (error) {
        console.error('Error checking timeline:', error);
      }
    }, this.CHECK_INTERVAL_MS);
  }

  private async checkTimeline(): Promise<void> {
    if (this.isProcessing) {
      console.log('Already processing, skipping this check cycle...');
      return;
    }

    this.isProcessing = true;
    
    try {
      console.log(`Searching for posts with hashtag: ${this.config.hashtag}`);
      
      const response = await this.agent.app.bsky.feed.searchPosts({
        q: this.config.hashtag,
        limit: 25,
        sort: 'latest'
      });
      
      console.log(`Found ${response.data.posts.length} posts with hashtag`);
      
      const recentPosts = this.filterRecentPosts(response.data.posts);
      console.log(`${recentPosts.length} posts are from the last ${this.MAX_AGE_HOURS} hours`);
      
      let processedCount = 0;
      for (const post of recentPosts) {
        if (await this.processPostIfNeeded(post)) {
          processedCount++;
        }
      }
      
      console.log(`Processed ${processedCount} new posts out of ${recentPosts.length} recent posts`);
      
    } catch (error) {
      console.error('Error searching for posts:', error);
      console.log('Falling back to timeline check...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.checkTimelineFallback();
    } finally {
      this.isProcessing = false;
    }
  }

  private filterRecentPosts(posts: any[]): any[] {
    const cutoffTime = new Date(Date.now() - (this.MAX_AGE_HOURS * 60 * 60 * 1000));
    
    return posts.filter(post => {
      const postDate = new Date((post.record as any).createdAt);
      return postDate > cutoffTime;
    });
  }

  private async processPostIfNeeded(post: any): Promise<boolean> {
    if (!post.record || typeof post.record !== 'object' || !('text' in post.record)) {
      return false;
    }

    const text = post.record.text as string;
    
    if (!this.containsHashtag(text)) {
      return false;
    }

    if (this.recentlyProcessed.has(post.uri)) {
      return false;
    }

    const alreadyReplied = await this.hasAlreadyReplied(post.uri);
    if (alreadyReplied) {
      return false;
    }

    console.log(`Processing new post: ${text.substring(0, 100)}...`);
    
    this.addToProcessedCache(post.uri);
    
    try {
      if ((post.record as any).reply) {
        await this.processComment(post, text);
      } else {
        await this.processPost(post, text);
      }
      return true;
    } catch (error) {
      console.error('Error processing post:', error);
      return false;
    }
  }

  private addToProcessedCache(uri: string): void {
    this.recentlyProcessed.add(uri);
    
    if (this.recentlyProcessed.size > this.CACHE_SIZE) {
      const entries = Array.from(this.recentlyProcessed);
      this.recentlyProcessed.clear();
      entries.slice(-50).forEach(u => this.recentlyProcessed.add(u));
    }
  }

  private async checkTimelineFallback(): Promise<void> {
    try {
      console.log('Checking timeline fallback...');
      const response = await this.agent.getTimeline({
        algorithm: 'reverse-chronological',
        limit: 20
      });

      for (const item of response.data.feed) {
        await this.processPostIfNeeded(item.post);
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  }

  private async processPost(post: any, text: string): Promise<void> {
    console.log(`Processing post for video URLs: ${text.substring(0, 200)}`);

    if (!post.embed?.external?.uri) {
      console.log('No embed/external/uri found - skipping post');
      return;
    }

    const embedUri = post.embed.external.uri;
    console.log(`Using embed.external.uri: ${embedUri}`);
    
    const videoInfo = URLUtils.extractVideoInfo(embedUri);
    
    if (videoInfo?.url) {
      console.log(`Found ${videoInfo.platform} URL: ${videoInfo.url} (${videoInfo.type || 'video'})`);
      await this.replyWithPrivacyLink(post, videoInfo);
    } else {
      console.log(`Embed URI is not a supported video platform: ${embedUri}`);
    }
  }

  private async processComment(commentPost: any, commentText: string): Promise<void> {
    try {
      console.log(`Processing comment: ${commentText}`);
      
      const replyInfo = (commentPost.record as any).reply;
      const parentUri = replyInfo.parent.uri || replyInfo.root.uri;
      
      console.log(`Getting parent post: ${parentUri}`);
      
      const parentResponse = await this.agent.app.bsky.feed.getPostThread({
        uri: parentUri,
        depth: 0
      });
      
      if (!parentResponse?.data?.thread) {
        console.log('Could not retrieve parent post thread');
        return;
      }

      const parentPost = parentResponse.data.thread.post as any;
      
      if (!parentPost.embed?.external?.uri) {
        console.log('No embed/external/uri found in parent post');
        return;
      }

      const embedUri = parentPost.embed.external.uri;
      console.log(`Using embed.external.uri: ${embedUri}`);
      
      const videoInfo = URLUtils.extractVideoInfo(embedUri);
      
      if (videoInfo?.url) {
        console.log(`Found ${videoInfo.platform} URL in parent: ${videoInfo.url}`);
        await this.replyWithPrivacyLink(commentPost, videoInfo);
      } else {
        console.log(`Embed URI is not a supported video platform: ${embedUri}`);
      }
    } catch (error) {
      console.error('Error processing comment:', error);
    }
  }

  private async replyWithPrivacyLink(originalPost: any, videoInfo: VideoUrlInfo): Promise<void> {
    try {
      console.log(`Creating privacy link for ${videoInfo.platform}: ${videoInfo.url}`);
      const privacyUrl = await URLUtils.createPrivacyUrl(videoInfo.url, this.config.privacyDomain);
      
      const replyText = `The Video Privacy Link You Requested:\n${privacyUrl}`;
      
      console.log(`Posting reply to: ${originalPost.uri}`);
      
      const facets = this.createUrlFacets(replyText, privacyUrl);
      const replyStructure = this.createReplyStructure(originalPost);
      const embed = await this.createEmbedIfNeeded(videoInfo, privacyUrl);
      
      const postData: any = {
        text: replyText,
        facets: facets,
        reply: replyStructure
      };
      
      if (embed) {
        postData.embed = embed;
      }
      
      await this.agent.post(postData);
      
      console.log(`Successfully replied with privacy link: ${privacyUrl}`);
    } catch (error) {
      console.error('Error posting reply:', error);
    }
  }

  private createUrlFacets(text: string, url: string): any[] {
    const urlStart = text.indexOf(url);
    const urlByteStart = Buffer.byteLength(text.substring(0, urlStart), 'utf8');
    const urlByteEnd = urlByteStart + Buffer.byteLength(url, 'utf8');
    
    return [
      {
        index: {
          byteStart: urlByteStart,
          byteEnd: urlByteEnd
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri: url
          }
        ]
      }
    ];
  }

  private createReplyStructure(originalPost: any): any {
    if (originalPost.record?.reply) {
      const commentReplyInfo = originalPost.record.reply;
      return {
        root: {
          uri: commentReplyInfo.root.uri,
          cid: commentReplyInfo.root.cid
        },
        parent: {
          uri: originalPost.uri,
          cid: originalPost.cid
        }
      };
    }
    
    return {
      root: {
        uri: originalPost.uri,
        cid: originalPost.cid
      },
      parent: {
        uri: originalPost.uri,
        cid: originalPost.cid
      }
    };
  }

  private async createEmbedIfNeeded(videoInfo: VideoUrlInfo, privacyUrl: string): Promise<any | null> {
    if (videoInfo.platform !== 'youtube') {
      return null;
    }

    const embed: any = {
      $type: 'app.bsky.embed.external',
      external: {
        uri: privacyUrl,
        title: `WATCH: With Video Privacy`,
        description: `Use Hashtag #VideoPrivacy to watch without tracking, data collection or ads`
      }
    };
    
    try {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoInfo.id}/hqdefault.jpg`;
      console.log(`Fetching YouTube thumbnail: ${thumbnailUrl}`);
      
      const response = await fetch(thumbnailUrl);
      if (response.ok) {
        const imageBuffer = await response.arrayBuffer();
        const blob = await this.agent.uploadBlob(new Uint8Array(imageBuffer), {
          encoding: 'image/jpeg'
        });
        
        embed.external.thumb = blob.data.blob;
        console.log('Successfully uploaded YouTube thumbnail');
      } else {
        console.log(`Failed to fetch thumbnail: ${response.status}`);
      }
    } catch (error) {
      console.log('Failed to upload thumbnail, continuing without:', error);
    }
    
    return embed;
  }
}
