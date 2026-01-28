import { createProgrammaticNode } from '@agentsmith/shared';

export const XML = createProgrammaticNode({
  name: 'XML',
  displayName: 'XML',
  description: 'Parse and convert XML data',
  icon: 'fa:file-code',
  group: ['transform'],
  version: 1,
  defaults: { name: 'XML' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'XML to JSON', value: 'xmlToJson' },
        { name: 'JSON to XML', value: 'jsonToXml' },
      ],
      default: 'xmlToJson',
    },
    {
      displayName: 'XML String',
      name: 'xmlString',
      type: 'string',
      typeOptions: { rows: 10 },
      default: '',
      displayOptions: { show: { operation: ['xmlToJson'] } },
    },
    {
      displayName: 'Source Data',
      name: 'sourceData',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['jsonToXml'] } },
      description: 'Field name containing JSON to convert',
    },
    {
      displayName: 'Root Element',
      name: 'rootElement',
      type: 'string',
      default: 'root',
      displayOptions: { show: { operation: ['jsonToXml'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Attribute Prefix',
          name: 'attributePrefix',
          type: 'string',
          default: '@_',
          description: 'Prefix for attributes in JSON',
        },
        {
          displayName: 'Text Node Name',
          name: 'textNodeName',
          type: 'string',
          default: '#text',
          description: 'Key name for text content',
        },
        {
          displayName: 'Ignore Attributes',
          name: 'ignoreAttributes',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Pretty Print',
          name: 'prettyPrint',
          type: 'boolean',
          default: true,
          displayOptions: { show: { '/operation': ['jsonToXml'] } },
        },
        {
          displayName: 'Indent',
          name: 'indent',
          type: 'string',
          default: '  ',
          displayOptions: { show: { '/operation': ['jsonToXml'] } },
        },
      ],
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
      const options = this.getNodeParameter('options', i) as any;
      let result: any;

      try {
        if (operation === 'xmlToJson') {
          const xmlString = this.getNodeParameter('xmlString', i) as string;
          result = simpleXmlToJson(xmlString, options);
        } else {
          const sourceData = this.getNodeParameter('sourceData', i) as string;
          const rootElement = this.getNodeParameter('rootElement', i) as string;
          const data = sourceData ? getNestedValue(items[i].json, sourceData) : items[i].json;
          result = jsonToXml(data, rootElement, options);
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

function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

// Simple XML to JSON parser (basic implementation)
function simpleXmlToJson(xml: string, options: any = {}): any {
  const attrPrefix = options.attributePrefix || '@_';
  const textNodeName = options.textNodeName || '#text';
  const ignoreAttributes = options.ignoreAttributes || false;

  // Remove XML declaration
  xml = xml.replace(/<\?xml[^?]*\?>/g, '');

  // Parse elements
  const result: any = {};
  const tagRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>|<(\w+)([^/]*)\/>/g;

  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    const tagName = match[1] || match[4];
    const attributes = match[2] || match[5] || '';
    const content = match[3] || '';

    let element: any = {};

    // Parse attributes
    if (!ignoreAttributes && attributes.trim()) {
      const attrRegex = /(\w+)=["']([^"']*)["']/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attributes)) !== null) {
        element[attrPrefix + attrMatch[1]] = attrMatch[2];
      }
    }

    // Parse content
    if (content.trim()) {
      if (content.includes('<')) {
        // Has child elements
        const childResult = simpleXmlToJson(`<root>${content}</root>`, options);
        Object.assign(element, childResult.root || childResult);
      } else {
        // Text content only
        if (Object.keys(element).length > 0) {
          element[textNodeName] = content.trim();
        } else {
          element = content.trim();
        }
      }
    }

    // Handle multiple elements with same name
    if (result[tagName]) {
      if (!Array.isArray(result[tagName])) {
        result[tagName] = [result[tagName]];
      }
      result[tagName].push(element);
    } else {
      result[tagName] = element;
    }
  }

  return result;
}

// JSON to XML converter
function jsonToXml(obj: any, rootElement: string, options: any = {}): string {
  const attrPrefix = options.attributePrefix || '@_';
  const textNodeName = options.textNodeName || '#text';
  const prettyPrint = options.prettyPrint !== false;
  const indent = options.indent || '  ';

  function convert(data: any, level: number = 0): string {
    const prefix = prettyPrint ? indent.repeat(level) : '';
    const newline = prettyPrint ? '\n' : '';

    if (data === null || data === undefined) {
      return '';
    }

    if (typeof data !== 'object') {
      return escapeXml(String(data));
    }

    if (Array.isArray(data)) {
      return data.map(item => convert(item, level)).join(newline);
    }

    let xml = '';
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith(attrPrefix)) continue;
      if (key === textNodeName) {
        xml += escapeXml(String(value));
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          xml += `${prefix}<${key}${getAttributes(item, attrPrefix)}>`;
          const content = convert(item, level + 1);
          if (content.includes('<') && prettyPrint) {
            xml += newline + content + prefix;
          } else {
            xml += content;
          }
          xml += `</${key}>${newline}`;
        }
      } else {
        xml += `${prefix}<${key}${getAttributes(value, attrPrefix)}>`;
        const content = convert(value, level + 1);
        if (content.includes('<') && prettyPrint) {
          xml += newline + content + prefix;
        } else {
          xml += content;
        }
        xml += `</${key}>${newline}`;
      }
    }

    return xml;
  }

  function getAttributes(obj: any, prefix: string): string {
    if (typeof obj !== 'object' || obj === null) return '';

    let attrs = '';
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith(prefix)) {
        const attrName = key.slice(prefix.length);
        attrs += ` ${attrName}="${escapeXml(String(value))}"`;
      }
    }
    return attrs;
  }

  const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
  const content = convert(obj, 1);
  const newline = prettyPrint ? '\n' : '';

  return `${xmlDeclaration}${newline}<${rootElement}>${newline}${content}</${rootElement}>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
