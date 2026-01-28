import { createProgrammaticNode } from '@agentsmith/shared';
import * as crypto from 'crypto';

export const Crypto = createProgrammaticNode({
  name: 'Crypto',
  displayName: 'Crypto',
  description: 'Perform cryptographic operations like hashing and encryption',
  icon: 'fa:lock',
  group: ['transform'],
  version: 1,
  defaults: { name: 'Crypto' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Hash', value: 'hash' },
        { name: 'HMAC', value: 'hmac' },
        { name: 'Encrypt', value: 'encrypt' },
        { name: 'Decrypt', value: 'decrypt' },
        { name: 'Generate UUID', value: 'uuid' },
        { name: 'Generate Random Bytes', value: 'randomBytes' },
        { name: 'Sign', value: 'sign' },
        { name: 'Verify', value: 'verify' },
      ],
      default: 'hash',
    },
    {
      displayName: 'Value',
      name: 'value',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['hash', 'hmac', 'encrypt', 'decrypt', 'sign', 'verify'] } },
      description: 'The value to process',
    },
    {
      displayName: 'Algorithm',
      name: 'algorithm',
      type: 'options',
      options: [
        { name: 'MD5', value: 'md5' },
        { name: 'SHA-1', value: 'sha1' },
        { name: 'SHA-256', value: 'sha256' },
        { name: 'SHA-384', value: 'sha384' },
        { name: 'SHA-512', value: 'sha512' },
      ],
      default: 'sha256',
      displayOptions: { show: { operation: ['hash', 'hmac'] } },
    },
    {
      displayName: 'Encryption Algorithm',
      name: 'encryptionAlgorithm',
      type: 'options',
      options: [
        { name: 'AES-256-CBC', value: 'aes-256-cbc' },
        { name: 'AES-256-GCM', value: 'aes-256-gcm' },
        { name: 'AES-128-CBC', value: 'aes-128-cbc' },
      ],
      default: 'aes-256-cbc',
      displayOptions: { show: { operation: ['encrypt', 'decrypt'] } },
    },
    {
      displayName: 'Secret',
      name: 'secret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      displayOptions: { show: { operation: ['hmac', 'encrypt', 'decrypt'] } },
      description: 'The secret key',
    },
    {
      displayName: 'Encoding',
      name: 'encoding',
      type: 'options',
      options: [
        { name: 'Hex', value: 'hex' },
        { name: 'Base64', value: 'base64' },
        { name: 'Binary', value: 'binary' },
      ],
      default: 'hex',
      displayOptions: { show: { operation: ['hash', 'hmac', 'encrypt'] } },
    },
    {
      displayName: 'Byte Length',
      name: 'byteLength',
      type: 'number',
      default: 32,
      displayOptions: { show: { operation: ['randomBytes'] } },
    },
    {
      displayName: 'Private Key',
      name: 'privateKey',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      displayOptions: { show: { operation: ['sign'] } },
    },
    {
      displayName: 'Public Key',
      name: 'publicKey',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      displayOptions: { show: { operation: ['verify'] } },
    },
    {
      displayName: 'Signature',
      name: 'signature',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['verify'] } },
    },
    {
      displayName: 'Output Field Name',
      name: 'outputFieldName',
      type: 'string',
      default: 'data',
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const outputFieldName = this.getNodeParameter('outputFieldName', i) as string;
      let result: any;

      try {
        switch (operation) {
          case 'hash': {
            const value = this.getNodeParameter('value', i) as string;
            const algorithm = this.getNodeParameter('algorithm', i) as string;
            const encoding = this.getNodeParameter('encoding', i) as crypto.BinaryToTextEncoding;
            result = crypto.createHash(algorithm).update(value).digest(encoding);
            break;
          }

          case 'hmac': {
            const value = this.getNodeParameter('value', i) as string;
            const algorithm = this.getNodeParameter('algorithm', i) as string;
            const secret = this.getNodeParameter('secret', i) as string;
            const encoding = this.getNodeParameter('encoding', i) as crypto.BinaryToTextEncoding;
            result = crypto.createHmac(algorithm, secret).update(value).digest(encoding);
            break;
          }

          case 'encrypt': {
            const value = this.getNodeParameter('value', i) as string;
            const algorithm = this.getNodeParameter('encryptionAlgorithm', i) as string;
            const secret = this.getNodeParameter('secret', i) as string;
            const encoding = this.getNodeParameter('encoding', i) as crypto.BinaryToTextEncoding;

            const key = crypto.scryptSync(secret, 'salt', algorithm.includes('256') ? 32 : 16);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(algorithm, key, iv);

            let encrypted = cipher.update(value, 'utf8', encoding);
            encrypted += cipher.final(encoding);

            result = {
              encrypted,
              iv: iv.toString('hex'),
            };
            break;
          }

          case 'decrypt': {
            const value = this.getNodeParameter('value', i) as string;
            const algorithm = this.getNodeParameter('encryptionAlgorithm', i) as string;
            const secret = this.getNodeParameter('secret', i) as string;

            const [encrypted, ivHex] = value.split(':');
            const key = crypto.scryptSync(secret, 'salt', algorithm.includes('256') ? 32 : 16);
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto.createDecipheriv(algorithm, key, iv);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            result = decrypted;
            break;
          }

          case 'uuid': {
            result = crypto.randomUUID();
            break;
          }

          case 'randomBytes': {
            const byteLength = this.getNodeParameter('byteLength', i) as number;
            result = crypto.randomBytes(byteLength).toString('hex');
            break;
          }

          case 'sign': {
            const value = this.getNodeParameter('value', i) as string;
            const privateKey = this.getNodeParameter('privateKey', i) as string;
            const sign = crypto.createSign('SHA256');
            sign.update(value);
            result = sign.sign(privateKey, 'hex');
            break;
          }

          case 'verify': {
            const value = this.getNodeParameter('value', i) as string;
            const publicKey = this.getNodeParameter('publicKey', i) as string;
            const signature = this.getNodeParameter('signature', i) as string;
            const verify = crypto.createVerify('SHA256');
            verify.update(value);
            result = verify.verify(publicKey, signature, 'hex');
            break;
          }
        }

        returnData.push({
          json: {
            ...items[i].json,
            [outputFieldName]: result,
          },
        });
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
