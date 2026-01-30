/**
 * Code Node - Execute custom code in multiple languages
 * Supports JavaScript, Python, and Shell scripting
 */

import { NodeDefinition, NodeExecutionContext, NodeOutput } from '../types/nodes.js';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { VM, VMScript } from 'vm2';

// Code execution result
interface CodeExecutionResult {
  success: boolean;
  output: any;
  stdout: string;
  stderr: string;
  executionTime: number;
  error?: string;
}

// JavaScript Code Node
export const jsCodeNode: NodeDefinition = {
  name: 'Code',
  type: 'code',
  category: 'core',
  description: 'Execute custom JavaScript code',
  icon: 'code',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'mode',
      displayName: 'Mode',
      type: 'options',
      options: [
        { name: 'Run Once for All Items', value: 'runOnceForAllItems' },
        { name: 'Run Once for Each Item', value: 'runOnceForEachItem' },
      ],
      default: 'runOnceForAllItems',
      description: 'Whether to run the code once with all items or once per item',
    },
    {
      name: 'jsCode',
      displayName: 'JavaScript Code',
      type: 'string',
      typeOptions: {
        rows: 15,
        editor: 'codeEditor',
        language: 'javascript',
      },
      default: `// Access input items with $input.all() or $input.first()
// Return data to pass to next node

const items = $input.all();

// Process items
const processedItems = items.map(item => {
  return {
    json: {
      ...item.json,
      processed: true,
      timestamp: new Date().toISOString()
    }
  };
});

return processedItems;`,
      description: 'JavaScript code to execute',
    },
    {
      name: 'timeout',
      displayName: 'Timeout (ms)',
      type: 'number',
      default: 10000,
      description: 'Maximum execution time in milliseconds',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems, workflowStaticData } = context;
    const code = nodeParams.jsCode;
    const mode = nodeParams.mode;
    const timeout = nodeParams.timeout || 10000;

    // Create sandbox environment
    const createSandbox = (items: any[], itemIndex?: number) => ({
      $input: {
        all: () => items,
        first: () => items[0],
        last: () => items[items.length - 1],
        item: itemIndex !== undefined ? items[itemIndex] : items[0],
      },
      $items: items,
      $item: itemIndex !== undefined ? items[itemIndex] : items[0],
      $json: itemIndex !== undefined ? items[itemIndex]?.json : items[0]?.json,
      $itemIndex: itemIndex,
      $env: process.env,
      $workflow: {
        id: context.workflowId,
        name: context.workflowName,
        active: true,
      },
      $node: {
        id: context.nodeId,
        name: context.nodeName,
      },
      $execution: {
        id: context.executionId,
        mode: context.executionMode,
      },
      $staticData: workflowStaticData || {},
      $now: new Date(),
      $today: new Date().toISOString().split('T')[0],
      console: {
        log: (...args: any[]) => console.log('[Code Node]', ...args),
        error: (...args: any[]) => console.error('[Code Node]', ...args),
        warn: (...args: any[]) => console.warn('[Code Node]', ...args),
      },
      Buffer,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      Promise,
      setTimeout: undefined, // Disabled for security
      setInterval: undefined, // Disabled for security
    });

    try {
      const vm = new VM({
        timeout,
        sandbox: {},
        eval: false,
        wasm: false,
      });

      if (mode === 'runOnceForEachItem') {
        const results: any[] = [];

        for (let i = 0; i < inputItems.length; i++) {
          const sandbox = createSandbox(inputItems, i);
          vm.setGlobals(sandbox);

          const wrappedCode = `
            (async () => {
              ${code}
            })()
          `;

          const result = await vm.run(wrappedCode);

          if (Array.isArray(result)) {
            results.push(...result);
          } else if (result !== undefined) {
            results.push({ json: result });
          }
        }

        return { items: results };
      } else {
        const sandbox = createSandbox(inputItems);
        vm.setGlobals(sandbox);

        const wrappedCode = `
          (async () => {
            ${code}
          })()
        `;

        const result = await vm.run(wrappedCode);

        if (Array.isArray(result)) {
          return { items: result };
        } else if (result !== undefined) {
          return { items: [{ json: result }] };
        }

        return { items: inputItems };
      }
    } catch (error: any) {
      throw new Error(`Code execution failed: ${error.message}`);
    }
  },
};

// Python Code Node
export const pythonCodeNode: NodeDefinition = {
  name: 'Python Code',
  type: 'pythonCode',
  category: 'core',
  description: 'Execute custom Python code',
  icon: 'code',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'pythonCode',
      displayName: 'Python Code',
      type: 'string',
      typeOptions: {
        rows: 15,
        editor: 'codeEditor',
        language: 'python',
      },
      default: `# Access input data via 'items' variable
# Return data by assigning to 'output' variable

import json
from datetime import datetime

# items contains the input data as a list of dicts
output = []

for item in items:
    processed = {
        **item.get('json', {}),
        'processed': True,
        'timestamp': datetime.now().isoformat()
    }
    output.append({'json': processed})

# output will be passed to the next node`,
      description: 'Python code to execute',
    },
    {
      name: 'pythonPath',
      displayName: 'Python Path',
      type: 'string',
      default: 'python3',
      description: 'Path to Python executable',
    },
    {
      name: 'timeout',
      displayName: 'Timeout (ms)',
      type: 'number',
      default: 30000,
      description: 'Maximum execution time in milliseconds',
    },
    {
      name: 'packages',
      displayName: 'Required Packages',
      type: 'string',
      default: '',
      description: 'Comma-separated list of pip packages to ensure are installed',
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;
    const code = nodeParams.pythonCode;
    const pythonPath = nodeParams.pythonPath || 'python3';
    const timeout = nodeParams.timeout || 30000;

    const result = await executePython(code, inputItems, pythonPath, timeout);

    if (!result.success) {
      throw new Error(`Python execution failed: ${result.error || result.stderr}`);
    }

    return { items: result.output };
  },
};

// Shell/Bash Code Node
export const shellCodeNode: NodeDefinition = {
  name: 'Execute Command',
  type: 'executeCommand',
  category: 'core',
  description: 'Execute shell commands',
  icon: 'terminal',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'command',
      displayName: 'Command',
      type: 'string',
      typeOptions: {
        rows: 5,
        editor: 'codeEditor',
        language: 'shell',
      },
      default: 'echo "Hello from AgentSmith"',
      description: 'Shell command to execute',
    },
    {
      name: 'shell',
      displayName: 'Shell',
      type: 'options',
      options: [
        { name: 'Bash', value: '/bin/bash' },
        { name: 'Sh', value: '/bin/sh' },
        { name: 'Zsh', value: '/bin/zsh' },
        { name: 'PowerShell', value: 'powershell' },
        { name: 'CMD', value: 'cmd.exe' },
      ],
      default: '/bin/bash',
    },
    {
      name: 'cwd',
      displayName: 'Working Directory',
      type: 'string',
      default: '',
      description: 'Directory to run the command in',
    },
    {
      name: 'timeout',
      displayName: 'Timeout (ms)',
      type: 'number',
      default: 60000,
      description: 'Maximum execution time in milliseconds',
    },
    {
      name: 'executeOnce',
      displayName: 'Execute Once',
      type: 'boolean',
      default: true,
      description: 'Execute command once, or once per input item',
    },
    {
      name: 'env',
      displayName: 'Environment Variables',
      type: 'fixedCollection',
      typeOptions: {
        multipleValues: true,
      },
      default: {},
      options: [
        {
          name: 'variable',
          displayName: 'Variable',
          values: [
            {
              name: 'name',
              displayName: 'Name',
              type: 'string',
              default: '',
            },
            {
              name: 'value',
              displayName: 'Value',
              type: 'string',
              default: '',
            },
          ],
        },
      ],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;
    const command = nodeParams.command;
    const shell = nodeParams.shell || '/bin/bash';
    const timeout = nodeParams.timeout || 60000;
    const executeOnce = nodeParams.executeOnce !== false;
    const cwd = nodeParams.cwd || process.cwd();

    // Build environment variables
    const envVars: Record<string, string> = { ...process.env };
    const customEnv = nodeParams.env?.variable || [];
    for (const v of customEnv) {
      if (v.name) {
        envVars[v.name] = v.value;
      }
    }

    if (executeOnce) {
      // Pass all items as JSON via stdin
      const inputJson = JSON.stringify(inputItems.map(i => i.json));
      const result = await executeShell(command, shell, cwd, timeout, envVars, inputJson);

      return {
        items: [
          {
            json: {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.success ? 0 : 1,
              executionTime: result.executionTime,
            },
          },
        ],
      };
    } else {
      const results: any[] = [];

      for (const item of inputItems) {
        const inputJson = JSON.stringify(item.json);
        const result = await executeShell(command, shell, cwd, timeout, envVars, inputJson);

        results.push({
          json: {
            ...item.json,
            _command: {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.success ? 0 : 1,
              executionTime: result.executionTime,
            },
          },
        });
      }

      return { items: results };
    }
  },
};

// Function Node - Simplified code execution
export const functionNode: NodeDefinition = {
  name: 'Function',
  type: 'function',
  category: 'core',
  description: 'Transform data with a simple JavaScript function',
  icon: 'function',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'functionCode',
      displayName: 'Function',
      type: 'string',
      typeOptions: {
        rows: 10,
        editor: 'codeEditor',
        language: 'javascript',
      },
      default: `// Write your transformation logic
// 'items' contains all input items
// Return the transformed items

return items.map(item => {
  return {
    json: {
      ...item.json,
      // Add your transformations here
    }
  };
});`,
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;
    const code = nodeParams.functionCode;

    const vm = new VM({
      timeout: 10000,
      sandbox: {
        items: inputItems,
        $items: inputItems,
        console: {
          log: (...args: any[]) => console.log('[Function]', ...args),
        },
        JSON,
        Math,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
      },
    });

    const wrappedCode = `
      (function() {
        ${code}
      })()
    `;

    const result = vm.run(wrappedCode);

    if (Array.isArray(result)) {
      return { items: result };
    } else if (result) {
      return { items: [{ json: result }] };
    }

    return { items: inputItems };
  },
};

// Expression Evaluator Node
export const expressionNode: NodeDefinition = {
  name: 'Set',
  type: 'set',
  category: 'core',
  description: 'Set values on items using expressions',
  icon: 'edit-3',
  version: 1,
  inputs: ['main'],
  outputs: ['main'],

  properties: [
    {
      name: 'mode',
      displayName: 'Mode',
      type: 'options',
      options: [
        { name: 'Manual Mapping', value: 'manual' },
        { name: 'JSON', value: 'json' },
      ],
      default: 'manual',
    },
    {
      name: 'values',
      displayName: 'Values to Set',
      type: 'fixedCollection',
      typeOptions: {
        multipleValues: true,
        sortable: true,
      },
      displayOptions: {
        show: {
          mode: ['manual'],
        },
      },
      default: {},
      options: [
        {
          name: 'string',
          displayName: 'String',
          values: [
            {
              name: 'name',
              displayName: 'Name',
              type: 'string',
              default: '',
            },
            {
              name: 'value',
              displayName: 'Value',
              type: 'string',
              default: '',
            },
          ],
        },
        {
          name: 'number',
          displayName: 'Number',
          values: [
            {
              name: 'name',
              displayName: 'Name',
              type: 'string',
              default: '',
            },
            {
              name: 'value',
              displayName: 'Value',
              type: 'number',
              default: 0,
            },
          ],
        },
        {
          name: 'boolean',
          displayName: 'Boolean',
          values: [
            {
              name: 'name',
              displayName: 'Name',
              type: 'string',
              default: '',
            },
            {
              name: 'value',
              displayName: 'Value',
              type: 'boolean',
              default: false,
            },
          ],
        },
        {
          name: 'json',
          displayName: 'JSON',
          values: [
            {
              name: 'name',
              displayName: 'Name',
              type: 'string',
              default: '',
            },
            {
              name: 'value',
              displayName: 'Value',
              type: 'json',
              default: '{}',
            },
          ],
        },
      ],
    },
    {
      name: 'jsonOutput',
      displayName: 'JSON Output',
      type: 'json',
      default: '{}',
      displayOptions: {
        show: {
          mode: ['json'],
        },
      },
    },
    {
      name: 'options',
      displayName: 'Options',
      type: 'collection',
      default: {},
      options: [
        {
          name: 'keepOnlySet',
          displayName: 'Keep Only Set',
          type: 'boolean',
          default: false,
          description: 'Only keep values that are explicitly set',
        },
        {
          name: 'dotNotation',
          displayName: 'Dot Notation',
          type: 'boolean',
          default: true,
          description: 'Allow setting nested values using dot notation (e.g., "user.name")',
        },
      ],
    },
  ],

  async execute(context: NodeExecutionContext): Promise<NodeOutput> {
    const { nodeParams, inputItems } = context;
    const mode = nodeParams.mode;
    const keepOnlySet = nodeParams.options?.keepOnlySet || false;
    const dotNotation = nodeParams.options?.dotNotation !== false;

    const setNestedValue = (obj: any, path: string, value: any) => {
      if (!dotNotation || !path.includes('.')) {
        obj[path] = value;
        return;
      }

      const parts = path.split('.');
      let current = obj;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in current)) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = value;
    };

    const outputItems = inputItems.map(item => {
      let newJson: any = keepOnlySet ? {} : { ...item.json };

      if (mode === 'json') {
        const jsonOutput = typeof nodeParams.jsonOutput === 'string'
          ? JSON.parse(nodeParams.jsonOutput)
          : nodeParams.jsonOutput;

        newJson = keepOnlySet ? jsonOutput : { ...newJson, ...jsonOutput };
      } else {
        const values = nodeParams.values || {};

        for (const type of ['string', 'number', 'boolean', 'json']) {
          const typeValues = values[type] || [];
          for (const v of typeValues) {
            if (v.name) {
              let finalValue = v.value;
              if (type === 'json' && typeof finalValue === 'string') {
                finalValue = JSON.parse(finalValue);
              }
              setNestedValue(newJson, v.name, finalValue);
            }
          }
        }
      }

      return { json: newJson };
    });

    return { items: outputItems };
  },
};

// Helper functions
async function executePython(
  code: string,
  inputItems: any[],
  pythonPath: string,
  timeout: number
): Promise<CodeExecutionResult> {
  const startTime = Date.now();
  const tempDir = join(tmpdir(), 'agentsmith-python');

  try {
    await mkdir(tempDir, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }

  const scriptFile = join(tempDir, `script_${Date.now()}.py`);
  const inputFile = join(tempDir, `input_${Date.now()}.json`);
  const outputFile = join(tempDir, `output_${Date.now()}.json`);

  // Write input data
  await writeFile(inputFile, JSON.stringify(inputItems));

  // Create Python wrapper script
  const wrapperCode = `
import json
import sys

# Load input items
with open('${inputFile.replace(/\\/g, '\\\\')}', 'r') as f:
    items = json.load(f)

output = []

# User code
${code}

# Write output
with open('${outputFile.replace(/\\/g, '\\\\')}', 'w') as f:
    json.dump(output if isinstance(output, list) else [{'json': output}], f)
`;

  await writeFile(scriptFile, wrapperCode);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn(pythonPath, [scriptFile], {
      timeout,
      cwd: tempDir,
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', async (exitCode) => {
      clearTimeout(timer);

      // Cleanup
      try {
        await Promise.all([
          unlink(scriptFile).catch(() => {}),
          unlink(inputFile).catch(() => {}),
        ]);
      } catch (e) {}

      if (killed) {
        resolve({
          success: false,
          output: [],
          stdout,
          stderr,
          executionTime: Date.now() - startTime,
          error: 'Execution timed out',
        });
        return;
      }

      if (exitCode !== 0) {
        resolve({
          success: false,
          output: [],
          stdout,
          stderr,
          executionTime: Date.now() - startTime,
          error: stderr || 'Python execution failed',
        });
        return;
      }

      try {
        const { readFile } = await import('fs/promises');
        const outputData = await readFile(outputFile, 'utf8');
        await unlink(outputFile).catch(() => {});

        resolve({
          success: true,
          output: JSON.parse(outputData),
          stdout,
          stderr,
          executionTime: Date.now() - startTime,
        });
      } catch (e: any) {
        resolve({
          success: false,
          output: [],
          stdout,
          stderr,
          executionTime: Date.now() - startTime,
          error: `Failed to read output: ${e.message}`,
        });
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        success: false,
        output: [],
        stdout,
        stderr,
        executionTime: Date.now() - startTime,
        error: error.message,
      });
    });
  });
}

async function executeShell(
  command: string,
  shell: string,
  cwd: string,
  timeout: number,
  env: Record<string, string>,
  stdin?: string
): Promise<CodeExecutionResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const isWindows = process.platform === 'win32';
    const shellArgs = isWindows
      ? shell === 'powershell'
        ? ['-Command', command]
        : ['/c', command]
      : ['-c', command];

    const proc = spawn(shell, shellArgs, {
      cwd,
      env,
      timeout,
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
    }, timeout);

    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode) => {
      clearTimeout(timer);

      if (killed) {
        resolve({
          success: false,
          output: null,
          stdout,
          stderr,
          executionTime: Date.now() - startTime,
          error: 'Execution timed out',
        });
        return;
      }

      resolve({
        success: exitCode === 0,
        output: stdout.trim(),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        executionTime: Date.now() - startTime,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        success: false,
        output: null,
        stdout,
        stderr,
        executionTime: Date.now() - startTime,
        error: error.message,
      });
    });
  });
}

export const codeNodes = [
  jsCodeNode,
  pythonCodeNode,
  shellCodeNode,
  functionNode,
  expressionNode,
];
