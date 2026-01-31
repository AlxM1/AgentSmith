# AgentSmith Database Setup Guide

This guide covers how to set up the PostgreSQL database for AgentSmith.

## Quick Start (Docker - Recommended)

The fastest way to get started is using Docker Compose:

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for services to be healthy (about 10 seconds)
docker-compose ps

# The database schema is automatically initialized via docker/init-db.sql
```

That's it! The database is ready to use with default settings.

## Manual Setup (Without Docker)

### Prerequisites

- PostgreSQL 14+ installed
- psql client available

### Step 1: Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS (with Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### Step 2: Create Database and User

```bash
# Connect as postgres superuser
sudo -u postgres psql

# Run these SQL commands:
CREATE USER agentsmith WITH PASSWORD 'agentsmith_password';
CREATE DATABASE agentsmith OWNER agentsmith;
GRANT ALL PRIVILEGES ON DATABASE agentsmith TO agentsmith;
\q
```

### Step 3: Run Schema Migration

```bash
# From the project root
PGPASSWORD=agentsmith_password psql -h localhost -U agentsmith -d agentsmith -f docker/init-db.sql
```

Or use the setup script:
```bash
chmod +x scripts/setup-db.sh
./scripts/setup-db.sh
```

### Step 4: Verify Setup

```bash
# Connect to database
PGPASSWORD=agentsmith_password psql -h localhost -U agentsmith -d agentsmith

# List tables
\dt

# You should see tables like: users, workflows, executions, credentials, etc.
\q
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure the database settings:

```bash
cp .env.example .env
```

Key database variables:
```env
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=agentsmith
DB_USERNAME=agentsmith
DB_PASSWORD=your_secure_password
DB_SSL=false  # Set to true for production
```

### Connection String Format

The application uses this connection format internally:
```
postgresql://agentsmith:password@localhost:5432/agentsmith
```

## Database Schema

The schema includes the following main tables:

| Table | Description |
|-------|-------------|
| `users` | User accounts with SSO and 2FA support |
| `workflows` | Workflow definitions with versioning |
| `workflow_versions` | Version history for workflows |
| `executions` | Workflow execution records |
| `execution_data` | Large execution data storage |
| `credentials` | Encrypted credential storage |
| `credential_shares` | Credential sharing between users |
| `webhooks` | Webhook configurations |
| `api_keys` | API key management |
| `tags` | Workflow tags |
| `variables` | Global workflow variables |
| `scheduled_triggers` | Cron-based trigger schedules |
| `settings` | Application settings |
| `audit_logs` | Audit trail for compliance |
| `sessions` | User session management |

## Default Admin Account

After setup, a default admin account is created:

- **Email:** admin@agentsmith.local
- **Password:** admin123

⚠️ **IMPORTANT:** Change this password immediately in production!

```sql
-- To change the admin password, update with a bcrypt hash
UPDATE users
SET password_hash = '$2a$10$your_new_bcrypt_hash'
WHERE email = 'admin@agentsmith.local';
```

## Production Recommendations

### 1. Use Strong Passwords

Generate secure passwords:
```bash
openssl rand -base64 32
```

### 2. Enable SSL

```env
DB_SSL=true
```

### 3. Create a Separate Application User

```sql
-- Create read/write app user (not superuser)
CREATE USER agentsmith_app WITH PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agentsmith_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agentsmith_app;
```

### 4. Configure Connection Pooling

For high-traffic deployments, use PgBouncer:
```env
DB_POOL_MIN=2
DB_POOL_MAX=20
```

### 5. Set Up Backups

```bash
# Daily backup script
pg_dump -h localhost -U agentsmith -d agentsmith | gzip > backup_$(date +%Y%m%d).sql.gz
```

### 6. Enable Audit Logging

PostgreSQL logging in `postgresql.conf`:
```conf
log_statement = 'mod'
log_duration = on
log_connections = on
log_disconnections = on
```

## Troubleshooting

### Connection Refused

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check if it's listening on the right port
sudo netstat -tlnp | grep 5432
```

### Authentication Failed

1. Check `pg_hba.conf` allows the connection method
2. Verify username/password
3. Ensure database exists

### Permission Denied

```sql
-- Grant permissions
GRANT ALL ON DATABASE agentsmith TO agentsmith;
GRANT ALL ON ALL TABLES IN SCHEMA public TO agentsmith;
```

### Schema Migration Issues

```bash
# Reset and rerun (WARNING: destroys all data)
dropdb -h localhost -U postgres agentsmith
createdb -h localhost -U postgres -O agentsmith agentsmith
psql -h localhost -U agentsmith -d agentsmith -f docker/init-db.sql
```

## Redis Setup

AgentSmith also requires Redis for queues and caching:

**Docker:**
```bash
docker-compose up -d redis
```

**Manual:**
```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis-server

# macOS
brew install redis
brew services start redis
```

**Verify:**
```bash
redis-cli ping  # Should return PONG
```

## Next Steps

1. ✅ Database is set up
2. Configure `.env` with production values
3. Start the application: `npm run dev` or `docker-compose up`
4. Access the UI at http://localhost:3000
5. Login with admin@agentsmith.local / admin123
6. Change the admin password immediately!
