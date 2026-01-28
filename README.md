# AgentSmith

A powerful, self-hosted workflow orchestration platform for creating and managing automated workflows with AI agents. Built as a modern, extensible alternative for n8n-like automation.

## Features

- **Visual Workflow Editor** - Drag-and-drop interface for building workflows
- **AI Agent Support** - Built-in support for AI agents with tools and memory
- **Flexible Triggers** - Manual, webhook, and scheduled triggers
- **Credential Management** - Secure storage for API keys and credentials
- **Real-time Execution** - Monitor workflow executions in real-time
- **Admin Panel** - System administration and user management
- **Docker Support** - Easy deployment with Docker Compose

## Architecture

```
AgentSmith/
├── packages/
│   ├── shared/      # Shared types, utilities, and schemas
│   ├── backend/     # Express.js API server
│   ├── frontend/    # React workflow editor
│   ├── worker/      # Workflow execution engine
│   └── admin/       # Admin panel
├── docker/          # Docker configurations
└── docs/            # Documentation
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for database and Redis)
- npm 9+

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/AlxM1/AgentSmith.git
   cd AgentSmith
   ```

2. **Start infrastructure services**
   ```bash
   docker-compose up -d postgres redis
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts:
   - Backend API: http://localhost:4000
   - Frontend: http://localhost:3000
   - Admin Panel: http://localhost:3001

### Docker Setup (Full Stack)

```bash
docker-compose up -d
```

This starts all services including PostgreSQL, Redis, backend, worker, frontend, and admin panel.

## Default Credentials

After setup, you can log in with:
- **Email**: admin@agentsmith.local
- **Password**: admin123

## Available Scripts

```bash
# Development
npm run dev              # Start all dev servers
npm run dev:backend      # Start backend only
npm run dev:frontend     # Start frontend only
npm run dev:worker       # Start worker only
npm run dev:admin        # Start admin panel only

# Build
npm run build            # Build all packages
npm run build:shared     # Build shared package
npm run build:backend    # Build backend
npm run build:frontend   # Build frontend

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database

# Docker
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services
npm run docker:build     # Build Docker images

# Other
npm run lint             # Lint all packages
npm run test             # Run tests
npm run clean            # Clean build artifacts
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user

### Workflows
- `GET /api/v1/workflows` - List workflows
- `POST /api/v1/workflows` - Create workflow
- `GET /api/v1/workflows/:id` - Get workflow
- `PUT /api/v1/workflows/:id` - Update workflow
- `DELETE /api/v1/workflows/:id` - Delete workflow
- `POST /api/v1/workflows/:id/execute` - Execute workflow
- `POST /api/v1/workflows/:id/activate` - Activate workflow
- `POST /api/v1/workflows/:id/deactivate` - Deactivate workflow

### Executions
- `GET /api/v1/executions` - List executions
- `GET /api/v1/executions/:id` - Get execution
- `POST /api/v1/executions/:id/stop` - Stop execution
- `POST /api/v1/executions/:id/retry` - Retry execution

### Credentials
- `GET /api/v1/credentials` - List credentials
- `POST /api/v1/credentials` - Create credential
- `GET /api/v1/credentials/:id` - Get credential
- `PUT /api/v1/credentials/:id` - Update credential
- `DELETE /api/v1/credentials/:id` - Delete credential

### Webhooks
- `* /webhooks/:path` - Webhook trigger endpoint

## Node Types

### Triggers
- **Manual Trigger** - Start workflow manually
- **Webhook Trigger** - Start via HTTP request
- **Schedule Trigger** - Start on schedule (cron)

### Flow Control
- **IF** - Conditional branching
- **Switch** - Multiple conditions
- **Merge** - Combine inputs
- **Loop** - Iterate over items

### Transform
- **Set** - Set/modify values
- **Code** - Execute JavaScript

### Actions
- **HTTP Request** - Make API calls

### AI
- **AI Agent** - AI with tools
- **AI Chain** - Chain of prompts

### Utility
- **Wait** - Pause execution
- **No Op** - Pass-through

## Configuration

Key environment variables:

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=agentsmith
DB_USERNAME=agentsmith
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-32-char-key

# Worker
WORKER_CONCURRENCY=5
```

## Tech Stack

- **Frontend**: React, React Flow, TailwindCSS, Zustand
- **Backend**: Node.js, Express, Drizzle ORM
- **Database**: PostgreSQL
- **Queue**: Redis + BullMQ
- **Worker**: Node.js + BullMQ
- **Build**: Vite, TypeScript

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Inspired by [n8n](https://n8n.io/)
- Built with [React Flow](https://reactflow.dev/)
- Icons from [Lucide](https://lucide.dev/)
