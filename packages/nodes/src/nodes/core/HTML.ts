import { createProgrammaticNode } from '@agentsmith/shared';

export const HTML = createProgrammaticNode({
  name: 'HTML',
  displayName: 'HTML',
  description: 'Extract and manipulate HTML content',
  icon: 'fa:code',
  group: ['transform'],
  version: 1,
  defaults: { name: 'HTML' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Extract HTML Content', value: 'extract' },
        { name: 'Generate HTML Table', value: 'generateTable' },
        { name: 'Strip HTML Tags', value: 'stripTags' },
        { name: 'Convert Markdown to HTML', value: 'markdownToHtml' },
        { name: 'Convert HTML to Markdown', value: 'htmlToMarkdown' },
      ],
      default: 'extract',
    },
    {
      displayName: 'HTML',
      name: 'html',
      type: 'string',
      typeOptions: { rows: 10 },
      default: '',
      displayOptions: { show: { operation: ['extract', 'stripTags', 'htmlToMarkdown'] } },
    },
    {
      displayName: 'Markdown',
      name: 'markdown',
      type: 'string',
      typeOptions: { rows: 10 },
      default: '',
      displayOptions: { show: { operation: ['markdownToHtml'] } },
    },
    {
      displayName: 'Extraction Values',
      name: 'extractionValues',
      type: 'fixedCollection',
      typeOptions: { multipleValues: true },
      default: {},
      displayOptions: { show: { operation: ['extract'] } },
      options: [
        {
          displayName: 'Values',
          name: 'values',
          values: [
            {
              displayName: 'Key',
              name: 'key',
              type: 'string',
              default: '',
            },
            {
              displayName: 'CSS Selector',
              name: 'cssSelector',
              type: 'string',
              default: '',
            },
            {
              displayName: 'Return Value',
              name: 'returnValue',
              type: 'options',
              options: [
                { name: 'Text', value: 'text' },
                { name: 'HTML', value: 'html' },
                { name: 'Attribute', value: 'attribute' },
              ],
              default: 'text',
            },
            {
              displayName: 'Attribute Name',
              name: 'attributeName',
              type: 'string',
              default: '',
              displayOptions: { show: { returnValue: ['attribute'] } },
            },
          ],
        },
      ],
    },
    {
      displayName: 'Source Data',
      name: 'sourceData',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['generateTable'] } },
      description: 'Field name containing array data',
    },
    {
      displayName: 'Table Options',
      name: 'tableOptions',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      displayOptions: { show: { operation: ['generateTable'] } },
      options: [
        {
          displayName: 'Include Header',
          name: 'includeHeader',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Table Class',
          name: 'tableClass',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Table ID',
          name: 'tableId',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Caption',
          name: 'caption',
          type: 'string',
          default: '',
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
      let result: any;

      try {
        switch (operation) {
          case 'extract': {
            const html = this.getNodeParameter('html', i) as string;
            const extractionValues = this.getNodeParameter('extractionValues', i) as any;
            result = {};

            if (extractionValues.values) {
              for (const extraction of extractionValues.values) {
                const { key, cssSelector, returnValue, attributeName } = extraction;
                const extracted = extractFromHtml(html, cssSelector, returnValue, attributeName);
                result[key] = extracted;
              }
            }
            break;
          }

          case 'generateTable': {
            const sourceData = this.getNodeParameter('sourceData', i) as string;
            const tableOptions = this.getNodeParameter('tableOptions', i) as any;
            const data = sourceData ? getNestedValue(items[i].json, sourceData) : items[i].json;

            if (!Array.isArray(data)) {
              throw new Error('Source data must be an array');
            }

            result = generateHtmlTable(data, tableOptions);
            break;
          }

          case 'stripTags': {
            const html = this.getNodeParameter('html', i) as string;
            result = stripHtmlTags(html);
            break;
          }

          case 'markdownToHtml': {
            const markdown = this.getNodeParameter('markdown', i) as string;
            result = markdownToHtml(markdown);
            break;
          }

          case 'htmlToMarkdown': {
            const html = this.getNodeParameter('html', i) as string;
            result = htmlToMarkdown(html);
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

function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

// Simple HTML extraction (basic implementation - in production use a proper DOM parser)
function extractFromHtml(html: string, selector: string, returnType: string, attributeName?: string): string | string[] {
  // Basic tag extraction using regex (simplified - use cheerio/jsdom in production)
  const results: string[] = [];

  // Handle simple tag selectors
  const tagMatch = selector.match(/^(\w+)(?:\[([^\]]+)\])?$/);
  if (tagMatch) {
    const tag = tagMatch[1];
    const attrFilter = tagMatch[2];

    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>|<${tag}[^/]*/>`, 'gi');
    let match;

    while ((match = regex.exec(html)) !== null) {
      const fullMatch = match[0];
      const content = match[1] || '';

      if (attrFilter) {
        const [attrName, attrValue] = attrFilter.split('=');
        const attrRegex = new RegExp(`${attrName}=["']${attrValue?.replace(/['"]/g, '') || '[^"\']*'}["']`);
        if (!attrRegex.test(fullMatch)) continue;
      }

      if (returnType === 'text') {
        results.push(stripHtmlTags(content).trim());
      } else if (returnType === 'html') {
        results.push(content);
      } else if (returnType === 'attribute' && attributeName) {
        const attrRegex = new RegExp(`${attributeName}=["']([^"']*)["']`);
        const attrMatch = fullMatch.match(attrRegex);
        if (attrMatch) results.push(attrMatch[1]);
      }
    }
  }

  // Handle class selectors
  if (selector.startsWith('.')) {
    const className = selector.slice(1);
    const regex = new RegExp(`<(\\w+)[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)</\\1>`, 'gi');
    let match;

    while ((match = regex.exec(html)) !== null) {
      const content = match[2];
      if (returnType === 'text') {
        results.push(stripHtmlTags(content).trim());
      } else {
        results.push(content);
      }
    }
  }

  // Handle ID selectors
  if (selector.startsWith('#')) {
    const id = selector.slice(1);
    const regex = new RegExp(`<(\\w+)[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)</\\1>`, 'i');
    const match = html.match(regex);

    if (match) {
      const content = match[2];
      if (returnType === 'text') {
        return stripHtmlTags(content).trim();
      }
      return content;
    }
  }

  return results.length === 1 ? results[0] : results;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function generateHtmlTable(data: any[], options: any = {}): string {
  if (!data.length) return '<table></table>';

  const { includeHeader = true, tableClass, tableId, caption } = options;

  const columns = Object.keys(data[0]);
  let html = '<table';
  if (tableClass) html += ` class="${tableClass}"`;
  if (tableId) html += ` id="${tableId}"`;
  html += '>';

  if (caption) {
    html += `<caption>${escapeHtml(caption)}</caption>`;
  }

  if (includeHeader) {
    html += '<thead><tr>';
    for (const col of columns) {
      html += `<th>${escapeHtml(col)}</th>`;
    }
    html += '</tr></thead>';
  }

  html += '<tbody>';
  for (const row of data) {
    html += '<tr>';
    for (const col of columns) {
      const value = row[col] ?? '';
      html += `<td>${escapeHtml(String(value))}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Basic Markdown to HTML converter
function markdownToHtml(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    // Unordered lists
    .replace(/^\* (.*$)/gm, '<li>$1</li>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    // Blockquotes
    .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    // Wrap in paragraph
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return `<p>${match}</p>`;
    });
}

// Basic HTML to Markdown converter
function htmlToMarkdown(html: string): string {
  return html
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    // Bold
    .replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**')
    // Italic
    .replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*')
    // Code blocks
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n')
    // Inline code
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    // Links
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Images
    .replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*\/?>/gi, '![$1]($2)')
    // List items
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    // Blockquotes
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
    // Paragraphs
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Horizontal rules
    .replace(/<hr\s*\/?>/gi, '\n---\n\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Clean up entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
