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
    // YouTube - Enhanced patterns to capture full URLs
    const youtubePatterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:\S*)/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\S*)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:\S*)/
    ];

    for (const pattern of youtubePatterns) {
      const match = text.match(pattern);
      if (match) {
        let fullUrl = match[0];
        // Ensure URL has protocol
        if (!fullUrl.startsWith('http')) {
          fullUrl = 'https://' + fullUrl;
        }
        return {
          url: fullUrl,
          platform: 'youtube',
          id: match[1],
          type: match[0].includes('/shorts/') ? 'short' : 'video'
        };
      }
    }

    // Vimeo
    const vimeoMatch = text.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)(?:\S*)/);
    if (vimeoMatch) {
      let fullUrl = vimeoMatch[0];
      if (!fullUrl.startsWith('http')) {
        fullUrl = 'https://' + fullUrl;
      }
      return {
        url: fullUrl,
        platform: 'vimeo',
        id: vimeoMatch[1]
      };
    }

    // TikTok
    const tiktokMatch = text.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/.*\/video\/(\d+)(?:\S*)/);
    if (tiktokMatch) {
      let fullUrl = tiktokMatch[0];
      if (!fullUrl.startsWith('http')) {
        fullUrl = 'https://' + fullUrl;
      }
      return {
        url: fullUrl,
        platform: 'tiktok',
        id: tiktokMatch[1]
      };
    }

    // Twitch
    const twitchVideoMatch = text.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/videos\/(\d+)(?:\S*)/);
    if (twitchVideoMatch) {
      let fullUrl = twitchVideoMatch[0];
      if (!fullUrl.startsWith('http')) {
        fullUrl = 'https://' + fullUrl;
      }
      return {
        url: fullUrl,
        platform: 'twitch',
        id: twitchVideoMatch[1],
        type: 'video'
      };
    }

    const twitchClipMatch = text.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/\w+\/clip\/(\w+)|(?:https?:\/\/)?clips\.twitch\.tv\/(\w+)(?:\S*)/);
    if (twitchClipMatch) {
      const clipId = twitchClipMatch[1] || twitchClipMatch[2];
      let fullUrl = twitchClipMatch[0];
      if (!fullUrl.startsWith('http')) {
        fullUrl = 'https://' + fullUrl;
      }
      return {
        url: fullUrl,
        platform: 'twitch',
        id: clipId,
        type: 'clip'
      };
    }

    // Dailymotion
    const dailymotionMatch = text.match(/(?:https?:\/\/)?(?:www\.)?dailymotion\.com\/video\/([a-zA-Z0-9]+)(?:\S*)/);
    if (dailymotionMatch) {
      let fullUrl = dailymotionMatch[0];
      if (!fullUrl.startsWith('http')) {
        fullUrl = 'https://' + fullUrl;
      }
      return {
        url: fullUrl,
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
