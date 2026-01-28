// Execution Helpers - n8n-compatible helper functions

import type {
  IDataObject,
  INodeExecutionData,
  IBinaryData,
  IPairedItemData,
  IRequestOptions,
} from './types.js';

// ============================================
// Data Transformation Helpers
// ============================================

/**
 * Convert an array of objects to INodeExecutionData array
 */
export function returnJsonArray(items: IDataObject[]): INodeExecutionData[] {
  return items.map((item, index) => ({
    json: item,
    pairedItem: { item: index },
  }));
}

/**
 * Construct execution metadata with paired item tracking
 */
export function constructExecutionMetaData(
  inputData: INodeExecutionData[],
  options: { itemData: IPairedItemData }
): INodeExecutionData[] {
  return inputData.map((item) => ({
    ...item,
    pairedItem: options.itemData,
  }));
}

/**
 * Flatten nested arrays of execution data
 */
export function flattenExecutionData(
  data: INodeExecutionData[][]
): INodeExecutionData[] {
  return data.flat();
}

/**
 * Copy input items for modification
 */
export function copyInputItems(
  items: INodeExecutionData[],
  properties: string[]
): INodeExecutionData[] {
  return items.map((item) => {
    const newItem: IDataObject = {};
    for (const property of properties) {
      if (item.json[property] !== undefined) {
        newItem[property] = JSON.parse(JSON.stringify(item.json[property]));
      }
    }
    return {
      json: newItem,
      pairedItem: item.pairedItem,
    };
  });
}

// ============================================
// Binary Data Helpers
// ============================================

/**
 * Prepare binary data from buffer
 */
export async function prepareBinaryData(
  data: Buffer | string,
  fileName?: string,
  mimeType?: string
): Promise<IBinaryData> {
  const buffer = typeof data === 'string' ? Buffer.from(data) : data;

  return {
    data: buffer.toString('base64'),
    mimeType: mimeType || 'application/octet-stream',
    fileName: fileName || 'file',
    fileSize: buffer.length,
    fileExtension: fileName?.split('.').pop() || '',
  };
}

/**
 * Get binary data as buffer
 */
export function getBinaryDataBuffer(binaryData: IBinaryData): Buffer {
  return Buffer.from(binaryData.data, 'base64');
}

/**
 * Check if item has binary data
 */
export function hasBinaryData(
  item: INodeExecutionData,
  propertyName?: string
): boolean {
  if (!item.binary) return false;
  if (propertyName) {
    return propertyName in item.binary;
  }
  return Object.keys(item.binary).length > 0;
}

// ============================================
// HTTP Request Helpers
// ============================================

/**
 * Build URL with query parameters
 */
export function buildUrl(baseUrl: string, path: string, qs?: IDataObject): string {
  const url = new URL(path, baseUrl);

  if (qs) {
    for (const [key, value] of Object.entries(qs)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  return url.toString();
}

/**
 * Parse response based on content type
 */
export function parseResponse(
  response: unknown,
  contentType?: string
): IDataObject | IDataObject[] {
  if (typeof response === 'string') {
    if (contentType?.includes('application/json') || response.startsWith('{') || response.startsWith('[')) {
      try {
        return JSON.parse(response);
      } catch {
        return { data: response };
      }
    }
    return { data: response };
  }

  if (typeof response === 'object' && response !== null) {
    return response as IDataObject;
  }

  return { data: response };
}

/**
 * Handle pagination for API requests
 */
export async function requestWithPagination(
  requestFn: (options: IRequestOptions) => Promise<unknown>,
  baseOptions: IRequestOptions,
  paginationConfig: {
    type: 'offset' | 'cursor' | 'page';
    limitParam?: string;
    offsetParam?: string;
    pageParam?: string;
    cursorParam?: string;
    cursorPath?: string;
    limit?: number;
    maxPages?: number;
    dataPath?: string;
  }
): Promise<IDataObject[]> {
  const allData: IDataObject[] = [];
  let hasMore = true;
  let page = 1;
  let offset = 0;
  let cursor: string | undefined;

  const limit = paginationConfig.limit || 100;
  const maxPages = paginationConfig.maxPages || 100;

  while (hasMore && page <= maxPages) {
    const options = { ...baseOptions };
    options.qs = { ...options.qs };

    // Set pagination parameters
    if (paginationConfig.type === 'offset') {
      options.qs[paginationConfig.limitParam || 'limit'] = limit;
      options.qs[paginationConfig.offsetParam || 'offset'] = offset;
    } else if (paginationConfig.type === 'page') {
      options.qs[paginationConfig.limitParam || 'limit'] = limit;
      options.qs[paginationConfig.pageParam || 'page'] = page;
    } else if (paginationConfig.type === 'cursor' && cursor) {
      options.qs[paginationConfig.cursorParam || 'cursor'] = cursor;
    }

    // Make request
    const response = await requestFn(options);
    const responseData = response as IDataObject;

    // Extract data
    let pageData: IDataObject[];
    if (paginationConfig.dataPath) {
      const pathParts = paginationConfig.dataPath.split('.');
      let data: unknown = responseData;
      for (const part of pathParts) {
        data = (data as IDataObject)?.[part];
      }
      pageData = Array.isArray(data) ? data : [data as IDataObject];
    } else if (Array.isArray(responseData)) {
      pageData = responseData;
    } else {
      pageData = [responseData];
    }

    allData.push(...pageData);

    // Check for more data
    if (pageData.length < limit) {
      hasMore = false;
    } else if (paginationConfig.type === 'cursor') {
      cursor = paginationConfig.cursorPath
        ? String(getNestedValue(responseData, paginationConfig.cursorPath))
        : undefined;
      if (!cursor) hasMore = false;
    }

    page++;
    offset += limit;
  }

  return allData;
}

function getNestedValue(obj: IDataObject, path: string): unknown {
  return path.split('.').reduce((acc, part) => (acc as IDataObject)?.[part], obj as unknown);
}

// ============================================
// Error Handling Helpers
// ============================================

/**
 * Parse error from various sources
 */
export function parseError(error: unknown): { message: string; description?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      description: error.stack,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as IDataObject;
    return {
      message: String(err.message || err.error || err.msg || 'Unknown error'),
      description: err.description as string | undefined,
    };
  }

  return { message: String(error) };
}

/**
 * Create error output item
 */
export function createErrorItem(
  error: unknown,
  itemIndex: number
): INodeExecutionData {
  const { message, description } = parseError(error);
  return {
    json: {
      error: true,
      message,
      description,
    },
    pairedItem: { item: itemIndex },
  };
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate required parameters
 */
export function validateRequiredParams(
  params: IDataObject,
  required: string[]
): void {
  const missing = required.filter(
    (key) => params[key] === undefined || params[key] === null || params[key] === ''
  );

  if (missing.length > 0) {
    throw new Error(`Missing required parameters: ${missing.join(', ')}`);
  }
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================
// Data Extraction Helpers
// ============================================

/**
 * Extract IDs from items
 */
export function extractIds(
  items: INodeExecutionData[],
  idField: string = 'id'
): string[] {
  return items
    .map((item) => item.json[idField])
    .filter((id): id is string => id !== undefined && id !== null)
    .map(String);
}

/**
 * Group items by field value
 */
export function groupItemsByField(
  items: INodeExecutionData[],
  field: string
): Record<string, INodeExecutionData[]> {
  const groups: Record<string, INodeExecutionData[]> = {};

  for (const item of items) {
    const key = String(item.json[field] || 'undefined');
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }

  return groups;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends IDataObject>(target: T, ...sources: Partial<T>[]): T {
  const result = { ...target };

  for (const source of sources) {
    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        (result as IDataObject)[key] = deepMerge(
          targetValue as IDataObject,
          sourceValue as IDataObject
        );
      } else if (sourceValue !== undefined) {
        (result as IDataObject)[key] = sourceValue;
      }
    }
  }

  return result;
}
