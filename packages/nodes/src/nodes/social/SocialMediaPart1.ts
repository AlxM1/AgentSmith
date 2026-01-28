import { createProgrammaticNode } from '@agentsmith/shared';

/**
 * Twitter/X API Node
 *
 * PRICING TIERS:
 * - Free: 1,500 tweets/month read, 500 tweets/month post (App-level)
 * - Basic: $100/month - 10,000 tweets/month read, 3,000 tweets/month post
 * - Pro: $5,000/month - 1M tweets/month read, 300,000 tweets/month post
 * - Enterprise: Custom pricing
 *
 * FREE TIER AVAILABLE: Yes (very limited)
 */
export const Twitter = createProgrammaticNode({
  name: 'Twitter',
  displayName: 'Twitter / X',
  description: 'Post tweets, read timelines, manage followers on Twitter/X. FREE TIER: 1,500 reads/month, 500 posts/month',
  icon: 'file:twitter.svg',
  group: ['social'],
  version: 1,
  defaults: { name: 'Twitter', color: '#1DA1F2' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'twitterOAuth2Api', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE TIER: 1,500 reads/month, 500 posts/month | 💰 Basic: $100/mo | Pro: $5,000/mo',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Post Tweet', value: 'postTweet' },
        { name: 'Delete Tweet', value: 'deleteTweet' },
        { name: 'Get Tweet', value: 'getTweet' },
        { name: 'Search Tweets', value: 'searchTweets' },
        { name: 'Get User Timeline', value: 'getUserTimeline' },
        { name: 'Get User', value: 'getUser' },
        { name: 'Get Followers', value: 'getFollowers' },
        { name: 'Get Following', value: 'getFollowing' },
        { name: 'Follow User', value: 'followUser' },
        { name: 'Unfollow User', value: 'unfollowUser' },
        { name: 'Like Tweet', value: 'likeTweet' },
        { name: 'Unlike Tweet', value: 'unlikeTweet' },
        { name: 'Retweet', value: 'retweet' },
        { name: 'Get Mentions', value: 'getMentions' },
      ],
      default: 'postTweet',
    },
    {
      displayName: 'Tweet Text',
      name: 'text',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      displayOptions: { show: { operation: ['postTweet'] } },
      description: 'Max 280 characters',
    },
    {
      displayName: 'Tweet ID',
      name: 'tweetId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['deleteTweet', 'getTweet', 'likeTweet', 'unlikeTweet', 'retweet'] } },
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getUser', 'getUserTimeline', 'getFollowers', 'getFollowing', 'followUser', 'unfollowUser'] } },
    },
    {
      displayName: 'Search Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['searchTweets'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Max Results', name: 'maxResults', type: 'number', default: 10 },
        { displayName: 'Reply To Tweet ID', name: 'replyToTweetId', type: 'string', default: '' },
        { displayName: 'Media IDs', name: 'mediaIds', type: 'string', default: '', description: 'Comma-separated media IDs' },
        { displayName: 'Include Retweets', name: 'includeRetweets', type: 'boolean', default: true },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('twitterOAuth2Api');
    const accessToken = credentials.accessToken as string;

    const baseUrl = 'https://api.twitter.com/2';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'postTweet': {
            const text = this.getNodeParameter('text', i) as string;
            const body: any = { text };

            if (options.replyToTweetId) {
              body.reply = { in_reply_to_tweet_id: options.replyToTweetId };
            }
            if (options.mediaIds) {
              body.media = { media_ids: options.mediaIds.split(',').map((id: string) => id.trim()) };
            }

            result = await twitterRequest('POST', `${baseUrl}/tweets`, body, accessToken);
            break;
          }

          case 'deleteTweet': {
            const tweetId = this.getNodeParameter('tweetId', i) as string;
            result = await twitterRequest('DELETE', `${baseUrl}/tweets/${tweetId}`, null, accessToken);
            break;
          }

          case 'getTweet': {
            const tweetId = this.getNodeParameter('tweetId', i) as string;
            result = await twitterRequest('GET', `${baseUrl}/tweets/${tweetId}?tweet.fields=created_at,public_metrics,author_id`, null, accessToken);
            break;
          }

          case 'searchTweets': {
            const query = this.getNodeParameter('query', i) as string;
            const maxResults = options.maxResults || 10;
            result = await twitterRequest('GET', `${baseUrl}/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}&tweet.fields=created_at,public_metrics,author_id`, null, accessToken);
            break;
          }

          case 'getUser': {
            const username = this.getNodeParameter('username', i) as string;
            result = await twitterRequest('GET', `${baseUrl}/users/by/username/${username}?user.fields=description,public_metrics,profile_image_url,verified`, null, accessToken);
            break;
          }

          case 'getUserTimeline': {
            const username = this.getNodeParameter('username', i) as string;
            const maxResults = options.maxResults || 10;
            const user = await twitterRequest('GET', `${baseUrl}/users/by/username/${username}`, null, accessToken);
            result = await twitterRequest('GET', `${baseUrl}/users/${user.data.id}/tweets?max_results=${maxResults}&tweet.fields=created_at,public_metrics`, null, accessToken);
            break;
          }

          case 'getFollowers': {
            const username = this.getNodeParameter('username', i) as string;
            const maxResults = options.maxResults || 10;
            const user = await twitterRequest('GET', `${baseUrl}/users/by/username/${username}`, null, accessToken);
            result = await twitterRequest('GET', `${baseUrl}/users/${user.data.id}/followers?max_results=${maxResults}&user.fields=description,public_metrics`, null, accessToken);
            break;
          }

          case 'getFollowing': {
            const username = this.getNodeParameter('username', i) as string;
            const maxResults = options.maxResults || 10;
            const user = await twitterRequest('GET', `${baseUrl}/users/by/username/${username}`, null, accessToken);
            result = await twitterRequest('GET', `${baseUrl}/users/${user.data.id}/following?max_results=${maxResults}&user.fields=description,public_metrics`, null, accessToken);
            break;
          }

          case 'followUser': {
            const username = this.getNodeParameter('username', i) as string;
            const targetUser = await twitterRequest('GET', `${baseUrl}/users/by/username/${username}`, null, accessToken);
            const me = await twitterRequest('GET', `${baseUrl}/users/me`, null, accessToken);
            result = await twitterRequest('POST', `${baseUrl}/users/${me.data.id}/following`, { target_user_id: targetUser.data.id }, accessToken);
            break;
          }

          case 'unfollowUser': {
            const username = this.getNodeParameter('username', i) as string;
            const targetUser = await twitterRequest('GET', `${baseUrl}/users/by/username/${username}`, null, accessToken);
            const me = await twitterRequest('GET', `${baseUrl}/users/me`, null, accessToken);
            result = await twitterRequest('DELETE', `${baseUrl}/users/${me.data.id}/following/${targetUser.data.id}`, null, accessToken);
            break;
          }

          case 'likeTweet': {
            const tweetId = this.getNodeParameter('tweetId', i) as string;
            const me = await twitterRequest('GET', `${baseUrl}/users/me`, null, accessToken);
            result = await twitterRequest('POST', `${baseUrl}/users/${me.data.id}/likes`, { tweet_id: tweetId }, accessToken);
            break;
          }

          case 'unlikeTweet': {
            const tweetId = this.getNodeParameter('tweetId', i) as string;
            const me = await twitterRequest('GET', `${baseUrl}/users/me`, null, accessToken);
            result = await twitterRequest('DELETE', `${baseUrl}/users/${me.data.id}/likes/${tweetId}`, null, accessToken);
            break;
          }

          case 'retweet': {
            const tweetId = this.getNodeParameter('tweetId', i) as string;
            const me = await twitterRequest('GET', `${baseUrl}/users/me`, null, accessToken);
            result = await twitterRequest('POST', `${baseUrl}/users/${me.data.id}/retweets`, { tweet_id: tweetId }, accessToken);
            break;
          }

          case 'getMentions': {
            const maxResults = options.maxResults || 10;
            const me = await twitterRequest('GET', `${baseUrl}/users/me`, null, accessToken);
            result = await twitterRequest('GET', `${baseUrl}/users/${me.data.id}/mentions?max_results=${maxResults}&tweet.fields=created_at,public_metrics,author_id`, null, accessToken);
            break;
          }
        }

        returnData.push({ json: result.data || result });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

/**
 * LinkedIn API Node
 *
 * PRICING TIERS:
 * - Free: Basic profile access, share posts (limited)
 * - Marketing API: Requires LinkedIn Marketing Partner or approved app
 * - Sales Navigator API: Enterprise only
 *
 * FREE TIER AVAILABLE: Yes (personal profiles, basic posting)
 */
export const LinkedIn = createProgrammaticNode({
  name: 'LinkedIn',
  displayName: 'LinkedIn',
  description: 'Post updates, manage company pages, access profile data. FREE TIER: Basic profile & posting',
  icon: 'file:linkedin.svg',
  group: ['social'],
  version: 1,
  defaults: { name: 'LinkedIn', color: '#0A66C2' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'linkedInOAuth2Api', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: Basic profile & posting | 💰 Marketing API: Partner approval required | Enterprise: Sales Navigator API',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Create Post', value: 'createPost' },
        { name: 'Delete Post', value: 'deletePost' },
        { name: 'Get Profile', value: 'getProfile' },
        { name: 'Get Company', value: 'getCompany' },
        { name: 'Share Article', value: 'shareArticle' },
        { name: 'Upload Image', value: 'uploadImage' },
        { name: 'Get Connections', value: 'getConnections' },
      ],
      default: 'createPost',
    },
    {
      displayName: 'Text',
      name: 'text',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      displayOptions: { show: { operation: ['createPost', 'shareArticle'] } },
    },
    {
      displayName: 'Post ID',
      name: 'postId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['deletePost'] } },
    },
    {
      displayName: 'Company ID',
      name: 'companyId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getCompany', 'createPost'] } },
      description: 'Leave empty to post as personal profile',
    },
    {
      displayName: 'Article URL',
      name: 'articleUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['shareArticle'] } },
    },
    {
      displayName: 'Article Title',
      name: 'articleTitle',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['shareArticle'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Visibility',
          name: 'visibility',
          type: 'options',
          options: [
            { name: 'Public', value: 'PUBLIC' },
            { name: 'Connections Only', value: 'CONNECTIONS' },
          ],
          default: 'PUBLIC',
        },
        { displayName: 'Media Asset', name: 'mediaAsset', type: 'string', default: '' },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('linkedInOAuth2Api');
    const accessToken = credentials.accessToken as string;

    const baseUrl = 'https://api.linkedin.com/v2';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'getProfile': {
            result = await linkedInRequest('GET', `${baseUrl}/me?projection=(id,firstName,lastName,profilePicture,headline)`, null, accessToken);
            break;
          }

          case 'createPost': {
            const text = this.getNodeParameter('text', i) as string;
            const companyId = this.getNodeParameter('companyId', i) as string;

            // Get current user's URN
            const me = await linkedInRequest('GET', `${baseUrl}/me`, null, accessToken);
            const authorUrn = companyId
              ? `urn:li:organization:${companyId}`
              : `urn:li:person:${me.id}`;

            const body: any = {
              author: authorUrn,
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text },
                  shareMediaCategory: 'NONE',
                },
              },
              visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': options.visibility || 'PUBLIC',
              },
            };

            if (options.mediaAsset) {
              body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
              body.specificContent['com.linkedin.ugc.ShareContent'].media = [{
                status: 'READY',
                media: options.mediaAsset,
              }];
            }

            result = await linkedInRequest('POST', `${baseUrl}/ugcPosts`, body, accessToken);
            break;
          }

          case 'shareArticle': {
            const text = this.getNodeParameter('text', i) as string;
            const articleUrl = this.getNodeParameter('articleUrl', i) as string;
            const articleTitle = this.getNodeParameter('articleTitle', i) as string;

            const me = await linkedInRequest('GET', `${baseUrl}/me`, null, accessToken);

            const body = {
              author: `urn:li:person:${me.id}`,
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text },
                  shareMediaCategory: 'ARTICLE',
                  media: [{
                    status: 'READY',
                    originalUrl: articleUrl,
                    title: { text: articleTitle },
                  }],
                },
              },
              visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': options.visibility || 'PUBLIC',
              },
            };

            result = await linkedInRequest('POST', `${baseUrl}/ugcPosts`, body, accessToken);
            break;
          }

          case 'deletePost': {
            const postId = this.getNodeParameter('postId', i) as string;
            await linkedInRequest('DELETE', `${baseUrl}/ugcPosts/${postId}`, null, accessToken);
            result = { success: true, postId };
            break;
          }

          case 'getCompany': {
            const companyId = this.getNodeParameter('companyId', i) as string;
            result = await linkedInRequest('GET', `${baseUrl}/organizations/${companyId}?projection=(id,name,description,logoV2,websiteUrl)`, null, accessToken);
            break;
          }

          case 'getConnections': {
            result = await linkedInRequest('GET', `${baseUrl}/connections?q=viewer&count=50`, null, accessToken);
            break;
          }
        }

        returnData.push({ json: result });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

/**
 * Facebook/Meta API Node
 *
 * PRICING TIERS:
 * - Free: Page management, posting, basic insights (with app review)
 * - Marketing API: Free with spending limits
 * - WhatsApp Business: Pay per conversation
 *
 * FREE TIER AVAILABLE: Yes (requires app review for production)
 */
export const Facebook = createProgrammaticNode({
  name: 'Facebook',
  displayName: 'Facebook',
  description: 'Manage pages, post content, access insights. FREE TIER: Full API access (requires app review)',
  icon: 'file:facebook.svg',
  group: ['social'],
  version: 1,
  defaults: { name: 'Facebook', color: '#1877F2' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'facebookOAuth2Api', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: Full API access | Requires Meta app review for production use',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Create Post', value: 'createPost' },
        { name: 'Create Photo Post', value: 'createPhotoPost' },
        { name: 'Create Video Post', value: 'createVideoPost' },
        { name: 'Delete Post', value: 'deletePost' },
        { name: 'Get Page Posts', value: 'getPagePosts' },
        { name: 'Get Post', value: 'getPost' },
        { name: 'Get Page Insights', value: 'getPageInsights' },
        { name: 'Get User Pages', value: 'getUserPages' },
        { name: 'Get Comments', value: 'getComments' },
        { name: 'Reply to Comment', value: 'replyToComment' },
      ],
      default: 'createPost',
    },
    {
      displayName: 'Page ID',
      name: 'pageId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createPost', 'createPhotoPost', 'createVideoPost', 'getPagePosts', 'getPageInsights'] } },
    },
    {
      displayName: 'Message',
      name: 'message',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      displayOptions: { show: { operation: ['createPost', 'createPhotoPost', 'createVideoPost', 'replyToComment'] } },
    },
    {
      displayName: 'Post ID',
      name: 'postId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['deletePost', 'getPost', 'getComments'] } },
    },
    {
      displayName: 'Comment ID',
      name: 'commentId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['replyToComment'] } },
    },
    {
      displayName: 'Image URL',
      name: 'imageUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createPhotoPost'] } },
    },
    {
      displayName: 'Video URL',
      name: 'videoUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createVideoPost'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Link URL', name: 'link', type: 'string', default: '' },
        { displayName: 'Scheduled Publish Time', name: 'scheduledTime', type: 'dateTime', default: '' },
        { displayName: 'Max Results', name: 'limit', type: 'number', default: 25 },
        {
          displayName: 'Metric',
          name: 'metric',
          type: 'options',
          options: [
            { name: 'Page Impressions', value: 'page_impressions' },
            { name: 'Page Engaged Users', value: 'page_engaged_users' },
            { name: 'Page Post Engagements', value: 'page_post_engagements' },
            { name: 'Page Fans', value: 'page_fans' },
          ],
          default: 'page_impressions',
        },
        {
          displayName: 'Period',
          name: 'period',
          type: 'options',
          options: [
            { name: 'Day', value: 'day' },
            { name: 'Week', value: 'week' },
            { name: 'Month', value: 'days_28' },
          ],
          default: 'day',
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('facebookOAuth2Api');
    const accessToken = credentials.accessToken as string;

    const baseUrl = 'https://graph.facebook.com/v18.0';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'createPost': {
            const pageId = this.getNodeParameter('pageId', i) as string;
            const message = this.getNodeParameter('message', i) as string;

            const body: any = { message };
            if (options.link) body.link = options.link;
            if (options.scheduledTime) {
              body.published = false;
              body.scheduled_publish_time = Math.floor(new Date(options.scheduledTime).getTime() / 1000);
            }

            result = await facebookRequest('POST', `${baseUrl}/${pageId}/feed`, body, accessToken);
            break;
          }

          case 'createPhotoPost': {
            const pageId = this.getNodeParameter('pageId', i) as string;
            const message = this.getNodeParameter('message', i) as string;
            const imageUrl = this.getNodeParameter('imageUrl', i) as string;

            result = await facebookRequest('POST', `${baseUrl}/${pageId}/photos`, {
              message,
              url: imageUrl,
            }, accessToken);
            break;
          }

          case 'createVideoPost': {
            const pageId = this.getNodeParameter('pageId', i) as string;
            const message = this.getNodeParameter('message', i) as string;
            const videoUrl = this.getNodeParameter('videoUrl', i) as string;

            result = await facebookRequest('POST', `${baseUrl}/${pageId}/videos`, {
              description: message,
              file_url: videoUrl,
            }, accessToken);
            break;
          }

          case 'deletePost': {
            const postId = this.getNodeParameter('postId', i) as string;
            await facebookRequest('DELETE', `${baseUrl}/${postId}`, null, accessToken);
            result = { success: true, postId };
            break;
          }

          case 'getPost': {
            const postId = this.getNodeParameter('postId', i) as string;
            result = await facebookRequest('GET', `${baseUrl}/${postId}?fields=id,message,created_time,shares,likes.summary(true),comments.summary(true)`, null, accessToken);
            break;
          }

          case 'getPagePosts': {
            const pageId = this.getNodeParameter('pageId', i) as string;
            const limit = options.limit || 25;
            result = await facebookRequest('GET', `${baseUrl}/${pageId}/posts?fields=id,message,created_time,shares,likes.summary(true),comments.summary(true)&limit=${limit}`, null, accessToken);
            break;
          }

          case 'getPageInsights': {
            const pageId = this.getNodeParameter('pageId', i) as string;
            const metric = options.metric || 'page_impressions';
            const period = options.period || 'day';
            result = await facebookRequest('GET', `${baseUrl}/${pageId}/insights/${metric}?period=${period}`, null, accessToken);
            break;
          }

          case 'getUserPages': {
            result = await facebookRequest('GET', `${baseUrl}/me/accounts?fields=id,name,access_token,category`, null, accessToken);
            break;
          }

          case 'getComments': {
            const postId = this.getNodeParameter('postId', i) as string;
            const limit = options.limit || 25;
            result = await facebookRequest('GET', `${baseUrl}/${postId}/comments?fields=id,message,from,created_time&limit=${limit}`, null, accessToken);
            break;
          }

          case 'replyToComment': {
            const commentId = this.getNodeParameter('commentId', i) as string;
            const message = this.getNodeParameter('message', i) as string;
            result = await facebookRequest('POST', `${baseUrl}/${commentId}/comments`, { message }, accessToken);
            break;
          }
        }

        returnData.push({ json: result.data || result });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

/**
 * Instagram API Node (via Facebook Graph API)
 *
 * PRICING TIERS:
 * - Free: Business/Creator account required, posting, insights
 * - Requires Facebook app review for production
 *
 * FREE TIER AVAILABLE: Yes (Business/Creator accounts only)
 */
export const Instagram = createProgrammaticNode({
  name: 'Instagram',
  displayName: 'Instagram',
  description: 'Post content, get insights, manage comments. FREE TIER: Full access for Business/Creator accounts',
  icon: 'file:instagram.svg',
  group: ['social'],
  version: 1,
  defaults: { name: 'Instagram', color: '#E4405F' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'instagramOAuth2Api', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: Full API access | Requires Business/Creator account + Meta app review',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Create Media Post', value: 'createMedia' },
        { name: 'Create Carousel Post', value: 'createCarousel' },
        { name: 'Create Reel', value: 'createReel' },
        { name: 'Get Media', value: 'getMedia' },
        { name: 'Get User Media', value: 'getUserMedia' },
        { name: 'Get Insights', value: 'getInsights' },
        { name: 'Get Comments', value: 'getComments' },
        { name: 'Reply to Comment', value: 'replyToComment' },
        { name: 'Delete Comment', value: 'deleteComment' },
        { name: 'Get Profile', value: 'getProfile' },
      ],
      default: 'createMedia',
    },
    {
      displayName: 'Instagram Account ID',
      name: 'accountId',
      type: 'string',
      default: '',
      description: 'Instagram Business Account ID',
    },
    {
      displayName: 'Image URL',
      name: 'imageUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createMedia'] } },
    },
    {
      displayName: 'Video URL',
      name: 'videoUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createReel'] } },
    },
    {
      displayName: 'Caption',
      name: 'caption',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      displayOptions: { show: { operation: ['createMedia', 'createCarousel', 'createReel'] } },
    },
    {
      displayName: 'Media ID',
      name: 'mediaId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getMedia', 'getInsights', 'getComments'] } },
    },
    {
      displayName: 'Comment ID',
      name: 'commentId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['replyToComment', 'deleteComment'] } },
    },
    {
      displayName: 'Reply Text',
      name: 'replyText',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['replyToComment'] } },
    },
    {
      displayName: 'Carousel Items',
      name: 'carouselItems',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { operation: ['createCarousel'] } },
      options: [
        {
          displayName: 'Item',
          name: 'item',
          values: [
            { displayName: 'Media Type', name: 'mediaType', type: 'options', options: [{ name: 'Image', value: 'IMAGE' }, { name: 'Video', value: 'VIDEO' }], default: 'IMAGE' },
            { displayName: 'Media URL', name: 'mediaUrl', type: 'string', default: '' },
          ],
        },
      ],
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Location ID', name: 'locationId', type: 'string', default: '' },
        { displayName: 'Max Results', name: 'limit', type: 'number', default: 25 },
        { displayName: 'User Tags', name: 'userTags', type: 'string', default: '', description: 'Comma-separated user IDs to tag' },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('instagramOAuth2Api');
    const accessToken = credentials.accessToken as string;

    const baseUrl = 'https://graph.facebook.com/v18.0';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const accountId = this.getNodeParameter('accountId', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'createMedia': {
            const imageUrl = this.getNodeParameter('imageUrl', i) as string;
            const caption = this.getNodeParameter('caption', i) as string;

            // Step 1: Create media container
            const container = await facebookRequest('POST', `${baseUrl}/${accountId}/media`, {
              image_url: imageUrl,
              caption,
              location_id: options.locationId || undefined,
            }, accessToken);

            // Step 2: Publish the container
            result = await facebookRequest('POST', `${baseUrl}/${accountId}/media_publish`, {
              creation_id: container.id,
            }, accessToken);
            break;
          }

          case 'createReel': {
            const videoUrl = this.getNodeParameter('videoUrl', i) as string;
            const caption = this.getNodeParameter('caption', i) as string;

            const container = await facebookRequest('POST', `${baseUrl}/${accountId}/media`, {
              media_type: 'REELS',
              video_url: videoUrl,
              caption,
            }, accessToken);

            // Wait for video processing (in production, poll status)
            await new Promise(resolve => setTimeout(resolve, 5000));

            result = await facebookRequest('POST', `${baseUrl}/${accountId}/media_publish`, {
              creation_id: container.id,
            }, accessToken);
            break;
          }

          case 'createCarousel': {
            const caption = this.getNodeParameter('caption', i) as string;
            const carouselItems = this.getNodeParameter('carouselItems', i) as any;

            // Create containers for each item
            const childContainers: string[] = [];
            for (const item of carouselItems.item || []) {
              const container = await facebookRequest('POST', `${baseUrl}/${accountId}/media`, {
                media_type: item.mediaType,
                [item.mediaType === 'IMAGE' ? 'image_url' : 'video_url']: item.mediaUrl,
                is_carousel_item: true,
              }, accessToken);
              childContainers.push(container.id);
            }

            // Create carousel container
            const carouselContainer = await facebookRequest('POST', `${baseUrl}/${accountId}/media`, {
              media_type: 'CAROUSEL',
              caption,
              children: childContainers.join(','),
            }, accessToken);

            result = await facebookRequest('POST', `${baseUrl}/${accountId}/media_publish`, {
              creation_id: carouselContainer.id,
            }, accessToken);
            break;
          }

          case 'getMedia': {
            const mediaId = this.getNodeParameter('mediaId', i) as string;
            result = await facebookRequest('GET', `${baseUrl}/${mediaId}?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count`, null, accessToken);
            break;
          }

          case 'getUserMedia': {
            const limit = options.limit || 25;
            result = await facebookRequest('GET', `${baseUrl}/${accountId}/media?fields=id,caption,media_type,media_url,timestamp,like_count,comments_count&limit=${limit}`, null, accessToken);
            break;
          }

          case 'getInsights': {
            const mediaId = this.getNodeParameter('mediaId', i) as string;
            result = await facebookRequest('GET', `${baseUrl}/${mediaId}/insights?metric=engagement,impressions,reach,saved`, null, accessToken);
            break;
          }

          case 'getComments': {
            const mediaId = this.getNodeParameter('mediaId', i) as string;
            result = await facebookRequest('GET', `${baseUrl}/${mediaId}/comments?fields=id,text,username,timestamp`, null, accessToken);
            break;
          }

          case 'replyToComment': {
            const commentId = this.getNodeParameter('commentId', i) as string;
            const replyText = this.getNodeParameter('replyText', i) as string;
            result = await facebookRequest('POST', `${baseUrl}/${commentId}/replies`, { message: replyText }, accessToken);
            break;
          }

          case 'deleteComment': {
            const commentId = this.getNodeParameter('commentId', i) as string;
            await facebookRequest('DELETE', `${baseUrl}/${commentId}`, null, accessToken);
            result = { success: true, commentId };
            break;
          }

          case 'getProfile': {
            result = await facebookRequest('GET', `${baseUrl}/${accountId}?fields=id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website`, null, accessToken);
            break;
          }
        }

        returnData.push({ json: result.data || result });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

// Helper functions
async function twitterRequest(method: string, url: string, body: any, accessToken: string): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twitter API error: ${response.status} - ${error}`);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}

async function linkedInRequest(method: string, url: string, body: any, accessToken: string): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn API error: ${response.status} - ${error}`);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}

async function facebookRequest(method: string, url: string, body: any, accessToken: string): Promise<any> {
  let fetchUrl = url;
  let fetchBody: string | undefined;

  if (method === 'GET') {
    fetchUrl += (url.includes('?') ? '&' : '?') + `access_token=${accessToken}`;
  } else {
    fetchBody = JSON.stringify({ ...body, access_token: accessToken });
  }

  const response = await fetch(fetchUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: fetchBody,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Facebook API error: ${response.status} - ${error}`);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}
