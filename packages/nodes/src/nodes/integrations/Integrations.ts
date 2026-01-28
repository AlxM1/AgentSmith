import { createProgrammaticNode } from '@agentsmith/shared';

export const Gmail = createProgrammaticNode({
  name: 'Gmail',
  displayName: 'Gmail',
  description: 'Send and manage emails with Gmail',
  icon: 'file:gmail.svg',
  group: ['communication'],
  version: 1,
  defaults: { name: 'Gmail' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'googleOAuth2Api', required: true }],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Send Email', value: 'send' },
        { name: 'Get Emails', value: 'getAll' },
        { name: 'Get Email', value: 'get' },
        { name: 'Reply to Email', value: 'reply' },
        { name: 'Add Label', value: 'addLabel' },
        { name: 'Remove Label', value: 'removeLabel' },
        { name: 'Mark as Read', value: 'markAsRead' },
        { name: 'Mark as Unread', value: 'markAsUnread' },
        { name: 'Delete Email', value: 'delete' },
        { name: 'Create Draft', value: 'createDraft' },
      ],
      default: 'send',
    },
    {
      displayName: 'To',
      name: 'to',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['send', 'createDraft'] } },
      description: 'Comma-separated email addresses',
    },
    {
      displayName: 'Subject',
      name: 'subject',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['send', 'createDraft'] } },
    },
    {
      displayName: 'Body',
      name: 'body',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      displayOptions: { show: { operation: ['send', 'reply', 'createDraft'] } },
    },
    {
      displayName: 'Message ID',
      name: 'messageId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['get', 'reply', 'addLabel', 'removeLabel', 'markAsRead', 'markAsUnread', 'delete'] } },
    },
    {
      displayName: 'Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getAll'] } },
      description: 'Gmail search query (e.g., "from:someone@example.com is:unread")',
    },
    {
      displayName: 'Label',
      name: 'label',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['addLabel', 'removeLabel'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'CC', name: 'cc', type: 'string', default: '' },
        { displayName: 'BCC', name: 'bcc', type: 'string', default: '' },
        { displayName: 'Is HTML', name: 'isHtml', type: 'boolean', default: false },
        { displayName: 'Max Results', name: 'maxResults', type: 'number', default: 10 },
        { displayName: 'Include Attachments', name: 'includeAttachments', type: 'boolean', default: false },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('googleOAuth2Api');
    const accessToken = credentials.accessToken as string;

    const baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'send':
          case 'createDraft': {
            const to = this.getNodeParameter('to', i) as string;
            const subject = this.getNodeParameter('subject', i) as string;
            const body = this.getNodeParameter('body', i) as string;

            const email = createEmail(to, subject, body, options);
            const encodedEmail = Buffer.from(email).toString('base64url');

            if (operation === 'send') {
              result = await gmailRequest('POST', `${baseUrl}/messages/send`, { raw: encodedEmail }, accessToken);
            } else {
              result = await gmailRequest('POST', `${baseUrl}/drafts`, { message: { raw: encodedEmail } }, accessToken);
            }
            break;
          }

          case 'getAll': {
            const query = this.getNodeParameter('query', i) as string;
            const maxResults = options.maxResults || 10;

            const params = new URLSearchParams({ maxResults: String(maxResults) });
            if (query) params.append('q', query);

            const response = await gmailRequest('GET', `${baseUrl}/messages?${params}`, null, accessToken);
            const messages = response.messages || [];

            result = [];
            for (const msg of messages.slice(0, maxResults)) {
              const detail = await gmailRequest('GET', `${baseUrl}/messages/${msg.id}`, null, accessToken);
              result.push(parseGmailMessage(detail));
            }
            break;
          }

          case 'get': {
            const messageId = this.getNodeParameter('messageId', i) as string;
            const detail = await gmailRequest('GET', `${baseUrl}/messages/${messageId}`, null, accessToken);
            result = parseGmailMessage(detail);
            break;
          }

          case 'reply': {
            const messageId = this.getNodeParameter('messageId', i) as string;
            const body = this.getNodeParameter('body', i) as string;

            const original = await gmailRequest('GET', `${baseUrl}/messages/${messageId}`, null, accessToken);
            const parsed = parseGmailMessage(original);

            const email = createEmail(parsed.from, `Re: ${parsed.subject}`, body, {
              ...options,
              references: parsed.messageId,
              inReplyTo: parsed.messageId,
            });
            const encodedEmail = Buffer.from(email).toString('base64url');

            result = await gmailRequest('POST', `${baseUrl}/messages/send`, {
              raw: encodedEmail,
              threadId: original.threadId,
            }, accessToken);
            break;
          }

          case 'addLabel':
          case 'removeLabel': {
            const messageId = this.getNodeParameter('messageId', i) as string;
            const label = this.getNodeParameter('label', i) as string;

            const body = operation === 'addLabel'
              ? { addLabelIds: [label] }
              : { removeLabelIds: [label] };

            result = await gmailRequest('POST', `${baseUrl}/messages/${messageId}/modify`, body, accessToken);
            break;
          }

          case 'markAsRead':
          case 'markAsUnread': {
            const messageId = this.getNodeParameter('messageId', i) as string;
            const body = operation === 'markAsRead'
              ? { removeLabelIds: ['UNREAD'] }
              : { addLabelIds: ['UNREAD'] };

            result = await gmailRequest('POST', `${baseUrl}/messages/${messageId}/modify`, body, accessToken);
            break;
          }

          case 'delete': {
            const messageId = this.getNodeParameter('messageId', i) as string;
            await gmailRequest('DELETE', `${baseUrl}/messages/${messageId}`, null, accessToken);
            result = { success: true, messageId };
            break;
          }
        }

        const rows = Array.isArray(result) ? result : [result];
        for (const row of rows) {
          returnData.push({ json: row });
        }
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

export const GoogleDrive = createProgrammaticNode({
  name: 'GoogleDrive',
  displayName: 'Google Drive',
  description: 'Manage files in Google Drive',
  icon: 'file:googledrive.svg',
  group: ['storage'],
  version: 1,
  defaults: { name: 'Google Drive' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'googleOAuth2Api', required: true }],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Upload File', value: 'upload' },
        { name: 'Download File', value: 'download' },
        { name: 'List Files', value: 'list' },
        { name: 'Get File', value: 'get' },
        { name: 'Create Folder', value: 'createFolder' },
        { name: 'Delete File', value: 'delete' },
        { name: 'Copy File', value: 'copy' },
        { name: 'Move File', value: 'move' },
        { name: 'Share File', value: 'share' },
      ],
      default: 'list',
    },
    {
      displayName: 'File ID',
      name: 'fileId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['download', 'get', 'delete', 'copy', 'move', 'share'] } },
    },
    {
      displayName: 'File Name',
      name: 'fileName',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['upload', 'createFolder'] } },
    },
    {
      displayName: 'Binary Property',
      name: 'binaryProperty',
      type: 'string',
      default: 'data',
      displayOptions: { show: { operation: ['upload', 'download'] } },
    },
    {
      displayName: 'Parent Folder ID',
      name: 'parentFolderId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['upload', 'createFolder', 'move'] } },
      description: 'Leave empty for root folder',
    },
    {
      displayName: 'Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['list'] } },
      description: 'Google Drive search query',
    },
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['share'] } },
    },
    {
      displayName: 'Role',
      name: 'role',
      type: 'options',
      options: [
        { name: 'Viewer', value: 'reader' },
        { name: 'Commenter', value: 'commenter' },
        { name: 'Editor', value: 'writer' },
      ],
      default: 'reader',
      displayOptions: { show: { operation: ['share'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Max Results', name: 'maxResults', type: 'number', default: 100 },
        { displayName: 'Include Trashed', name: 'includeTrash', type: 'boolean', default: false },
        { displayName: 'Convert to Google Docs', name: 'convert', type: 'boolean', default: false },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('googleOAuth2Api');
    const accessToken = credentials.accessToken as string;

    const baseUrl = 'https://www.googleapis.com/drive/v3';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'list': {
            const query = this.getNodeParameter('query', i) as string;
            const params = new URLSearchParams({
              pageSize: String(options.maxResults || 100),
              fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink)',
            });

            if (query) params.append('q', query);
            if (!options.includeTrash) params.append('q', (query ? ` and ` : '') + 'trashed=false');

            result = await driveRequest('GET', `${baseUrl}/files?${params}`, null, accessToken);
            result = result.files || [];
            break;
          }

          case 'get': {
            const fileId = this.getNodeParameter('fileId', i) as string;
            result = await driveRequest('GET', `${baseUrl}/files/${fileId}?fields=*`, null, accessToken);
            break;
          }

          case 'download': {
            const fileId = this.getNodeParameter('fileId', i) as string;
            const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;

            const metadata = await driveRequest('GET', `${baseUrl}/files/${fileId}?fields=name,mimeType`, null, accessToken);
            const response = await fetch(`${baseUrl}/files/${fileId}?alt=media`, {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });

            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');

            returnData.push({
              json: { id: fileId, name: metadata.name },
              binary: {
                [binaryProperty]: {
                  data: base64,
                  mimeType: metadata.mimeType,
                  fileName: metadata.name,
                },
              },
            });
            continue;
          }

          case 'upload': {
            const fileName = this.getNodeParameter('fileName', i) as string;
            const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
            const parentFolderId = this.getNodeParameter('parentFolderId', i) as string;

            const binaryData = items[i].binary?.[binaryProperty];
            if (!binaryData) throw new Error(`No binary data found`);

            const metadata: any = { name: fileName || binaryData.fileName };
            if (parentFolderId) metadata.parents = [parentFolderId];

            // Create multipart upload
            const boundary = '-------314159265358979323846';
            const fileContent = Buffer.from(binaryData.data, 'base64');

            const multipartBody = [
              `--${boundary}`,
              'Content-Type: application/json; charset=UTF-8',
              '',
              JSON.stringify(metadata),
              `--${boundary}`,
              `Content-Type: ${binaryData.mimeType}`,
              'Content-Transfer-Encoding: base64',
              '',
              binaryData.data,
              `--${boundary}--`,
            ].join('\r\n');

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
              },
              body: multipartBody,
            });

            result = await response.json();
            break;
          }

          case 'createFolder': {
            const folderName = this.getNodeParameter('fileName', i) as string;
            const parentFolderId = this.getNodeParameter('parentFolderId', i) as string;

            const metadata: any = {
              name: folderName,
              mimeType: 'application/vnd.google-apps.folder',
            };
            if (parentFolderId) metadata.parents = [parentFolderId];

            result = await driveRequest('POST', `${baseUrl}/files`, metadata, accessToken);
            break;
          }

          case 'delete': {
            const fileId = this.getNodeParameter('fileId', i) as string;
            await driveRequest('DELETE', `${baseUrl}/files/${fileId}`, null, accessToken);
            result = { success: true, fileId };
            break;
          }

          case 'copy': {
            const fileId = this.getNodeParameter('fileId', i) as string;
            result = await driveRequest('POST', `${baseUrl}/files/${fileId}/copy`, {}, accessToken);
            break;
          }

          case 'move': {
            const fileId = this.getNodeParameter('fileId', i) as string;
            const parentFolderId = this.getNodeParameter('parentFolderId', i) as string;

            // Get current parents
            const file = await driveRequest('GET', `${baseUrl}/files/${fileId}?fields=parents`, null, accessToken);
            const previousParents = (file.parents || []).join(',');

            result = await driveRequest('PATCH',
              `${baseUrl}/files/${fileId}?addParents=${parentFolderId}&removeParents=${previousParents}`,
              {}, accessToken
            );
            break;
          }

          case 'share': {
            const fileId = this.getNodeParameter('fileId', i) as string;
            const email = this.getNodeParameter('email', i) as string;
            const role = this.getNodeParameter('role', i) as string;

            result = await driveRequest('POST', `${baseUrl}/files/${fileId}/permissions`, {
              type: 'user',
              role,
              emailAddress: email,
            }, accessToken);
            break;
          }
        }

        const rows = Array.isArray(result) ? result : [result];
        for (const row of rows) {
          returnData.push({ json: row });
        }
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

export const S3 = createProgrammaticNode({
  name: 'S3',
  displayName: 'AWS S3',
  description: 'Manage files in Amazon S3',
  icon: 'file:s3.svg',
  group: ['storage'],
  version: 1,
  defaults: { name: 'S3' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'awsApi', required: true }],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Upload File', value: 'upload' },
        { name: 'Download File', value: 'download' },
        { name: 'List Objects', value: 'list' },
        { name: 'Get Object Metadata', value: 'getMetadata' },
        { name: 'Delete Object', value: 'delete' },
        { name: 'Copy Object', value: 'copy' },
        { name: 'Create Bucket', value: 'createBucket' },
        { name: 'List Buckets', value: 'listBuckets' },
        { name: 'Generate Presigned URL', value: 'presignedUrl' },
      ],
      default: 'list',
    },
    {
      displayName: 'Bucket Name',
      name: 'bucketName',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['upload', 'download', 'list', 'getMetadata', 'delete', 'copy', 'createBucket', 'presignedUrl'] } },
    },
    {
      displayName: 'Key (File Path)',
      name: 'key',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['upload', 'download', 'getMetadata', 'delete', 'copy', 'presignedUrl'] } },
    },
    {
      displayName: 'Destination Bucket',
      name: 'destinationBucket',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['copy'] } },
    },
    {
      displayName: 'Destination Key',
      name: 'destinationKey',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['copy'] } },
    },
    {
      displayName: 'Binary Property',
      name: 'binaryProperty',
      type: 'string',
      default: 'data',
      displayOptions: { show: { operation: ['upload', 'download'] } },
    },
    {
      displayName: 'Prefix',
      name: 'prefix',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['list'] } },
      description: 'Filter objects by prefix (folder path)',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Max Keys', name: 'maxKeys', type: 'number', default: 1000 },
        { displayName: 'ACL', name: 'acl', type: 'options', options: [
          { name: 'Private', value: 'private' },
          { name: 'Public Read', value: 'public-read' },
          { name: 'Public Read Write', value: 'public-read-write' },
          { name: 'Authenticated Read', value: 'authenticated-read' },
        ], default: 'private' },
        { displayName: 'Content Type', name: 'contentType', type: 'string', default: '' },
        { displayName: 'Expiration (seconds)', name: 'expiration', type: 'number', default: 3600 },
        { displayName: 'Region', name: 'region', type: 'string', default: 'us-east-1' },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('awsApi');

    const accessKeyId = credentials.accessKeyId as string;
    const secretAccessKey = credentials.secretAccessKey as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        const region = options.region || 'us-east-1';
        let result: any;

        switch (operation) {
          case 'listBuckets': {
            result = await s3Request('GET', '/', '', '', region, accessKeyId, secretAccessKey);
            break;
          }

          case 'createBucket': {
            const bucketName = this.getNodeParameter('bucketName', i) as string;
            result = await s3Request('PUT', `/${bucketName}`, '', '', region, accessKeyId, secretAccessKey);
            result = { success: true, bucket: bucketName };
            break;
          }

          case 'list': {
            const bucketName = this.getNodeParameter('bucketName', i) as string;
            const prefix = this.getNodeParameter('prefix', i) as string;
            const maxKeys = options.maxKeys || 1000;

            const params = new URLSearchParams({
              'list-type': '2',
              'max-keys': String(maxKeys),
            });
            if (prefix) params.append('prefix', prefix);

            result = await s3Request('GET', `/${bucketName}?${params}`, '', '', region, accessKeyId, secretAccessKey);
            break;
          }

          case 'upload': {
            const bucketName = this.getNodeParameter('bucketName', i) as string;
            const key = this.getNodeParameter('key', i) as string;
            const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;

            const binaryData = items[i].binary?.[binaryProperty];
            if (!binaryData) throw new Error('No binary data found');

            const contentType = options.contentType || binaryData.mimeType || 'application/octet-stream';
            const body = Buffer.from(binaryData.data, 'base64');

            result = await s3Request('PUT', `/${bucketName}/${key}`, body, contentType, region, accessKeyId, secretAccessKey);
            result = { success: true, bucket: bucketName, key };
            break;
          }

          case 'download': {
            const bucketName = this.getNodeParameter('bucketName', i) as string;
            const key = this.getNodeParameter('key', i) as string;
            const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;

            const response = await s3RequestRaw('GET', `/${bucketName}/${key}`, '', '', region, accessKeyId, secretAccessKey);
            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');

            const contentType = response.headers.get('content-type') || 'application/octet-stream';
            const fileName = key.split('/').pop() || 'download';

            returnData.push({
              json: { bucket: bucketName, key },
              binary: {
                [binaryProperty]: {
                  data: base64,
                  mimeType: contentType,
                  fileName,
                },
              },
            });
            continue;
          }

          case 'getMetadata': {
            const bucketName = this.getNodeParameter('bucketName', i) as string;
            const key = this.getNodeParameter('key', i) as string;

            const response = await s3RequestRaw('HEAD', `/${bucketName}/${key}`, '', '', region, accessKeyId, secretAccessKey);

            result = {
              bucket: bucketName,
              key,
              contentType: response.headers.get('content-type'),
              contentLength: response.headers.get('content-length'),
              lastModified: response.headers.get('last-modified'),
              etag: response.headers.get('etag'),
            };
            break;
          }

          case 'delete': {
            const bucketName = this.getNodeParameter('bucketName', i) as string;
            const key = this.getNodeParameter('key', i) as string;

            await s3Request('DELETE', `/${bucketName}/${key}`, '', '', region, accessKeyId, secretAccessKey);
            result = { success: true, bucket: bucketName, key };
            break;
          }

          case 'copy': {
            const bucketName = this.getNodeParameter('bucketName', i) as string;
            const key = this.getNodeParameter('key', i) as string;
            const destBucket = this.getNodeParameter('destinationBucket', i) as string;
            const destKey = this.getNodeParameter('destinationKey', i) as string;

            result = await s3Request('PUT', `/${destBucket}/${destKey}`, '', '', region, accessKeyId, secretAccessKey, {
              'x-amz-copy-source': `/${bucketName}/${key}`,
            });
            result = { success: true, source: { bucket: bucketName, key }, destination: { bucket: destBucket, key: destKey } };
            break;
          }

          case 'presignedUrl': {
            const bucketName = this.getNodeParameter('bucketName', i) as string;
            const key = this.getNodeParameter('key', i) as string;
            const expiration = options.expiration || 3600;

            // Generate presigned URL (simplified - in production use proper AWS signing)
            const expires = Math.floor(Date.now() / 1000) + expiration;
            const url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}?X-Amz-Expires=${expiration}`;

            result = { url, bucket: bucketName, key, expiresIn: expiration };
            break;
          }
        }

        const rows = Array.isArray(result) ? result : [result];
        for (const row of rows) {
          returnData.push({ json: row });
        }
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
async function gmailRequest(method: string, url: string, body: any, accessToken: string): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status}`);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}

function createEmail(to: string, subject: string, body: string, options: any = {}): string {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
  ];

  if (options.cc) headers.push(`Cc: ${options.cc}`);
  if (options.bcc) headers.push(`Bcc: ${options.bcc}`);
  if (options.inReplyTo) headers.push(`In-Reply-To: ${options.inReplyTo}`);
  if (options.references) headers.push(`References: ${options.references}`);

  headers.push(`Content-Type: ${options.isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`);
  headers.push('');
  headers.push(body);

  return headers.join('\r\n');
}

function parseGmailMessage(message: any): any {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  let body = '';
  if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  } else if (message.payload?.parts) {
    const textPart = message.payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  }

  return {
    id: message.id,
    threadId: message.threadId,
    messageId: getHeader('Message-ID'),
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    body,
    snippet: message.snippet,
    labelIds: message.labelIds,
  };
}

async function driveRequest(method: string, url: string, body: any, accessToken: string): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Google Drive API error: ${response.status}`);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}

async function s3Request(
  method: string,
  path: string,
  body: any,
  contentType: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  extraHeaders: Record<string, string> = {}
): Promise<any> {
  const response = await s3RequestRaw(method, path, body, contentType, region, accessKeyId, secretAccessKey, extraHeaders);

  if (!response.ok) {
    throw new Error(`S3 API error: ${response.status}`);
  }

  if (response.status === 204 || !response.headers.get('content-type')?.includes('xml')) {
    return { success: true };
  }

  const text = await response.text();
  // Basic XML parsing - in production use a proper XML parser
  return { raw: text };
}

async function s3RequestRaw(
  method: string,
  path: string,
  body: any,
  contentType: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  const host = `s3.${region}.amazonaws.com`;
  const url = `https://${host}${path}`;

  // AWS Signature V4 signing (simplified)
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = date.slice(0, 8);

  const headers: Record<string, string> = {
    'Host': host,
    'X-Amz-Date': date,
    ...extraHeaders,
  };

  if (contentType) headers['Content-Type'] = contentType;

  // In production, implement full AWS Signature V4
  // This is a simplified placeholder
  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/${region}/s3/aws4_request`;

  return fetch(url, {
    method,
    headers,
    body: body || undefined,
  });
}
