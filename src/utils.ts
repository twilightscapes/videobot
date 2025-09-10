export interface VideoUrlInfo {
  url: string;
  platform: string;
  id: string;
  type?: string; // for twitch clips vs videos vs channels
}

export interface YouTubeUrlInfo {
  url: string;
  videoId: string;
  isShort: boolean;
}

export class URLUtils {
  /**
   * Extract video URL info from text for multiple platforms
   */
  static extractVideoInfo(text: string): VideoUrlInfo | null {
    // YouTube
    const youtubePatterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of youtubePatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          url: match[0],
          platform: 'youtube',
          id: match[1],
          type: match[0].includes('/shorts/') ? 'short' : 'video'
        };
      }
    }

    // Vimeo
    const vimeoMatch = text.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return {
        url: vimeoMatch[0],
        platform: 'vimeo',
        id: vimeoMatch[1]
      };
    }

    // TikTok
    const tiktokMatch = text.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/.*\/video\/(\d+)/);
    if (tiktokMatch) {
      return {
        url: tiktokMatch[0],
        platform: 'tiktok',
        id: tiktokMatch[1]
      };
    }

    // Twitch
    const twitchVideoMatch = text.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/videos\/(\d+)/);
    if (twitchVideoMatch) {
      return {
        url: twitchVideoMatch[0],
        platform: 'twitch',
        id: twitchVideoMatch[1],
        type: 'video'
      };
    }

    const twitchClipMatch = text.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/\w+\/clip\/(\w+)|(?:https?:\/\/)?clips\.twitch\.tv\/(\w+)/);
    if (twitchClipMatch) {
      const clipId = twitchClipMatch[1] || twitchClipMatch[2];
      return {
        url: twitchClipMatch[0],
        platform: 'twitch',
        id: clipId,
        type: 'clip'
      };
    }

    // Dailymotion
    const dailymotionMatch = text.match(/(?:https?:\/\/)?(?:www\.)?dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
    if (dailymotionMatch) {
      return {
        url: dailymotionMatch[0],
        platform: 'dailymotion',
        id: dailymotionMatch[1]
      };
    }

    return null;
  }

  /**
   * Extract YouTube URL and additional info from text (legacy method for backward compatibility)
   */
  static extractYouTubeInfo(text: string): YouTubeUrlInfo | null {
    const videoInfo = this.extractVideoInfo(text);
    if (videoInfo && videoInfo.platform === 'youtube') {
      return {
        url: videoInfo.url,
        videoId: videoInfo.id,
        isShort: videoInfo.type === 'short'
      };
    }
    return null;
  }

  /**
   * Generate privacy-friendly URL
   */
  static createPrivacyUrl(originalUrl: string, privacyDomain: string): string {
    return `https://${privacyDomain}/video?video=${encodeURIComponent(originalUrl)}`;
  }

  /**
   * Validate if a URL is a valid YouTube URL
   */
  static isValidYouTubeUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'youtube.com' || 
             urlObj.hostname === 'www.youtube.com' || 
             urlObj.hostname === 'youtu.be';
    } catch {
      return false;
    }
  }
}
