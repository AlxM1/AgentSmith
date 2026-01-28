// More Utility API Nodes with Pricing Information
// 💚 = Free tier available
// 💰 = Paid only

import { createProgrammaticNode } from '@agentsmith/shared';

// ============================================
// URL SHORTENERS
// ============================================

export const Bitly = createProgrammaticNode({
  name: 'Bitly',
  displayName: 'Bitly',
  description: 'Shorten and manage URLs with Bitly',
  icon: 'link',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Bitly' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'bitlyApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 10 links/month, basic analytics | 💰 Core: $8/mo (200 links) | Growth: $29/mo (3000 links)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Shorten URL', value: 'shorten' },
        { name: 'Expand URL', value: 'expand' },
        { name: 'Get Clicks', value: 'clicks' },
        { name: 'Get Bitlinks', value: 'list' },
        { name: 'Update Bitlink', value: 'update' },
        { name: 'Delete Bitlink', value: 'delete' },
        { name: 'Get QR Code', value: 'qr' },
      ],
      default: 'shorten',
    },
    {
      displayName: 'Long URL',
      name: 'longUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['shorten'] } },
    },
    {
      displayName: 'Bitlink',
      name: 'bitlink',
      type: 'string',
      default: '',
      placeholder: 'bit.ly/xxxxx',
      displayOptions: { show: { operation: ['expand', 'clicks', 'update', 'delete', 'qr'] } },
    },
    {
      displayName: 'Title',
      name: 'title',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['shorten', 'update'] } },
    },
    {
      displayName: 'Tags',
      name: 'tags',
      type: 'string',
      default: '',
      placeholder: 'tag1,tag2',
      displayOptions: { show: { operation: ['shorten', 'update'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('bitlyApi');

    const baseUrl = 'https://api-ssl.bitly.com/v4';
    const headers = {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (operation) {
      case 'shorten':
        const longUrl = context.getNodeParameter('longUrl', 0);
        const title = context.getNodeParameter('title', 0);
        const tags = context.getNodeParameter('tags', 0);

        const shortenResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/shorten`,
          headers,
          body: {
            long_url: longUrl,
            title: title || undefined,
            tags: tags ? (tags as string).split(',').map((t: string) => t.trim()) : undefined,
          },
        });
        return [[{ json: shortenResponse }]];

      case 'expand':
        const expandBitlink = context.getNodeParameter('bitlink', 0);
        const expandResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/expand`,
          headers,
          body: { bitlink_id: expandBitlink },
        });
        return [[{ json: expandResponse }]];

      case 'clicks':
        const clicksBitlink = context.getNodeParameter('bitlink', 0);
        const clicksResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/bitlinks/${clicksBitlink}/clicks/summary`,
          headers,
        });
        return [[{ json: clicksResponse }]];

      case 'qr':
        const qrBitlink = context.getNodeParameter('bitlink', 0);
        return [[{
          json: {
            qrUrl: `https://api-ssl.bitly.com/v4/bitlinks/${qrBitlink}/qr`,
            bitlink: qrBitlink,
          },
        }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

export const TinyURL = createProgrammaticNode({
  name: 'TinyURL',
  displayName: 'TinyURL',
  description: 'Shorten URLs with TinyURL',
  icon: 'link',
  group: ['utility'],
  version: 1,
  defaults: { name: 'TinyURL' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'tinyUrlApi', required: false }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: Unlimited basic shortening (no API key needed) | 💰 Pro: $9.99/mo (analytics, custom aliases)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Shorten URL', value: 'shorten' },
        { name: 'Create Alias', value: 'alias' },
      ],
      default: 'shorten',
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Custom Alias',
      name: 'alias',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['alias'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const url = context.getNodeParameter('url', 0);

    let credentials;
    try {
      credentials = await context.getCredentials('tinyUrlApi');
    } catch {
      credentials = {};
    }

    if (credentials.apiKey) {
      // Pro API
      const alias = operation === 'alias' ? context.getNodeParameter('alias', 0) : '';

      const response = await context.helpers.httpRequest({
        method: 'POST',
        url: 'https://api.tinyurl.com/create',
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: {
          url,
          alias: alias || undefined,
        },
      });
      return [[{ json: response }]];
    } else {
      // Free API (no key needed)
      const response = await context.helpers.httpRequest({
        method: 'GET',
        url: `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url as string)}`,
      });

      return [[{
        json: {
          originalUrl: url,
          shortUrl: response,
        },
      }]];
    }
  },
});

export const Rebrandly = createProgrammaticNode({
  name: 'Rebrandly',
  displayName: 'Rebrandly',
  description: 'Create branded short links with Rebrandly',
  icon: 'link',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Rebrandly' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'rebrandlyApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 500 branded links, 5k clicks/mo | 💰 Starter: $13/mo (5k links) | Pro: $32/mo (15k links)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Create Link', value: 'create' },
        { name: 'Get Link', value: 'get' },
        { name: 'Update Link', value: 'update' },
        { name: 'Delete Link', value: 'delete' },
        { name: 'List Links', value: 'list' },
        { name: 'Get Click Stats', value: 'clicks' },
      ],
      default: 'create',
    },
    {
      displayName: 'Destination URL',
      name: 'destination',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['create', 'update'] } },
    },
    {
      displayName: 'Link ID',
      name: 'linkId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['get', 'update', 'delete', 'clicks'] } },
    },
    {
      displayName: 'Slashtag (Custom Alias)',
      name: 'slashtag',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['create'] } },
    },
    {
      displayName: 'Title',
      name: 'title',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['create', 'update'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('rebrandlyApi');

    const baseUrl = 'https://api.rebrandly.com/v1';
    const headers = {
      'apikey': credentials.apiKey as string,
      'Content-Type': 'application/json',
    };

    switch (operation) {
      case 'create':
        const destination = context.getNodeParameter('destination', 0);
        const slashtag = context.getNodeParameter('slashtag', 0);
        const title = context.getNodeParameter('title', 0);

        const createResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/links`,
          headers,
          body: {
            destination,
            slashtag: slashtag || undefined,
            title: title || undefined,
          },
        });
        return [[{ json: createResponse }]];

      case 'get':
        const getId = context.getNodeParameter('linkId', 0);
        const getResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/links/${getId}`,
          headers,
        });
        return [[{ json: getResponse }]];

      case 'list':
        const listResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/links`,
          headers,
        });
        return [[{ json: listResponse }]];

      case 'delete':
        const deleteId = context.getNodeParameter('linkId', 0);
        await context.helpers.httpRequest({
          method: 'DELETE',
          url: `${baseUrl}/links/${deleteId}`,
          headers,
        });
        return [[{ json: { success: true, deleted: deleteId } }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

// ============================================
// FILE CONVERSION
// ============================================

export const CloudConvert = createProgrammaticNode({
  name: 'CloudConvert',
  displayName: 'CloudConvert',
  description: 'Convert files between formats',
  icon: 'file-export',
  group: ['utility'],
  version: 1,
  defaults: { name: 'CloudConvert' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'cloudConvertApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 25 conversion minutes/day | 💰 Packages from $8 (500 min) | Subscription from $8/mo',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Convert File', value: 'convert' },
        { name: 'Get Task Status', value: 'status' },
        { name: 'List Supported Formats', value: 'formats' },
        { name: 'Optimize Image', value: 'optimize' },
        { name: 'Merge Files', value: 'merge' },
        { name: 'Capture Website', value: 'capture' },
      ],
      default: 'convert',
    },
    {
      displayName: 'Input File URL',
      name: 'inputUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['convert', 'optimize'] } },
    },
    {
      displayName: 'Input Format',
      name: 'inputFormat',
      type: 'string',
      default: '',
      placeholder: 'pdf, docx, png, etc.',
      displayOptions: { show: { operation: ['convert'] } },
    },
    {
      displayName: 'Output Format',
      name: 'outputFormat',
      type: 'string',
      default: '',
      placeholder: 'pdf, docx, png, etc.',
      displayOptions: { show: { operation: ['convert'] } },
    },
    {
      displayName: 'Task ID',
      name: 'taskId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['status'] } },
    },
    {
      displayName: 'Website URL',
      name: 'websiteUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['capture'] } },
    },
    {
      displayName: 'Output Format',
      name: 'captureFormat',
      type: 'options',
      options: [
        { name: 'PDF', value: 'pdf' },
        { name: 'PNG', value: 'png' },
        { name: 'JPG', value: 'jpg' },
      ],
      default: 'pdf',
      displayOptions: { show: { operation: ['capture'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('cloudConvertApi');

    const baseUrl = 'https://api.cloudconvert.com/v2';
    const headers = {
      Authorization: `Bearer ${credentials.apiKey}`,
      'Content-Type': 'application/json',
    };

    switch (operation) {
      case 'convert':
        const inputUrl = context.getNodeParameter('inputUrl', 0);
        const inputFormat = context.getNodeParameter('inputFormat', 0);
        const outputFormat = context.getNodeParameter('outputFormat', 0);

        // Create job with import, convert, export tasks
        const jobResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/jobs`,
          headers,
          body: {
            tasks: {
              'import-file': {
                operation: 'import/url',
                url: inputUrl,
              },
              'convert-file': {
                operation: 'convert',
                input: 'import-file',
                input_format: inputFormat,
                output_format: outputFormat,
              },
              'export-file': {
                operation: 'export/url',
                input: 'convert-file',
              },
            },
          },
        });
        return [[{ json: jobResponse }]];

      case 'status':
        const taskId = context.getNodeParameter('taskId', 0);
        const statusResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/tasks/${taskId}`,
          headers,
        });
        return [[{ json: statusResponse }]];

      case 'formats':
        const formatsResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/convert/formats`,
          headers,
        });
        return [[{ json: formatsResponse }]];

      case 'capture':
        const websiteUrl = context.getNodeParameter('websiteUrl', 0);
        const captureFormat = context.getNodeParameter('captureFormat', 0);

        const captureResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/jobs`,
          headers,
          body: {
            tasks: {
              capture: {
                operation: 'capture-website',
                url: websiteUrl,
                output_format: captureFormat,
              },
              export: {
                operation: 'export/url',
                input: 'capture',
              },
            },
          },
        });
        return [[{ json: captureResponse }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

export const Convertio = createProgrammaticNode({
  name: 'Convertio',
  displayName: 'Convertio',
  description: 'Convert files between 300+ formats',
  icon: 'file-export',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Convertio' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'convertioApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 10 conversion minutes/day | 💰 Light: $9.99/mo (25 min/day) | Basic: $14.99/mo (unlimited)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Convert from URL', value: 'convertUrl' },
        { name: 'Get Conversion Status', value: 'status' },
        { name: 'Download Result', value: 'download' },
        { name: 'List Formats', value: 'formats' },
      ],
      default: 'convertUrl',
    },
    {
      displayName: 'File URL',
      name: 'fileUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['convertUrl'] } },
    },
    {
      displayName: 'Output Format',
      name: 'outputFormat',
      type: 'string',
      default: '',
      placeholder: 'pdf, docx, mp4, etc.',
      displayOptions: { show: { operation: ['convertUrl'] } },
    },
    {
      displayName: 'Conversion ID',
      name: 'conversionId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['status', 'download'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('convertioApi');

    const baseUrl = 'https://api.convertio.co/convert';

    switch (operation) {
      case 'convertUrl':
        const fileUrl = context.getNodeParameter('fileUrl', 0);
        const outputFormat = context.getNodeParameter('outputFormat', 0);

        const convertResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: baseUrl,
          headers: { 'Content-Type': 'application/json' },
          body: {
            apikey: credentials.apiKey,
            input: 'url',
            file: fileUrl,
            outputformat: outputFormat,
          },
        });
        return [[{ json: convertResponse }]];

      case 'status':
        const statusId = context.getNodeParameter('conversionId', 0);
        const statusResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/${statusId}/status`,
        });
        return [[{ json: statusResponse }]];

      case 'download':
        const downloadId = context.getNodeParameter('conversionId', 0);
        const downloadResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/${downloadId}/dl`,
        });
        return [[{ json: downloadResponse }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

// ============================================
// EMAIL VALIDATION & VERIFICATION
// ============================================

export const ZeroBounce = createProgrammaticNode({
  name: 'ZeroBounce',
  displayName: 'ZeroBounce',
  description: 'Validate and verify email addresses',
  icon: 'envelope-check',
  group: ['utility'],
  version: 1,
  defaults: { name: 'ZeroBounce' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'zeroBounceApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 100 validations/month | 💰 Pay-as-you-go from $0.008/email | Monthly from $15/mo (2,000 emails)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Validate Email', value: 'validate' },
        { name: 'Validate Batch', value: 'validateBatch' },
        { name: 'Get Credits', value: 'credits' },
        { name: 'Get API Usage', value: 'usage' },
      ],
      default: 'validate',
    },
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['validate'] } },
    },
    {
      displayName: 'Emails',
      name: 'emails',
      type: 'string',
      typeOptions: { rows: 4 },
      default: '',
      placeholder: 'email1@example.com\nemail2@example.com',
      displayOptions: { show: { operation: ['validateBatch'] } },
    },
    {
      displayName: 'IP Address',
      name: 'ipAddress',
      type: 'string',
      default: '',
      description: 'IP address of the email sender (optional)',
      displayOptions: { show: { operation: ['validate'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('zeroBounceApi');

    const baseUrl = 'https://api.zerobounce.net/v2';

    switch (operation) {
      case 'validate':
        const email = context.getNodeParameter('email', 0);
        const ipAddress = context.getNodeParameter('ipAddress', 0);

        let validateUrl = `${baseUrl}/validate?api_key=${credentials.apiKey}&email=${encodeURIComponent(email as string)}`;
        if (ipAddress) {
          validateUrl += `&ip_address=${ipAddress}`;
        }

        const validateResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: validateUrl,
        });
        return [[{ json: validateResponse }]];

      case 'credits':
        const creditsResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/getcredits?api_key=${credentials.apiKey}`,
        });
        return [[{ json: creditsResponse }]];

      case 'usage':
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        const endDate = new Date();

        const usageResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/getapiusage?api_key=${credentials.apiKey}&start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`,
        });
        return [[{ json: usageResponse }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

export const Hunter = createProgrammaticNode({
  name: 'Hunter',
  displayName: 'Hunter.io',
  description: 'Find and verify email addresses',
  icon: 'envelope-search',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Hunter.io' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'hunterApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 25 searches/mo, 50 verifications/mo | 💰 Starter: $49/mo (500 searches) | Growth: $149/mo (5000)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Domain Search', value: 'domainSearch' },
        { name: 'Email Finder', value: 'emailFinder' },
        { name: 'Email Verifier', value: 'emailVerifier' },
        { name: 'Get Account Info', value: 'account' },
      ],
      default: 'domainSearch',
    },
    {
      displayName: 'Domain',
      name: 'domain',
      type: 'string',
      default: '',
      placeholder: 'example.com',
      displayOptions: { show: { operation: ['domainSearch', 'emailFinder'] } },
    },
    {
      displayName: 'First Name',
      name: 'firstName',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['emailFinder'] } },
    },
    {
      displayName: 'Last Name',
      name: 'lastName',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['emailFinder'] } },
    },
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['emailVerifier'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('hunterApi');

    const baseUrl = 'https://api.hunter.io/v2';

    switch (operation) {
      case 'domainSearch':
        const domain = context.getNodeParameter('domain', 0);
        const domainResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/domain-search?domain=${domain}&api_key=${credentials.apiKey}`,
        });
        return [[{ json: domainResponse }]];

      case 'emailFinder':
        const finderDomain = context.getNodeParameter('domain', 0);
        const firstName = context.getNodeParameter('firstName', 0);
        const lastName = context.getNodeParameter('lastName', 0);

        const finderResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/email-finder?domain=${finderDomain}&first_name=${firstName}&last_name=${lastName}&api_key=${credentials.apiKey}`,
        });
        return [[{ json: finderResponse }]];

      case 'emailVerifier':
        const email = context.getNodeParameter('email', 0);
        const verifyResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/email-verifier?email=${encodeURIComponent(email as string)}&api_key=${credentials.apiKey}`,
        });
        return [[{ json: verifyResponse }]];

      case 'account':
        const accountResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/account?api_key=${credentials.apiKey}`,
        });
        return [[{ json: accountResponse }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});

// ============================================
// SMS & PHONE APIS
// ============================================

export const Twilio = createProgrammaticNode({
  name: 'Twilio',
  displayName: 'Twilio',
  description: 'Send SMS, make calls, and verify phone numbers',
  icon: 'phone',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Twilio' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'twilioApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: $15.50 trial credit | 💰 Pay-as-you-go: SMS from $0.0079 | Voice from $0.013/min',
    },
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'SMS', value: 'sms' },
        { name: 'Voice Call', value: 'call' },
        { name: 'Phone Lookup', value: 'lookup' },
        { name: 'Verify', value: 'verify' },
      ],
      default: 'sms',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Send', value: 'send' },
        { name: 'Get', value: 'get' },
        { name: 'List', value: 'list' },
      ],
      default: 'send',
      displayOptions: { show: { resource: ['sms'] } },
    },
    {
      displayName: 'To',
      name: 'to',
      type: 'string',
      default: '',
      placeholder: '+15558675309',
      displayOptions: { show: { resource: ['sms', 'call', 'verify'] } },
    },
    {
      displayName: 'From',
      name: 'from',
      type: 'string',
      default: '',
      placeholder: '+15551234567 (your Twilio number)',
      displayOptions: { show: { resource: ['sms', 'call'] } },
    },
    {
      displayName: 'Message',
      name: 'body',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      displayOptions: { show: { resource: ['sms'], operation: ['send'] } },
    },
    {
      displayName: 'TwiML URL',
      name: 'twimlUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { resource: ['call'] } },
    },
    {
      displayName: 'Phone Number',
      name: 'phoneNumber',
      type: 'string',
      default: '',
      displayOptions: { show: { resource: ['lookup'] } },
    },
  ],
  async execute(context) {
    const resource = context.getNodeParameter('resource', 0);
    const credentials = await context.getCredentials('twilioApi');

    const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}`;
    const auth = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString('base64');

    const headers = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    switch (resource) {
      case 'sms':
        const operation = context.getNodeParameter('operation', 0);
        if (operation === 'send') {
          const to = context.getNodeParameter('to', 0);
          const from = context.getNodeParameter('from', 0);
          const body = context.getNodeParameter('body', 0);

          const response = await context.helpers.httpRequest({
            method: 'POST',
            url: `${baseUrl}/Messages.json`,
            headers,
            body: `To=${encodeURIComponent(to as string)}&From=${encodeURIComponent(from as string)}&Body=${encodeURIComponent(body as string)}`,
          });
          return [[{ json: response }]];
        }
        break;

      case 'call':
        const callTo = context.getNodeParameter('to', 0);
        const callFrom = context.getNodeParameter('from', 0);
        const twimlUrl = context.getNodeParameter('twimlUrl', 0);

        const callResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/Calls.json`,
          headers,
          body: `To=${encodeURIComponent(callTo as string)}&From=${encodeURIComponent(callFrom as string)}&Url=${encodeURIComponent(twimlUrl as string)}`,
        });
        return [[{ json: callResponse }]];

      case 'lookup':
        const phoneNumber = context.getNodeParameter('phoneNumber', 0);
        const lookupResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `https://lookups.twilio.com/v1/PhoneNumbers/${encodeURIComponent(phoneNumber as string)}`,
          headers: { Authorization: `Basic ${auth}` },
        });
        return [[{ json: lookupResponse }]];
    }

    return [[{ json: { error: 'Unknown resource' } }]];
  },
});

export const MessageBird = createProgrammaticNode({
  name: 'MessageBird',
  displayName: 'MessageBird',
  description: 'Send SMS and make voice calls',
  icon: 'phone',
  group: ['utility'],
  version: 1,
  defaults: { name: 'MessageBird' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'messageBirdApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: $10 credit on signup | 💰 Pay-as-you-go: SMS from $0.006 | Voice from $0.01/min',
    },
    {
      displayName: 'Resource',
      name: 'resource',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'SMS', value: 'sms' },
        { name: 'Voice', value: 'voice' },
        { name: 'Lookup', value: 'lookup' },
        { name: 'Verify', value: 'verify' },
      ],
      default: 'sms',
    },
    {
      displayName: 'Recipients',
      name: 'recipients',
      type: 'string',
      default: '',
      placeholder: '+15558675309',
      displayOptions: { show: { resource: ['sms'] } },
    },
    {
      displayName: 'Originator',
      name: 'originator',
      type: 'string',
      default: '',
      displayOptions: { show: { resource: ['sms'] } },
    },
    {
      displayName: 'Body',
      name: 'body',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      displayOptions: { show: { resource: ['sms'] } },
    },
    {
      displayName: 'Phone Number',
      name: 'phoneNumber',
      type: 'string',
      default: '',
      displayOptions: { show: { resource: ['lookup', 'verify'] } },
    },
  ],
  async execute(context) {
    const resource = context.getNodeParameter('resource', 0);
    const credentials = await context.getCredentials('messageBirdApi');

    const headers = {
      Authorization: `AccessKey ${credentials.accessKey}`,
      'Content-Type': 'application/json',
    };

    switch (resource) {
      case 'sms':
        const recipients = context.getNodeParameter('recipients', 0);
        const originator = context.getNodeParameter('originator', 0);
        const body = context.getNodeParameter('body', 0);

        const smsResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: 'https://rest.messagebird.com/messages',
          headers,
          body: {
            recipients: [recipients],
            originator,
            body,
          },
        });
        return [[{ json: smsResponse }]];

      case 'lookup':
        const phoneNumber = context.getNodeParameter('phoneNumber', 0);
        const lookupResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `https://rest.messagebird.com/lookup/${encodeURIComponent(phoneNumber as string)}`,
          headers,
        });
        return [[{ json: lookupResponse }]];

      case 'verify':
        const verifyNumber = context.getNodeParameter('phoneNumber', 0);
        const verifyResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: 'https://rest.messagebird.com/verify',
          headers,
          body: { recipient: verifyNumber },
        });
        return [[{ json: verifyResponse }]];
    }

    return [[{ json: { error: 'Unknown resource' } }]];
  },
});

// ============================================
// DOCUMENT & PDF APIS
// ============================================

export const PDFco = createProgrammaticNode({
  name: 'PDFco',
  displayName: 'PDF.co',
  description: 'PDF processing, conversion, and generation',
  icon: 'file-pdf',
  group: ['utility'],
  version: 1,
  defaults: { name: 'PDF.co' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'pdfcoApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 100 credits/month | 💰 Starter: $9.99/mo (5k credits) | Pro: $34.99/mo (25k credits)',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'HTML to PDF', value: 'htmlToPdf' },
        { name: 'URL to PDF', value: 'urlToPdf' },
        { name: 'PDF to Text', value: 'pdfToText' },
        { name: 'PDF to Images', value: 'pdfToImages' },
        { name: 'Merge PDFs', value: 'merge' },
        { name: 'Split PDF', value: 'split' },
        { name: 'Add Watermark', value: 'watermark' },
        { name: 'Extract Tables', value: 'extractTables' },
        { name: 'Fill PDF Form', value: 'fillForm' },
        { name: 'OCR', value: 'ocr' },
      ],
      default: 'htmlToPdf',
    },
    {
      displayName: 'HTML Content',
      name: 'html',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      displayOptions: { show: { operation: ['htmlToPdf'] } },
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['urlToPdf', 'pdfToText', 'pdfToImages', 'extractTables', 'ocr'] } },
    },
    {
      displayName: 'PDF URLs',
      name: 'pdfUrls',
      type: 'string',
      default: '',
      placeholder: 'URL1, URL2, URL3',
      displayOptions: { show: { operation: ['merge'] } },
    },
    {
      displayName: 'Output Format',
      name: 'outputFormat',
      type: 'options',
      options: [
        { name: 'PNG', value: 'png' },
        { name: 'JPEG', value: 'jpg' },
        { name: 'TIFF', value: 'tiff' },
      ],
      default: 'png',
      displayOptions: { show: { operation: ['pdfToImages'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('pdfcoApi');

    const baseUrl = 'https://api.pdf.co/v1';
    const headers = {
      'x-api-key': credentials.apiKey as string,
      'Content-Type': 'application/json',
    };

    const endpoints: Record<string, string> = {
      htmlToPdf: `${baseUrl}/pdf/convert/from/html`,
      urlToPdf: `${baseUrl}/pdf/convert/from/url`,
      pdfToText: `${baseUrl}/pdf/convert/to/text`,
      pdfToImages: `${baseUrl}/pdf/convert/to/png`,
      merge: `${baseUrl}/pdf/merge`,
      split: `${baseUrl}/pdf/split`,
      extractTables: `${baseUrl}/pdf/convert/to/csv`,
      ocr: `${baseUrl}/pdf/makesearchable`,
    };

    let body: Record<string, unknown> = {};

    switch (operation) {
      case 'htmlToPdf':
        body = { html: context.getNodeParameter('html', 0) };
        break;
      case 'urlToPdf':
      case 'pdfToText':
      case 'extractTables':
      case 'ocr':
        body = { url: context.getNodeParameter('url', 0) };
        break;
      case 'pdfToImages':
        body = {
          url: context.getNodeParameter('url', 0),
          outputFormat: context.getNodeParameter('outputFormat', 0),
        };
        break;
      case 'merge':
        body = { url: context.getNodeParameter('pdfUrls', 0) };
        break;
    }

    const response = await context.helpers.httpRequest({
      method: 'POST',
      url: endpoints[operation as string],
      headers,
      body,
    });

    return [[{ json: response }]];
  },
});

// ============================================
// SCHEDULING & CALENDAR APIS
// ============================================

export const Calendly = createProgrammaticNode({
  name: 'Calendly',
  displayName: 'Calendly',
  description: 'Manage scheduling and appointments',
  icon: 'calendar-check',
  group: ['utility'],
  version: 1,
  defaults: { name: 'Calendly' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'calendlyApi', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: Basic scheduling, unlimited 1-on-1 meetings | 💰 Standard: $10/seat/mo | Teams: $16/seat/mo | Enterprise: Custom',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      options: [
        { name: 'Get Current User', value: 'currentUser' },
        { name: 'List Event Types', value: 'listEventTypes' },
        { name: 'List Scheduled Events', value: 'listEvents' },
        { name: 'Get Event', value: 'getEvent' },
        { name: 'Cancel Event', value: 'cancelEvent' },
        { name: 'List Invitees', value: 'listInvitees' },
      ],
      default: 'listEvents',
    },
    {
      displayName: 'Event UUID',
      name: 'eventUuid',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getEvent', 'cancelEvent', 'listInvitees'] } },
    },
    {
      displayName: 'Cancellation Reason',
      name: 'cancelReason',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['cancelEvent'] } },
    },
    {
      displayName: 'Status Filter',
      name: 'status',
      type: 'options',
      options: [
        { name: 'All', value: '' },
        { name: 'Active', value: 'active' },
        { name: 'Canceled', value: 'canceled' },
      ],
      default: '',
      displayOptions: { show: { operation: ['listEvents'] } },
    },
  ],
  async execute(context) {
    const operation = context.getNodeParameter('operation', 0);
    const credentials = await context.getCredentials('calendlyApi');

    const baseUrl = 'https://api.calendly.com';
    const headers = {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (operation) {
      case 'currentUser':
        const userResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/users/me`,
          headers,
        });
        return [[{ json: userResponse }]];

      case 'listEventTypes':
        // First get current user to get organization
        const meResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/users/me`,
          headers,
        });

        const eventTypesResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/event_types?user=${meResponse.resource.uri}`,
          headers,
        });
        return [[{ json: eventTypesResponse }]];

      case 'listEvents':
        const status = context.getNodeParameter('status', 0);
        const meForEvents = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/users/me`,
          headers,
        });

        let eventsUrl = `${baseUrl}/scheduled_events?user=${meForEvents.resource.uri}`;
        if (status) {
          eventsUrl += `&status=${status}`;
        }

        const eventsResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: eventsUrl,
          headers,
        });
        return [[{ json: eventsResponse }]];

      case 'getEvent':
        const eventUuid = context.getNodeParameter('eventUuid', 0);
        const eventResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/scheduled_events/${eventUuid}`,
          headers,
        });
        return [[{ json: eventResponse }]];

      case 'cancelEvent':
        const cancelUuid = context.getNodeParameter('eventUuid', 0);
        const cancelReason = context.getNodeParameter('cancelReason', 0);

        const cancelResponse = await context.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/scheduled_events/${cancelUuid}/cancellation`,
          headers,
          body: { reason: cancelReason || 'Canceled via API' },
        });
        return [[{ json: cancelResponse }]];

      case 'listInvitees':
        const inviteesUuid = context.getNodeParameter('eventUuid', 0);
        const inviteesResponse = await context.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/scheduled_events/${inviteesUuid}/invitees`,
          headers,
        });
        return [[{ json: inviteesResponse }]];
    }

    return [[{ json: { error: 'Unknown operation' } }]];
  },
});
