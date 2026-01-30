// API Documentation Routes (OpenAPI/Swagger)
import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';

const router = Router();

// OpenAPI 3.0 Specification
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AgentSmith API',
    description: 'Workflow automation platform API for managing workflows, executions, credentials, and users.',
    version: '1.0.0',
    contact: {
      name: 'AgentSmith Support'
    },
    license: {
      name: 'MIT'
    }
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1'
    }
  ],
  tags: [
    { name: 'Authentication', description: 'User authentication and authorization' },
    { name: 'Workflows', description: 'Workflow management' },
    { name: 'Executions', description: 'Workflow execution management' },
    { name: 'Credentials', description: 'Credential management' },
    { name: 'Users', description: 'User management' },
    { name: 'Nodes', description: 'Available workflow nodes' },
    { name: 'Health', description: 'Service health checks' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          message: { type: 'string' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'user', 'viewer'] },
          isActive: { type: 'boolean' },
          twoFactorEnabled: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Workflow: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          nodes: { type: 'array', items: { $ref: '#/components/schemas/WorkflowNode' } },
          connections: { type: 'array', items: { $ref: '#/components/schemas/Connection' } },
          settings: { type: 'object' },
          status: { type: 'string', enum: ['draft', 'active', 'inactive', 'error'] },
          active: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      WorkflowNode: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          name: { type: 'string' },
          position: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' }
            }
          },
          parameters: { type: 'object' },
          credentials: { type: 'object' }
        }
      },
      Connection: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          sourceHandle: { type: 'string' },
          target: { type: 'string' },
          targetHandle: { type: 'string' }
        }
      },
      Execution: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          workflowId: { type: 'string' },
          workflowName: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'running', 'success', 'failed', 'cancelled'] },
          mode: { type: 'string', enum: ['manual', 'trigger', 'webhook', 'retry'] },
          data: { type: 'object' },
          error: { type: 'object' },
          startedAt: { type: 'string', format: 'date-time' },
          finishedAt: { type: 'string', format: 'date-time' }
        }
      },
      Credential: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      NodeType: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          displayName: { type: 'string' },
          description: { type: 'string' },
          icon: { type: 'string' },
          group: { type: 'array', items: { type: 'string' } },
          version: { type: 'number' },
          inputs: { type: 'array', items: { type: 'string' } },
          outputs: { type: 'array', items: { type: 'string' } },
          properties: { type: 'array' },
          credentials: { type: 'array' }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        tokens: {
                          type: 'object',
                          properties: {
                            accessToken: { type: 'string' },
                            refreshToken: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Invalid credentials' }
        }
      }
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register new user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Registration successful' },
          '400': { description: 'Validation error' },
          '409': { description: 'Email already exists' }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user',
        responses: {
          '200': {
            description: 'Current user info',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/workflows': {
      get: {
        tags: ['Workflows'],
        summary: 'List all workflows',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'perPage', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'List of workflows',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        workflows: { type: 'array', items: { $ref: '#/components/schemas/Workflow' } },
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        perPage: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Workflows'],
        summary: 'Create new workflow',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  nodes: { type: 'array' },
                  connections: { type: 'array' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Workflow created' },
          '400': { description: 'Validation error' }
        }
      }
    },
    '/workflows/{id}': {
      get: {
        tags: ['Workflows'],
        summary: 'Get workflow by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Workflow details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Workflow' }
                  }
                }
              }
            }
          },
          '404': { description: 'Workflow not found' }
        }
      },
      put: {
        tags: ['Workflows'],
        summary: 'Update workflow',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Workflow' }
            }
          }
        },
        responses: {
          '200': { description: 'Workflow updated' },
          '404': { description: 'Workflow not found' }
        }
      },
      delete: {
        tags: ['Workflows'],
        summary: 'Delete workflow',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Workflow deleted' },
          '404': { description: 'Workflow not found' }
        }
      }
    },
    '/workflows/{id}/execute': {
      post: {
        tags: ['Workflows'],
        summary: 'Execute workflow',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  inputData: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Execution started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        executionId: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/executions': {
      get: {
        tags: ['Executions'],
        summary: 'List executions',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'perPage', in: 'query', schema: { type: 'integer' } },
          { name: 'workflowId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'List of executions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        executions: { type: 'array', items: { $ref: '#/components/schemas/Execution' } },
                        total: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/executions/{id}': {
      get: {
        tags: ['Executions'],
        summary: 'Get execution by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Execution details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Execution' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/credentials': {
      get: {
        tags: ['Credentials'],
        summary: 'List credentials',
        responses: {
          '200': {
            description: 'List of credentials',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        credentials: { type: 'array', items: { $ref: '#/components/schemas/Credential' } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Credentials'],
        summary: 'Create credential',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'type', 'data'],
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  data: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Credential created' }
        }
      }
    },
    '/nodes': {
      get: {
        tags: ['Nodes'],
        summary: 'List available nodes',
        responses: {
          '200': {
            description: 'List of node types',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/NodeType' } }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: {
          '200': {
            description: 'Service healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number' },
                    version: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

// Swagger UI options
const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AgentSmith API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    syntaxHighlight: {
      theme: 'monokai'
    }
  }
};

// Setup routes
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(openApiSpec, swaggerOptions));

// JSON spec endpoint
router.get('/openapi.json', (req: Request, res: Response) => {
  res.json(openApiSpec);
});

export { router as docsRouter, openApiSpec };
