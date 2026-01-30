/**
 * Form Trigger Node - Generates interactive forms for workflow input
 * Similar to n8n's Form Trigger for collecting user input via web forms
 */

import { NodeDefinition, NodeExecutionContext, NodeOutput } from '../types/nodes.js';

// Form Field Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'password' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'datetime' | 'time' | 'file' | 'hidden';
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  helpText?: string;
  options?: { value: string; label: string }[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    customValidator?: string;
  };
  conditionalDisplay?: {
    field: string;
    operator: 'equals' | 'notEquals' | 'contains' | 'isEmpty' | 'isNotEmpty';
    value?: any;
  };
}

export interface FormPage {
  title?: string;
  description?: string;
  fields: FormField[];
}

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, any>;
  files: { fieldName: string; fileName: string; mimeType: string; size: number; path: string }[];
  submittedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

// Form Trigger Node Definition
export const formTriggerNode: NodeDefinition = {
  name: 'Form Trigger',
  type: 'formTrigger',
  category: 'triggers',
  description: 'Trigger workflow when a form is submitted',
  icon: 'file-text',
  version: 1,
  inputs: [],
  outputs: ['main'],

  properties: [
    {
      name: 'formTitle',
      displayName: 'Form Title',
      type: 'string',
      default: 'Submit Information',
      description: 'Title displayed at the top of the form',
    },
    {
      name: 'formDescription',
      displayName: 'Form Description',
      type: 'string',
      default: '',
      description: 'Optional description shown below the title',
    },
    {
      name: 'formFields',
      displayName: 'Form Fields',
      type: 'fixedCollection',
      typeOptions: {
        multipleValues: true,
        sortable: true,
      },
      default: {},
      options: [
        {
          name: 'field',
          displayName: 'Field',
          values: [
            {
              name: 'fieldType',
              displayName: 'Field Type',
              type: 'options',
              options: [
                { name: 'Text', value: 'text' },
                { name: 'Email', value: 'email' },
                { name: 'Number', value: 'number' },
                { name: 'Password', value: 'password' },
                { name: 'Text Area', value: 'textarea' },
                { name: 'Dropdown', value: 'select' },
                { name: 'Multi-Select', value: 'multiselect' },
                { name: 'Checkbox', value: 'checkbox' },
                { name: 'Radio Buttons', value: 'radio' },
                { name: 'Date', value: 'date' },
                { name: 'Date & Time', value: 'datetime' },
                { name: 'Time', value: 'time' },
                { name: 'File Upload', value: 'file' },
                { name: 'Hidden', value: 'hidden' },
              ],
              default: 'text',
            },
            {
              name: 'fieldLabel',
              displayName: 'Label',
              type: 'string',
              default: '',
            },
            {
              name: 'fieldName',
              displayName: 'Field Name',
              type: 'string',
              default: '',
              description: 'Internal name used in the output data',
            },
            {
              name: 'required',
              displayName: 'Required',
              type: 'boolean',
              default: false,
            },
            {
              name: 'placeholder',
              displayName: 'Placeholder',
              type: 'string',
              default: '',
            },
            {
              name: 'options',
              displayName: 'Options',
              type: 'string',
              default: '',
              description: 'Comma-separated options for select/radio fields',
              displayOptions: {
                show: {
                  fieldType: ['select', 'multiselect', 'radio'],
                },
              },
            },
          ],
        },
      ],
    },
    {
      name: 'submitButtonText',
      displayName: 'Submit Button Text',
      type: 'string',
      default: 'Submit',
    },
    {
      name: 'multiPage',
      displayName: 'Multi-Page Form',
      type: 'boolean',
      default: false,
      description: 'Split form into multiple pages',
    },
    {
      name: 'authentication',
      displayName: 'Authentication',
      type: 'options',
      options: [
        { name: 'None', value: 'none' },
        { name: 'Basic Auth', value: 'basicAuth' },
        { name: 'Header Auth', value: 'headerAuth' },
      ],
      default: 'none',
    },
    {
      name: 'responseMode',
      displayName: 'Response Mode',
      type: 'options',
      options: [
        { name: 'On Submission', value: 'onSubmission' },
        { name: 'Wait for Workflow', value: 'lastNode' },
        { name: 'Custom Response', value: 'custom' },
      ],
      default: 'onSubmission',
    },
    {
      name: 'successMessage',
      displayName: 'Success Message',
      type: 'string',
      default: 'Form submitted successfully!',
      displayOptions: {
        show: {
          responseMode: ['onSubmission'],
        },
      },
    },
    {
      name: 'redirectUrl',
      displayName: 'Redirect URL',
      type: 'string',
      default: '',
      description: 'Redirect to this URL after submission',
    },
    {
      name: 'styling',
      displayName: 'Styling',
      type: 'collection',
      default: {},
      options: [
        {
          name: 'theme',
          displayName: 'Theme',
          type: 'options',
          options: [
            { name: 'Default', value: 'default' },
            { name: 'Dark', value: 'dark' },
            { name: 'Minimal', value: 'minimal' },
            { name: 'Custom', value: 'custom' },
          ],
          default: 'default',
        },
        {
          name: 'primaryColor',
          displayName: 'Primary Color',
          type: 'color',
          default: '#5046e5',
        },
        {
          name: 'customCSS',
          displayName: 'Custom CSS',
          type: 'string',
          typeOptions: {
            rows: 5,
          },
          default: '',
        },
      ],
    },
    {
      name: 'fileUploadOptions',
      displayName: 'File Upload Options',
      type: 'collection',
      default: {},
      options: [
        {
          name: 'maxFileSize',
          displayName: 'Max File Size (MB)',
          type: 'number',
          default: 10,
        },
        {
          name: 'allowedTypes',
          displayName: 'Allowed File Types',
          type: 'string',
          default: '*',
          description: 'Comma-separated list of allowed MIME types or extensions',
        },
        {
          name: 'maxFiles',
          displayName: 'Max Files',
          type: 'number',
          default: 5,
        },
      ],
    },
  ],

  webhookPath: '/form/:formId',
  webhookMethods: ['GET', 'POST'],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, webhookData, instanceId } = context;

    // Generate form ID from workflow and node
    const formId = `${context.workflowId}-${context.nodeId}`;

    // Handle GET request - return form HTML
    if (webhookData?.method === 'GET') {
      const formHtml = generateFormHtml(nodeParams, formId, instanceId);
      return {
        webhookResponse: {
          statusCode: 200,
          headers: { 'Content-Type': 'text/html' },
          body: formHtml,
        },
      };
    }

    // Handle POST request - process form submission
    if (webhookData?.method === 'POST') {
      const submission: FormSubmission = {
        id: generateId(),
        formId,
        data: webhookData.body || {},
        files: webhookData.files || [],
        submittedAt: new Date(),
        ipAddress: webhookData.headers?.['x-forwarded-for'] || webhookData.ip,
        userAgent: webhookData.headers?.['user-agent'],
      };

      // Validate required fields
      const fields = nodeParams.formFields?.field || [];
      const errors: string[] = [];

      for (const field of fields) {
        if (field.required && !submission.data[field.fieldName]) {
          errors.push(`${field.fieldLabel} is required`);
        }
      }

      if (errors.length > 0) {
        return {
          webhookResponse: {
            statusCode: 400,
            body: { success: false, errors },
          },
        };
      }

      // Return form data to workflow
      return {
        items: [
          {
            json: {
              ...submission.data,
              _formSubmission: {
                id: submission.id,
                formId: submission.formId,
                submittedAt: submission.submittedAt.toISOString(),
                ipAddress: submission.ipAddress,
                userAgent: submission.userAgent,
                files: submission.files,
              },
            },
          },
        ],
      };
    }

    return { items: [] };
  },
};

// Form Response Node - Send custom response after form processing
export const formResponseNode: NodeDefinition = {
  name: 'Form Response',
  type: 'formResponse',
  category: 'flow',
  description: 'Send a custom response to a form submission',
  icon: 'send',
  version: 1,
  inputs: ['main'],
  outputs: [],

  properties: [
    {
      name: 'responseType',
      displayName: 'Response Type',
      type: 'options',
      options: [
        { name: 'Success Message', value: 'success' },
        { name: 'Error Message', value: 'error' },
        { name: 'Redirect', value: 'redirect' },
        { name: 'Custom HTML', value: 'html' },
        { name: 'JSON', value: 'json' },
      ],
      default: 'success',
    },
    {
      name: 'message',
      displayName: 'Message',
      type: 'string',
      default: 'Thank you for your submission!',
      displayOptions: {
        show: {
          responseType: ['success', 'error'],
        },
      },
    },
    {
      name: 'redirectUrl',
      displayName: 'Redirect URL',
      type: 'string',
      default: '',
      displayOptions: {
        show: {
          responseType: ['redirect'],
        },
      },
    },
    {
      name: 'htmlContent',
      displayName: 'HTML Content',
      type: 'string',
      typeOptions: {
        rows: 10,
      },
      default: '<html><body><h1>Thank you!</h1></body></html>',
      displayOptions: {
        show: {
          responseType: ['html'],
        },
      },
    },
    {
      name: 'jsonResponse',
      displayName: 'JSON Response',
      type: 'json',
      default: '{"success": true}',
      displayOptions: {
        show: {
          responseType: ['json'],
        },
      },
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;
    const responseType = nodeParams.responseType;

    let response: any;

    switch (responseType) {
      case 'success':
        response = {
          statusCode: 200,
          body: generateResponseHtml('success', nodeParams.message),
          headers: { 'Content-Type': 'text/html' },
        };
        break;
      case 'error':
        response = {
          statusCode: 400,
          body: generateResponseHtml('error', nodeParams.message),
          headers: { 'Content-Type': 'text/html' },
        };
        break;
      case 'redirect':
        response = {
          statusCode: 302,
          headers: { Location: nodeParams.redirectUrl },
        };
        break;
      case 'html':
        response = {
          statusCode: 200,
          body: nodeParams.htmlContent,
          headers: { 'Content-Type': 'text/html' },
        };
        break;
      case 'json':
        response = {
          statusCode: 200,
          body: JSON.parse(nodeParams.jsonResponse),
          headers: { 'Content-Type': 'application/json' },
        };
        break;
    }

    return {
      items: inputItems,
      webhookResponse: response,
    };
  },
};

// Form Builder Node - Dynamically build forms
export const formBuilderNode: NodeDefinition = {
  name: 'Form Builder',
  type: 'formBuilder',
  category: 'utility',
  description: 'Dynamically build form configurations',
  icon: 'layout',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'mode',
      displayName: 'Mode',
      type: 'options',
      options: [
        { name: 'Define Fields', value: 'define' },
        { name: 'From JSON Schema', value: 'jsonSchema' },
        { name: 'From Database Schema', value: 'dbSchema' },
      ],
      default: 'define',
    },
    {
      name: 'jsonSchema',
      displayName: 'JSON Schema',
      type: 'json',
      default: '{}',
      displayOptions: {
        show: {
          mode: ['jsonSchema'],
        },
      },
    },
    {
      name: 'dynamicFields',
      displayName: 'Dynamic Fields Expression',
      type: 'string',
      default: '={{ $json.fields }}',
      description: 'Expression that returns an array of field definitions',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;

    const outputItems = inputItems.map(item => {
      let fields: FormField[] = [];

      if (nodeParams.mode === 'jsonSchema') {
        fields = jsonSchemaToFormFields(JSON.parse(nodeParams.jsonSchema));
      } else if (nodeParams.mode === 'dbSchema') {
        fields = item.json.dbSchema ? dbSchemaToFormFields(item.json.dbSchema) : [];
      } else {
        fields = item.json.fields || [];
      }

      return {
        json: {
          ...item.json,
          formConfig: {
            fields,
            generatedAt: new Date().toISOString(),
          },
        },
      };
    });

    return { items: outputItems };
  },
};

// Helper functions
function generateId(): string {
  return `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateFormHtml(params: any, formId: string, instanceId?: string): string {
  const fields = params.formFields?.field || [];
  const theme = params.styling?.theme || 'default';
  const primaryColor = params.styling?.primaryColor || '#5046e5';

  const fieldHtml = fields.map((field: any) => {
    const required = field.required ? 'required' : '';
    const placeholder = field.placeholder ? `placeholder="${field.placeholder}"` : '';

    switch (field.fieldType) {
      case 'textarea':
        return `
          <div class="form-group">
            <label for="${field.fieldName}">${field.fieldLabel}${field.required ? ' *' : ''}</label>
            <textarea name="${field.fieldName}" id="${field.fieldName}" ${required} ${placeholder}></textarea>
          </div>
        `;
      case 'select':
      case 'multiselect':
        const options = (field.options || '').split(',').map((opt: string) => {
          const trimmed = opt.trim();
          return `<option value="${trimmed}">${trimmed}</option>`;
        }).join('');
        const multiple = field.fieldType === 'multiselect' ? 'multiple' : '';
        return `
          <div class="form-group">
            <label for="${field.fieldName}">${field.fieldLabel}${field.required ? ' *' : ''}</label>
            <select name="${field.fieldName}" id="${field.fieldName}" ${required} ${multiple}>
              <option value="">Select...</option>
              ${options}
            </select>
          </div>
        `;
      case 'checkbox':
        return `
          <div class="form-group checkbox">
            <label>
              <input type="checkbox" name="${field.fieldName}" id="${field.fieldName}" ${required}>
              ${field.fieldLabel}
            </label>
          </div>
        `;
      case 'radio':
        const radioOptions = (field.options || '').split(',').map((opt: string, idx: number) => {
          const trimmed = opt.trim();
          return `
            <label class="radio-option">
              <input type="radio" name="${field.fieldName}" value="${trimmed}" ${idx === 0 && field.required ? 'required' : ''}>
              ${trimmed}
            </label>
          `;
        }).join('');
        return `
          <div class="form-group">
            <label>${field.fieldLabel}${field.required ? ' *' : ''}</label>
            <div class="radio-group">${radioOptions}</div>
          </div>
        `;
      case 'file':
        return `
          <div class="form-group">
            <label for="${field.fieldName}">${field.fieldLabel}${field.required ? ' *' : ''}</label>
            <input type="file" name="${field.fieldName}" id="${field.fieldName}" ${required}>
          </div>
        `;
      case 'hidden':
        return `<input type="hidden" name="${field.fieldName}" value="${field.placeholder || ''}">`;
      default:
        return `
          <div class="form-group">
            <label for="${field.fieldName}">${field.fieldLabel}${field.required ? ' *' : ''}</label>
            <input type="${field.fieldType}" name="${field.fieldName}" id="${field.fieldName}" ${required} ${placeholder}>
          </div>
        `;
    }
  }).join('\n');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.formTitle || 'Form'}</title>
  <style>
    :root {
      --primary-color: ${primaryColor};
      --bg-color: ${theme === 'dark' ? '#1a1a2e' : '#ffffff'};
      --text-color: ${theme === 'dark' ? '#eaeaea' : '#333333'};
      --border-color: ${theme === 'dark' ? '#3a3a5a' : '#e0e0e0'};
      --input-bg: ${theme === 'dark' ? '#2a2a4a' : '#ffffff'};
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
      padding: 20px;
    }

    .form-container {
      max-width: 600px;
      margin: 40px auto;
      padding: 40px;
      background: var(--input-bg);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    h1 {
      margin-bottom: 8px;
      font-size: 24px;
      font-weight: 600;
    }

    .description {
      color: #666;
      margin-bottom: 24px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      font-size: 14px;
    }

    input[type="text"],
    input[type="email"],
    input[type="number"],
    input[type="password"],
    input[type="date"],
    input[type="datetime-local"],
    input[type="time"],
    textarea,
    select {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 14px;
      background: var(--input-bg);
      color: var(--text-color);
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus,
    textarea:focus,
    select:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(80, 70, 229, 0.1);
    }

    textarea {
      min-height: 120px;
      resize: vertical;
    }

    .checkbox label,
    .radio-option {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: normal;
      cursor: pointer;
    }

    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    button[type="submit"] {
      width: 100%;
      padding: 14px;
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }

    button[type="submit"]:hover {
      background: color-mix(in srgb, var(--primary-color) 90%, black);
    }

    button[type="submit"]:active {
      transform: scale(0.98);
    }

    .error {
      color: #e74c3c;
      font-size: 12px;
      margin-top: 4px;
    }

    .success-message {
      background: #d4edda;
      color: #155724;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }

    ${params.styling?.customCSS || ''}
  </style>
</head>
<body>
  <div class="form-container">
    <h1>${params.formTitle || 'Form'}</h1>
    ${params.formDescription ? `<p class="description">${params.formDescription}</p>` : ''}

    <form id="agentsmith-form" method="POST" enctype="multipart/form-data">
      ${fieldHtml}
      <button type="submit">${params.submitButtonText || 'Submit'}</button>
    </form>
  </div>

  <script>
    document.getElementById('agentsmith-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const formData = new FormData(form);

      try {
        const response = await fetch(window.location.href, {
          method: 'POST',
          body: formData,
        });

        if (response.redirected) {
          window.location.href = response.url;
          return;
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          document.body.innerHTML = await response.text();
        } else {
          const result = await response.json();
          if (result.success !== false) {
            form.innerHTML = '<div class="success-message">${params.successMessage || 'Form submitted successfully!'}</div>';
          } else {
            alert(result.errors?.join('\\n') || 'Submission failed');
          }
        }
      } catch (error) {
        console.error('Submission error:', error);
        alert('An error occurred. Please try again.');
      }
    });
  </script>
</body>
</html>
  `;
}

function generateResponseHtml(type: 'success' | 'error', message: string): string {
  const bgColor = type === 'success' ? '#d4edda' : '#f8d7da';
  const textColor = type === 'success' ? '#155724' : '#721c24';
  const icon = type === 'success' ? '✓' : '✗';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${type === 'success' ? 'Success' : 'Error'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .message-box {
      background: ${bgColor};
      color: ${textColor};
      padding: 40px 60px;
      border-radius: 12px;
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .message {
      font-size: 18px;
    }
  </style>
</head>
<body>
  <div class="message-box">
    <div class="icon">${icon}</div>
    <div class="message">${message}</div>
  </div>
</body>
</html>
  `;
}

function jsonSchemaToFormFields(schema: any): FormField[] {
  const fields: FormField[] = [];
  const properties = schema.properties || {};
  const required = schema.required || [];

  for (const [name, prop] of Object.entries(properties) as [string, any][]) {
    let fieldType: FormField['type'] = 'text';

    if (prop.type === 'integer' || prop.type === 'number') {
      fieldType = 'number';
    } else if (prop.type === 'boolean') {
      fieldType = 'checkbox';
    } else if (prop.format === 'email') {
      fieldType = 'email';
    } else if (prop.format === 'date') {
      fieldType = 'date';
    } else if (prop.format === 'date-time') {
      fieldType = 'datetime';
    } else if (prop.enum) {
      fieldType = 'select';
    } else if (prop.maxLength && prop.maxLength > 200) {
      fieldType = 'textarea';
    }

    fields.push({
      name,
      label: prop.title || name,
      type: fieldType,
      required: required.includes(name),
      placeholder: prop.description,
      options: prop.enum?.map((v: string) => ({ value: v, label: v })),
      validation: {
        minLength: prop.minLength,
        maxLength: prop.maxLength,
        min: prop.minimum,
        max: prop.maximum,
        pattern: prop.pattern,
      },
    });
  }

  return fields;
}

function dbSchemaToFormFields(dbSchema: any[]): FormField[] {
  return dbSchema.map(column => {
    let fieldType: FormField['type'] = 'text';

    const typeLower = (column.type || '').toLowerCase();
    if (typeLower.includes('int') || typeLower.includes('decimal') || typeLower.includes('float')) {
      fieldType = 'number';
    } else if (typeLower.includes('bool')) {
      fieldType = 'checkbox';
    } else if (typeLower.includes('date') && typeLower.includes('time')) {
      fieldType = 'datetime';
    } else if (typeLower.includes('date')) {
      fieldType = 'date';
    } else if (typeLower.includes('time')) {
      fieldType = 'time';
    } else if (typeLower.includes('text') || typeLower.includes('longtext')) {
      fieldType = 'textarea';
    }

    return {
      name: column.name,
      label: column.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      type: fieldType,
      required: column.nullable === false,
    };
  });
}

export const formNodes = [formTriggerNode, formResponseNode, formBuilderNode];
