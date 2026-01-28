import { createProgrammaticNode } from '@agentsmith/shared';

/**
 * Mastodon API Node
 *
 * PRICING TIERS:
 * - Free: Completely free and open source
 * - Self-hosted or use any public instance
 *
 * FREE TIER AVAILABLE: Yes (100% free, open source)
 */
export const Mastodon = createProgrammaticNode({
  name: 'Mastodon',
  displayName: 'Mastodon',
  description: 'Post toots, follow users, browse timelines. 💚 100% FREE (open source, decentralized)',
  icon: 'file:mastodon.svg',
  group: ['social'],
  version: 1,
  defaults: { name: 'Mastodon', color: '#6364FF' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'mastodonApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: Open source, decentralized | No API limits on most instances',
    },
    {
      displayName: 'Instance URL',
      name: 'instanceUrl',
      type: 'string',
      default: 'https://mastodon.social',
      description: 'Your Mastodon instance URL',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Post Status (Toot)', value: 'postStatus' },
        { name: 'Delete Status', value: 'deleteStatus' },
        { name: 'Get Status', value: 'getStatus' },
        { name: 'Get Home Timeline', value: 'getHomeTimeline' },
        { name: 'Get Public Timeline', value: 'getPublicTimeline' },
        { name: 'Get User Statuses', value: 'getUserStatuses' },
        { name: 'Search', value: 'search' },
        { name: 'Get Account', value: 'getAccount' },
        { name: 'Get My Account', value: 'getMyAccount' },
        { name: 'Follow', value: 'follow' },
        { name: 'Unfollow', value: 'unfollow' },
        { name: 'Favourite', value: 'favourite' },
        { name: 'Unfavourite', value: 'unfavourite' },
        { name: 'Boost (Reblog)', value: 'boost' },
        { name: 'Unboost', value: 'unboost' },
        { name: 'Get Notifications', value: 'getNotifications' },
        { name: 'Get Followers', value: 'getFollowers' },
        { name: 'Get Following', value: 'getFollowing' },
      ],
      default: 'postStatus',
    },
    {
      displayName: 'Status Text',
      name: 'statusText',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      displayOptions: { show: { operation: ['postStatus'] } },
      description: 'Max 500 characters on most instances',
    },
    {
      displayName: 'Status ID',
      name: 'statusId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['deleteStatus', 'getStatus', 'favourite', 'unfavourite', 'boost', 'unboost'] } },
    },
    {
      displayName: 'Account ID',
      name: 'accountId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getAccount', 'getUserStatuses', 'follow', 'unfollow', 'getFollowers', 'getFollowing'] } },
    },
    {
      displayName: 'Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['search'] } },
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
            { name: 'Public', value: 'public' },
            { name: 'Unlisted', value: 'unlisted' },
            { name: 'Followers Only', value: 'private' },
            { name: 'Direct Message', value: 'direct' },
          ],
          default: 'public',
        },
        { displayName: 'Content Warning', name: 'spoilerText', type: 'string', default: '' },
        { displayName: 'Reply to ID', name: 'inReplyToId', type: 'string', default: '' },
        { displayName: 'Sensitive', name: 'sensitive', type: 'boolean', default: false },
        { displayName: 'Limit', name: 'limit', type: 'number', default: 20 },
        { displayName: 'Media IDs', name: 'mediaIds', type: 'string', default: '', description: 'Comma-separated media IDs' },
        { displayName: 'Local Only', name: 'local', type: 'boolean', default: false },
        {
          displayName: 'Search Type',
          name: 'searchType',
          type: 'options',
          options: [
            { name: 'All', value: '' },
            { name: 'Accounts', value: 'accounts' },
            { name: 'Hashtags', value: 'hashtags' },
            { name: 'Statuses', value: 'statuses' },
          ],
          default: '',
        },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('mastodonApi');
    const accessToken = credentials.accessToken as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const instanceUrl = (this.getNodeParameter('instanceUrl', i) as string).replace(/\/$/, '');
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'postStatus': {
            const statusText = this.getNodeParameter('statusText', i) as string;
            const body: any = { status: statusText };

            if (options.visibility) body.visibility = options.visibility;
            if (options.spoilerText) body.spoiler_text = options.spoilerText;
            if (options.inReplyToId) body.in_reply_to_id = options.inReplyToId;
            if (options.sensitive) body.sensitive = options.sensitive;
            if (options.mediaIds) body.media_ids = options.mediaIds.split(',').map((id: string) => id.trim());

            result = await mastodonRequest('POST', `${instanceUrl}/api/v1/statuses`, body, accessToken);
            break;
          }

          case 'deleteStatus': {
            const statusId = this.getNodeParameter('statusId', i) as string;
            result = await mastodonRequest('DELETE', `${instanceUrl}/api/v1/statuses/${statusId}`, null, accessToken);
            break;
          }

          case 'getStatus': {
            const statusId = this.getNodeParameter('statusId', i) as string;
            result = await mastodonRequest('GET', `${instanceUrl}/api/v1/statuses/${statusId}`, null, accessToken);
            break;
          }

          case 'getHomeTimeline': {
            const limit = options.limit || 20;
            result = await mastodonRequest('GET', `${instanceUrl}/api/v1/timelines/home?limit=${limit}`, null, accessToken);
            break;
          }

          case 'getPublicTimeline': {
            const limit = options.limit || 20;
            const local = options.local ? '&local=true' : '';
            result = await mastodonRequest('GET', `${instanceUrl}/api/v1/timelines/public?limit=${limit}${local}`, null, accessToken);
            break;
          }

          case 'getUserStatuses': {
            const accountId = this.getNodeParameter('accountId', i) as string;
            const limit = options.limit || 20;
            result = await mastodonRequest('GET', `${instanceUrl}/api/v1/accounts/${accountId}/statuses?limit=${limit}`, null, accessToken);
            break;
          }

          case 'search': {
            const query = this.getNodeParameter('query', i) as string;
            const limit = options.limit || 20;
            const type = options.searchType ? `&type=${options.searchType}` : '';
            result = await mastodonRequest('GET', `${instanceUrl}/api/v2/search?q=${encodeURIComponent(query)}&limit=${limit}${type}`, null, accessToken);
            break;
          }

          case 'getAccount': {
            const accountId = this.getNodeParameter('accountId', i) as string;
            result = await mastodonRequest('GET', `${instanceUrl}/api/v1/accounts/${accountId}`, null, accessToken);
            break;
          }

          case 'getMyAccount': {
            result = await mastodonRequest('GET', `${instanceUrl}/api/v1/accounts/verify_credentials`, null, accessToken);
            break;
          }

          case 'follow': {
            const accountId = this.getNodeParameter('accountId', i) as string;
            result = await mastodonRequest('POST', `${instanceUrl}/api/v1/accounts/${accountId}/follow`, {}, accessToken);
            break;
          }

          case 'unfollow': {
            const accountId = this.getNodeParameter('accountId', i) as string;
            result = await mastodonRequest('POST', `${instanceUrl}/api/v1/accounts/${accountId}/unfollow`, {}, accessToken);
            break;
          }

          case 'favourite': {
            const statusId = this.getNodeParameter('statusId', i) as string;
            result = await mastodonRequest('POST', `${instanceUrl}/api/v1/statuses/${statusId}/favourite`, {}, accessToken);
            break;
          }

          case 'unfavourite': {
            const statusId = this.getNodeParameter('statusId', i) as string;
            result = await mastodonRequest('POST', `${instanceUrl}/api/v1/statuses/${statusId}/unfavourite`, {}, accessToken);
            break;
          }

          case 'boost': {
            const statusId = this.getNodeParameter('statusId', i) as string;
            result = await mastodonRequest('POST', `${instanceUrl}/api/v1/statuses/${statusId}/reblog`, {}, accessToken);
            break;
          }

          case 'unboost': {
            const statusId = this.getNodeParameter('statusId', i) as string;
            result = await mastodonRequest('POST', `${instanceUrl}/api/v1/statuses/${statusId}/unreblog`, {}, accessToken);
            break;
          }

          case 'getNotifications': {
            const limit = options.limit || 20;
            result = await mastodonRequest('GET', `${instanceUrl}/api/v1/notifications?limit=${limit}`, null, accessToken);
            break;
          }

          case 'getFollowers': {
            const accountId = this.getNodeParameter('accountId', i) as string;
            const limit = options.limit || 20;
            result = await mastodonRequest('GET', `${instanceUrl}/api/v1/accounts/${accountId}/followers?limit=${limit}`, null, accessToken);
            break;
          }

          case 'getFollowing': {
            const accountId = this.getNodeParameter('accountId', i) as string;
            const limit = options.limit || 20;
            result = await mastodonRequest('GET', `${instanceUrl}/api/v1/accounts/${accountId}/following?limit=${limit}`, null, accessToken);
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
 * Bluesky API Node (AT Protocol)
 *
 * PRICING TIERS:
 * - Free: Completely free
 * - Open protocol, self-hostable
 *
 * FREE TIER AVAILABLE: Yes (100% free)
 */
export const Bluesky = createProgrammaticNode({
  name: 'Bluesky',
  displayName: 'Bluesky',
  description: 'Post skeets, follow users, browse feeds. 💚 100% FREE (open protocol)',
  icon: 'file:bluesky.svg',
  group: ['social'],
  version: 1,
  defaults: { name: 'Bluesky', color: '#0085FF' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'blueskyApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 100% FREE: Open AT Protocol | No API rate limits currently',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Create Post', value: 'createPost' },
        { name: 'Delete Post', value: 'deletePost' },
        { name: 'Get Post', value: 'getPost' },
        { name: 'Get Timeline', value: 'getTimeline' },
        { name: 'Get Author Feed', value: 'getAuthorFeed' },
        { name: 'Search Posts', value: 'searchPosts' },
        { name: 'Get Profile', value: 'getProfile' },
        { name: 'Get My Profile', value: 'getMyProfile' },
        { name: 'Follow', value: 'follow' },
        { name: 'Unfollow', value: 'unfollow' },
        { name: 'Like', value: 'like' },
        { name: 'Unlike', value: 'unlike' },
        { name: 'Repost', value: 'repost' },
        { name: 'Get Followers', value: 'getFollowers' },
        { name: 'Get Following', value: 'getFollowing' },
        { name: 'Get Notifications', value: 'getNotifications' },
      ],
      default: 'createPost',
    },
    {
      displayName: 'Post Text',
      name: 'postText',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      displayOptions: { show: { operation: ['createPost'] } },
      description: 'Max 300 characters',
    },
    {
      displayName: 'Post URI',
      name: 'postUri',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['deletePost', 'getPost', 'like', 'unlike', 'repost'] } },
    },
    {
      displayName: 'Handle/DID',
      name: 'actor',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getProfile', 'getAuthorFeed', 'follow', 'unfollow', 'getFollowers', 'getFollowing'] } },
      description: 'User handle (e.g., user.bsky.social) or DID',
    },
    {
      displayName: 'Search Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['searchPosts'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Limit', name: 'limit', type: 'number', default: 50 },
        { displayName: 'Reply To URI', name: 'replyToUri', type: 'string', default: '' },
        { displayName: 'Reply To CID', name: 'replyToCid', type: 'string', default: '' },
        { displayName: 'Embed URL', name: 'embedUrl', type: 'string', default: '' },
        { displayName: 'Image URL', name: 'imageUrl', type: 'string', default: '' },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('blueskyApi');

    const service = 'https://bsky.social';

    // Create session
    const session = await blueskyRequest('POST', `${service}/xrpc/com.atproto.server.createSession`, {
      identifier: credentials.identifier,
      password: credentials.password,
    }, null);

    const accessJwt = session.accessJwt;
    const did = session.did;

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'createPost': {
            const postText = this.getNodeParameter('postText', i) as string;
            const now = new Date().toISOString();

            const record: any = {
              $type: 'app.bsky.feed.post',
              text: postText,
              createdAt: now,
            };

            // Handle replies
            if (options.replyToUri && options.replyToCid) {
              const parentUri = options.replyToUri;
              const parentCid = options.replyToCid;
              record.reply = {
                root: { uri: parentUri, cid: parentCid },
                parent: { uri: parentUri, cid: parentCid },
              };
            }

            // Detect facets (mentions, links, hashtags)
            record.facets = detectFacets(postText);

            result = await blueskyRequest('POST', `${service}/xrpc/com.atproto.repo.createRecord`, {
              repo: did,
              collection: 'app.bsky.feed.post',
              record,
            }, accessJwt);
            break;
          }

          case 'deletePost': {
            const postUri = this.getNodeParameter('postUri', i) as string;
            const parts = postUri.split('/');
            const rkey = parts[parts.length - 1];

            result = await blueskyRequest('POST', `${service}/xrpc/com.atproto.repo.deleteRecord`, {
              repo: did,
              collection: 'app.bsky.feed.post',
              rkey,
            }, accessJwt);
            break;
          }

          case 'getPost': {
            const postUri = this.getNodeParameter('postUri', i) as string;
            result = await blueskyRequest('GET', `${service}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(postUri)}`, null, accessJwt);
            break;
          }

          case 'getTimeline': {
            const limit = options.limit || 50;
            result = await blueskyRequest('GET', `${service}/xrpc/app.bsky.feed.getTimeline?limit=${limit}`, null, accessJwt);
            break;
          }

          case 'getAuthorFeed': {
            const actor = this.getNodeParameter('actor', i) as string;
            const limit = options.limit || 50;
            result = await blueskyRequest('GET', `${service}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=${limit}`, null, accessJwt);
            break;
          }

          case 'searchPosts': {
            const query = this.getNodeParameter('query', i) as string;
            const limit = options.limit || 25;
            result = await blueskyRequest('GET', `${service}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`, null, accessJwt);
            break;
          }

          case 'getProfile': {
            const actor = this.getNodeParameter('actor', i) as string;
            result = await blueskyRequest('GET', `${service}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`, null, accessJwt);
            break;
          }

          case 'getMyProfile': {
            result = await blueskyRequest('GET', `${service}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`, null, accessJwt);
            break;
          }

          case 'follow': {
            const actor = this.getNodeParameter('actor', i) as string;
            const profile = await blueskyRequest('GET', `${service}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`, null, accessJwt);

            result = await blueskyRequest('POST', `${service}/xrpc/com.atproto.repo.createRecord`, {
              repo: did,
              collection: 'app.bsky.graph.follow',
              record: {
                $type: 'app.bsky.graph.follow',
                subject: profile.did,
                createdAt: new Date().toISOString(),
              },
            }, accessJwt);
            break;
          }

          case 'unfollow': {
            const actor = this.getNodeParameter('actor', i) as string;
            const profile = await blueskyRequest('GET', `${service}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`, null, accessJwt);

            // Find follow record
            const follows = await blueskyRequest('GET', `${service}/xrpc/app.bsky.graph.getFollows?actor=${encodeURIComponent(did)}&limit=100`, null, accessJwt);
            const followRecord = follows.follows.find((f: any) => f.did === profile.did);

            if (followRecord) {
              const uri = followRecord.viewer?.following;
              if (uri) {
                const parts = uri.split('/');
                const rkey = parts[parts.length - 1];
                result = await blueskyRequest('POST', `${service}/xrpc/com.atproto.repo.deleteRecord`, {
                  repo: did,
                  collection: 'app.bsky.graph.follow',
                  rkey,
                }, accessJwt);
              }
            }
            result = result || { success: true };
            break;
          }

          case 'like': {
            const postUri = this.getNodeParameter('postUri', i) as string;
            const post = await blueskyRequest('GET', `${service}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(postUri)}`, null, accessJwt);

            result = await blueskyRequest('POST', `${service}/xrpc/com.atproto.repo.createRecord`, {
              repo: did,
              collection: 'app.bsky.feed.like',
              record: {
                $type: 'app.bsky.feed.like',
                subject: {
                  uri: postUri,
                  cid: post.thread.post.cid,
                },
                createdAt: new Date().toISOString(),
              },
            }, accessJwt);
            break;
          }

          case 'repost': {
            const postUri = this.getNodeParameter('postUri', i) as string;
            const post = await blueskyRequest('GET', `${service}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(postUri)}`, null, accessJwt);

            result = await blueskyRequest('POST', `${service}/xrpc/com.atproto.repo.createRecord`, {
              repo: did,
              collection: 'app.bsky.feed.repost',
              record: {
                $type: 'app.bsky.feed.repost',
                subject: {
                  uri: postUri,
                  cid: post.thread.post.cid,
                },
                createdAt: new Date().toISOString(),
              },
            }, accessJwt);
            break;
          }

          case 'getFollowers': {
            const actor = this.getNodeParameter('actor', i) as string;
            const limit = options.limit || 50;
            result = await blueskyRequest('GET', `${service}/xrpc/app.bsky.graph.getFollowers?actor=${encodeURIComponent(actor)}&limit=${limit}`, null, accessJwt);
            break;
          }

          case 'getFollowing': {
            const actor = this.getNodeParameter('actor', i) as string;
            const limit = options.limit || 50;
            result = await blueskyRequest('GET', `${service}/xrpc/app.bsky.graph.getFollows?actor=${encodeURIComponent(actor)}&limit=${limit}`, null, accessJwt);
            break;
          }

          case 'getNotifications': {
            const limit = options.limit || 50;
            result = await blueskyRequest('GET', `${service}/xrpc/app.bsky.notification.listNotifications?limit=${limit}`, null, accessJwt);
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
 * WhatsApp Business API Node
 *
 * PRICING TIERS:
 * - Cloud API: Free to set up, pay per conversation
 *   - Business-initiated: ~$0.05-0.15/conversation
 *   - User-initiated: ~$0.01-0.05/conversation
 *   - First 1,000 conversations/month FREE
 * - On-Premise: Enterprise pricing
 *
 * FREE TIER AVAILABLE: Yes (1,000 conversations/month free)
 */
export const WhatsApp = createProgrammaticNode({
  name: 'WhatsApp',
  displayName: 'WhatsApp Business',
  description: 'Send messages, templates, and media via WhatsApp. FREE: 1,000 conversations/month',
  icon: 'file:whatsapp.svg',
  group: ['communication'],
  version: 1,
  defaults: { name: 'WhatsApp', color: '#25D366' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'whatsappBusinessApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 1,000 conversations/month | 💰 Business-initiated: $0.05-0.15 | User-initiated: $0.01-0.05',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Send Text Message', value: 'sendText' },
        { name: 'Send Template Message', value: 'sendTemplate' },
        { name: 'Send Image', value: 'sendImage' },
        { name: 'Send Document', value: 'sendDocument' },
        { name: 'Send Location', value: 'sendLocation' },
        { name: 'Send Contact', value: 'sendContact' },
        { name: 'Send Interactive (Buttons)', value: 'sendInteractive' },
        { name: 'Mark as Read', value: 'markAsRead' },
        { name: 'Get Message Templates', value: 'getTemplates' },
        { name: 'Upload Media', value: 'uploadMedia' },
        { name: 'Get Media URL', value: 'getMediaUrl' },
      ],
      default: 'sendText',
    },
    {
      displayName: 'Phone Number ID',
      name: 'phoneNumberId',
      type: 'string',
      default: '',
      description: 'Your WhatsApp Business phone number ID',
    },
    {
      displayName: 'To',
      name: 'to',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['sendText', 'sendTemplate', 'sendImage', 'sendDocument', 'sendLocation', 'sendContact', 'sendInteractive'] } },
      description: 'Recipient phone number with country code (e.g., 14155551234)',
    },
    {
      displayName: 'Message',
      name: 'message',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      displayOptions: { show: { operation: ['sendText'] } },
    },
    {
      displayName: 'Template Name',
      name: 'templateName',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['sendTemplate'] } },
    },
    {
      displayName: 'Template Language',
      name: 'templateLanguage',
      type: 'string',
      default: 'en_US',
      displayOptions: { show: { operation: ['sendTemplate'] } },
    },
    {
      displayName: 'Template Parameters',
      name: 'templateParams',
      type: 'json',
      default: '[]',
      displayOptions: { show: { operation: ['sendTemplate'] } },
      description: 'Array of template parameter values',
    },
    {
      displayName: 'Media URL',
      name: 'mediaUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['sendImage', 'sendDocument'] } },
    },
    {
      displayName: 'Caption',
      name: 'caption',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['sendImage', 'sendDocument'] } },
    },
    {
      displayName: 'Message ID',
      name: 'messageId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['markAsRead'] } },
    },
    {
      displayName: 'Media ID',
      name: 'mediaId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getMediaUrl'] } },
    },
    {
      displayName: 'Latitude',
      name: 'latitude',
      type: 'number',
      default: 0,
      displayOptions: { show: { operation: ['sendLocation'] } },
    },
    {
      displayName: 'Longitude',
      name: 'longitude',
      type: 'number',
      default: 0,
      displayOptions: { show: { operation: ['sendLocation'] } },
    },
    {
      displayName: 'Location Name',
      name: 'locationName',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['sendLocation'] } },
    },
    {
      displayName: 'Interactive Message',
      name: 'interactiveMessage',
      type: 'json',
      default: '{\n  "type": "button",\n  "body": {\n    "text": "Choose an option"\n  },\n  "action": {\n    "buttons": []\n  }\n}',
      displayOptions: { show: { operation: ['sendInteractive'] } },
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('whatsappBusinessApi');
    const accessToken = credentials.accessToken as string;

    const baseUrl = 'https://graph.facebook.com/v18.0';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const phoneNumberId = this.getNodeParameter('phoneNumberId', i) as string;
        let result: any;

        switch (operation) {
          case 'sendText': {
            const to = this.getNodeParameter('to', i) as string;
            const message = this.getNodeParameter('message', i) as string;

            result = await whatsappRequest('POST', `${baseUrl}/${phoneNumberId}/messages`, {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to,
              type: 'text',
              text: { body: message },
            }, accessToken);
            break;
          }

          case 'sendTemplate': {
            const to = this.getNodeParameter('to', i) as string;
            const templateName = this.getNodeParameter('templateName', i) as string;
            const templateLanguage = this.getNodeParameter('templateLanguage', i) as string;
            const templateParams = JSON.parse(this.getNodeParameter('templateParams', i) as string);

            const components = templateParams.length > 0 ? [{
              type: 'body',
              parameters: templateParams.map((param: string) => ({ type: 'text', text: param })),
            }] : undefined;

            result = await whatsappRequest('POST', `${baseUrl}/${phoneNumberId}/messages`, {
              messaging_product: 'whatsapp',
              to,
              type: 'template',
              template: {
                name: templateName,
                language: { code: templateLanguage },
                components,
              },
            }, accessToken);
            break;
          }

          case 'sendImage': {
            const to = this.getNodeParameter('to', i) as string;
            const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
            const caption = this.getNodeParameter('caption', i) as string;

            result = await whatsappRequest('POST', `${baseUrl}/${phoneNumberId}/messages`, {
              messaging_product: 'whatsapp',
              to,
              type: 'image',
              image: {
                link: mediaUrl,
                caption: caption || undefined,
              },
            }, accessToken);
            break;
          }

          case 'sendDocument': {
            const to = this.getNodeParameter('to', i) as string;
            const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
            const caption = this.getNodeParameter('caption', i) as string;

            result = await whatsappRequest('POST', `${baseUrl}/${phoneNumberId}/messages`, {
              messaging_product: 'whatsapp',
              to,
              type: 'document',
              document: {
                link: mediaUrl,
                caption: caption || undefined,
              },
            }, accessToken);
            break;
          }

          case 'sendLocation': {
            const to = this.getNodeParameter('to', i) as string;
            const latitude = this.getNodeParameter('latitude', i) as number;
            const longitude = this.getNodeParameter('longitude', i) as number;
            const locationName = this.getNodeParameter('locationName', i) as string;

            result = await whatsappRequest('POST', `${baseUrl}/${phoneNumberId}/messages`, {
              messaging_product: 'whatsapp',
              to,
              type: 'location',
              location: {
                latitude,
                longitude,
                name: locationName || undefined,
              },
            }, accessToken);
            break;
          }

          case 'sendInteractive': {
            const to = this.getNodeParameter('to', i) as string;
            const interactiveMessage = JSON.parse(this.getNodeParameter('interactiveMessage', i) as string);

            result = await whatsappRequest('POST', `${baseUrl}/${phoneNumberId}/messages`, {
              messaging_product: 'whatsapp',
              to,
              type: 'interactive',
              interactive: interactiveMessage,
            }, accessToken);
            break;
          }

          case 'markAsRead': {
            const messageId = this.getNodeParameter('messageId', i) as string;

            result = await whatsappRequest('POST', `${baseUrl}/${phoneNumberId}/messages`, {
              messaging_product: 'whatsapp',
              status: 'read',
              message_id: messageId,
            }, accessToken);
            break;
          }

          case 'getTemplates': {
            const businessId = credentials.businessId as string;
            result = await whatsappRequest('GET', `${baseUrl}/${businessId}/message_templates`, null, accessToken);
            break;
          }

          case 'getMediaUrl': {
            const mediaId = this.getNodeParameter('mediaId', i) as string;
            result = await whatsappRequest('GET', `${baseUrl}/${mediaId}`, null, accessToken);
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
 * Threads API Node (via Instagram Graph API)
 *
 * PRICING TIERS:
 * - Free: Same as Instagram API
 *
 * FREE TIER AVAILABLE: Yes (via Instagram Business account)
 */
export const Threads = createProgrammaticNode({
  name: 'Threads',
  displayName: 'Threads',
  description: 'Post to Threads via Instagram Graph API. 💚 FREE with Instagram Business account',
  icon: 'file:threads.svg',
  group: ['social'],
  version: 1,
  defaults: { name: 'Threads', color: '#000000' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'threadsApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: Full access with Threads/Instagram account | API currently in limited release',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Create Text Post', value: 'createTextPost' },
        { name: 'Create Image Post', value: 'createImagePost' },
        { name: 'Create Video Post', value: 'createVideoPost' },
        { name: 'Get Thread', value: 'getThread' },
        { name: 'Get User Threads', value: 'getUserThreads' },
        { name: 'Get Profile', value: 'getProfile' },
        { name: 'Get Insights', value: 'getInsights' },
        { name: 'Reply to Thread', value: 'reply' },
      ],
      default: 'createTextPost',
    },
    {
      displayName: 'User ID',
      name: 'userId',
      type: 'string',
      default: '',
      description: 'Threads User ID',
    },
    {
      displayName: 'Text',
      name: 'text',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      displayOptions: { show: { operation: ['createTextPost', 'reply'] } },
      description: 'Max 500 characters',
    },
    {
      displayName: 'Image URL',
      name: 'imageUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createImagePost'] } },
    },
    {
      displayName: 'Video URL',
      name: 'videoUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createVideoPost'] } },
    },
    {
      displayName: 'Thread ID',
      name: 'threadId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getThread', 'reply', 'getInsights'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Limit', name: 'limit', type: 'number', default: 25 },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('threadsApi');
    const accessToken = credentials.accessToken as string;

    const baseUrl = 'https://graph.threads.net/v1.0';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const userId = this.getNodeParameter('userId', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'createTextPost': {
            const text = this.getNodeParameter('text', i) as string;

            // Create container
            const container = await threadsRequest('POST', `${baseUrl}/${userId}/threads`, {
              media_type: 'TEXT',
              text,
            }, accessToken);

            // Publish
            result = await threadsRequest('POST', `${baseUrl}/${userId}/threads_publish`, {
              creation_id: container.id,
            }, accessToken);
            break;
          }

          case 'createImagePost': {
            const text = this.getNodeParameter('text', i) as string || undefined;
            const imageUrl = this.getNodeParameter('imageUrl', i) as string;

            const container = await threadsRequest('POST', `${baseUrl}/${userId}/threads`, {
              media_type: 'IMAGE',
              image_url: imageUrl,
              text,
            }, accessToken);

            result = await threadsRequest('POST', `${baseUrl}/${userId}/threads_publish`, {
              creation_id: container.id,
            }, accessToken);
            break;
          }

          case 'createVideoPost': {
            const text = this.getNodeParameter('text', i) as string || undefined;
            const videoUrl = this.getNodeParameter('videoUrl', i) as string;

            const container = await threadsRequest('POST', `${baseUrl}/${userId}/threads`, {
              media_type: 'VIDEO',
              video_url: videoUrl,
              text,
            }, accessToken);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 5000));

            result = await threadsRequest('POST', `${baseUrl}/${userId}/threads_publish`, {
              creation_id: container.id,
            }, accessToken);
            break;
          }

          case 'getThread': {
            const threadId = this.getNodeParameter('threadId', i) as string;
            result = await threadsRequest('GET', `${baseUrl}/${threadId}?fields=id,media_type,media_url,permalink,text,timestamp,username,is_quote_post`, null, accessToken);
            break;
          }

          case 'getUserThreads': {
            const limit = options.limit || 25;
            result = await threadsRequest('GET', `${baseUrl}/${userId}/threads?fields=id,media_type,media_url,permalink,text,timestamp&limit=${limit}`, null, accessToken);
            break;
          }

          case 'getProfile': {
            result = await threadsRequest('GET', `${baseUrl}/${userId}?fields=id,username,name,threads_profile_picture_url,threads_biography`, null, accessToken);
            break;
          }

          case 'getInsights': {
            const threadId = this.getNodeParameter('threadId', i) as string;
            result = await threadsRequest('GET', `${baseUrl}/${threadId}/insights?metric=views,likes,replies,reposts,quotes`, null, accessToken);
            break;
          }

          case 'reply': {
            const threadId = this.getNodeParameter('threadId', i) as string;
            const text = this.getNodeParameter('text', i) as string;

            const container = await threadsRequest('POST', `${baseUrl}/${userId}/threads`, {
              media_type: 'TEXT',
              text,
              reply_to_id: threadId,
            }, accessToken);

            result = await threadsRequest('POST', `${baseUrl}/${userId}/threads_publish`, {
              creation_id: container.id,
            }, accessToken);
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
async function mastodonRequest(method: string, url: string, body: any, accessToken: string): Promise<any> {
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
    throw new Error(`Mastodon API error: ${response.status} - ${error}`);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}

async function blueskyRequest(method: string, url: string, body: any, accessJwt: string | null): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessJwt) {
    headers['Authorization'] = `Bearer ${accessJwt}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bluesky API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function whatsappRequest(method: string, url: string, body: any, accessToken: string): Promise<any> {
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
    throw new Error(`WhatsApp API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function threadsRequest(method: string, url: string, body: any, accessToken: string): Promise<any> {
  let fetchUrl = url;

  if (method === 'GET') {
    fetchUrl += (url.includes('?') ? '&' : '?') + `access_token=${accessToken}`;
  }

  const response = await fetch(fetchUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify({ ...body, access_token: accessToken }) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Threads API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Helper to detect facets (mentions, links, hashtags) in Bluesky posts
function detectFacets(text: string): any[] {
  const facets: any[] = [];

  // Detect URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const byteStart = Buffer.byteLength(text.substring(0, match.index), 'utf-8');
    const byteEnd = byteStart + Buffer.byteLength(match[0], 'utf-8');
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: match[0] }],
    });
  }

  // Detect mentions (@handle)
  const mentionRegex = /@([a-zA-Z0-9.]+)/g;
  while ((match = mentionRegex.exec(text)) !== null) {
    const byteStart = Buffer.byteLength(text.substring(0, match.index), 'utf-8');
    const byteEnd = byteStart + Buffer.byteLength(match[0], 'utf-8');
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#mention', did: '' }], // Would need to resolve handle to DID
    });
  }

  // Detect hashtags
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  while ((match = hashtagRegex.exec(text)) !== null) {
    const byteStart = Buffer.byteLength(text.substring(0, match.index), 'utf-8');
    const byteEnd = byteStart + Buffer.byteLength(match[0], 'utf-8');
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: match[1] }],
    });
  }

  return facets;
}
