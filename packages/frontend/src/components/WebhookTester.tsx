// Webhook Testing Tool Component
import React, { useState } from 'react';
import {
  Webhook,
  Send,
  Copy,
  Check,
  X,
  Clock,
  AlertCircle,
  CheckCircle,
  Code,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';

interface WebhookTesterProps {
  webhookUrl: string;
  webhookPath: string;
  method?: string;
  isActive: boolean;
  onClose: () => void;
}

interface TestResult {
  status: 'success' | 'error' | 'pending';
  statusCode?: number;
  responseTime?: number;
  response?: string;
  error?: string;
  headers?: Record<string, string>;
}

const samplePayloads: Record<string, { name: string; payload: object }> = {
  simple: {
    name: 'Simple Object',
    payload: {
      message: 'Hello from AgentSmith!',
      timestamp: new Date().toISOString()
    }
  },
  user: {
    name: 'User Event',
    payload: {
      event: 'user.created',
      data: {
        id: 'usr_123456',
        email: 'user@example.com',
        name: 'John Doe',
        createdAt: new Date().toISOString()
      }
    }
  },
  order: {
    name: 'Order Event',
    payload: {
      event: 'order.completed',
      data: {
        orderId: 'ord_789012',
        customerId: 'cust_456',
        total: 99.99,
        currency: 'USD',
        items: [
          { sku: 'PROD-001', quantity: 2, price: 49.99 }
        ]
      }
    }
  },
  notification: {
    name: 'Notification',
    payload: {
      type: 'alert',
      severity: 'warning',
      message: 'System alert triggered',
      source: 'monitoring',
      metadata: {
        cpu_usage: 85,
        memory_usage: 72
      }
    }
  }
};

export const WebhookTester: React.FC<WebhookTesterProps> = ({
  webhookUrl,
  webhookPath,
  method = 'POST',
  isActive,
  onClose
}) => {
  const [payload, setPayload] = useState(JSON.stringify(samplePayloads.simple.payload, null, 2));
  const [selectedPreset, setSelectedPreset] = useState('simple');
  const [contentType, setContentType] = useState('application/json');
  const [customHeaders, setCustomHeaders] = useState<{ key: string; value: string }[]>([]);
  const [result, setResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResponse, setShowResponse] = useState(true);
  const [showHeaders, setShowHeaders] = useState(false);

  const fullUrl = `${webhookUrl}${webhookPath}`;

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const presetData = samplePayloads[preset];
    if (presetData) {
      setPayload(JSON.stringify(presetData.payload, null, 2));
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setResult({ status: 'pending' });

    const startTime = Date.now();

    try {
      // Parse payload
      let body: string | undefined;
      if (method !== 'GET') {
        if (contentType === 'application/json') {
          // Validate JSON
          JSON.parse(payload);
          body = payload;
        } else {
          body = payload;
        }
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': contentType
      };
      customHeaders.forEach(h => {
        if (h.key && h.value) {
          headers[h.key] = h.value;
        }
      });

      const response = await fetch(fullUrl, {
        method,
        headers,
        body
      });

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      // Get response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      setResult({
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        responseTime,
        response: responseText,
        headers: responseHeaders
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      setResult({
        status: 'error',
        responseTime,
        error: error instanceof Error ? error.message : 'Request failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCurl = async () => {
    let curl = `curl -X ${method} "${fullUrl}"`;
    curl += ` -H "Content-Type: ${contentType}"`;
    customHeaders.forEach(h => {
      if (h.key && h.value) {
        curl += ` -H "${h.key}: ${h.value}"`;
      }
    });
    if (method !== 'GET' && payload) {
      curl += ` -d '${payload.replace(/'/g, "\\'")}'`;
    }
    await navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

  const removeHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Webhook className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Webhook Tester
            </h2>
            {!isActive && (
              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                Webhook Inactive
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Webhook URL
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-lg font-mono text-sm break-all">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded text-xs font-medium">
                  {method}
                </span>
                <span className="text-gray-700 dark:text-gray-300">{fullUrl}</span>
              </div>
              <button
                onClick={handleCopyUrl}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Copy URL"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Request Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content Type
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="application/json">application/json</option>
                <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                <option value="text/plain">text/plain</option>
                <option value="application/xml">application/xml</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sample Payload
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                {Object.entries(samplePayloads).map(([key, value]) => (
                  <option key={key} value={key}>{value.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Headers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Custom Headers
              </label>
              <button
                onClick={addHeader}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add Header
              </button>
            </div>
            {customHeaders.map((header, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                />
                <button
                  onClick={() => removeHeader(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Payload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Request Body
            </label>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 font-mono text-sm"
              placeholder="Enter request payload..."
            />
          </div>

          {/* Result */}
          {result && (
            <div className={`border rounded-lg overflow-hidden ${
              result.status === 'success' ? 'border-green-200 dark:border-green-800' :
              result.status === 'error' ? 'border-red-200 dark:border-red-800' :
              'border-gray-200 dark:border-gray-700'
            }`}>
              {/* Result Header */}
              <div className={`px-4 py-3 flex items-center justify-between ${
                result.status === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
                result.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                'bg-gray-50 dark:bg-gray-900'
              }`}>
                <div className="flex items-center gap-3">
                  {result.status === 'pending' && <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />}
                  {result.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {result.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                  <span className="font-medium">
                    {result.status === 'pending' && 'Sending request...'}
                    {result.status === 'success' && `Success - ${result.statusCode}`}
                    {result.status === 'error' && (result.statusCode ? `Error - ${result.statusCode}` : 'Request Failed')}
                  </span>
                </div>
                {result.responseTime && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    {result.responseTime}ms
                  </div>
                )}
              </div>

              {/* Response Body */}
              {(result.response || result.error) && (
                <div>
                  <button
                    onClick={() => setShowResponse(!showResponse)}
                    className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      Response Body
                    </span>
                    {showResponse ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showResponse && (
                    <pre className="p-4 bg-gray-900 text-gray-100 text-sm overflow-x-auto max-h-48">
                      {result.error || result.response}
                    </pre>
                  )}
                </div>
              )}

              {/* Response Headers */}
              {result.headers && (
                <div>
                  <button
                    onClick={() => setShowHeaders(!showHeaders)}
                    className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-t border-gray-200 dark:border-gray-700"
                  >
                    <span>Response Headers</span>
                    {showHeaders ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showHeaders && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 text-sm">
                      {Object.entries(result.headers).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{key}:</span>
                          <span className="text-gray-500">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={handleCopyCurl}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <Code className="w-4 h-4" />
            Copy as cURL
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Close
            </button>
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhookTester;
