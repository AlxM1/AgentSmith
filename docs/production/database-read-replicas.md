# Database Read Replicas Configuration Guide

This guide covers setting up and configuring PostgreSQL read replicas for AgentSmith to improve read performance and scalability.

## Overview

Read replicas allow you to scale database read operations horizontally by routing read queries to replica nodes while write operations go to the primary. This is essential for production environments with high read loads.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       AgentSmith Application                      │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Backend   │  │   Worker    │  │      Webhook Processor  │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                       │                │
│         └────────────────┼───────────────────────┘                │
│                          │                                        │
│              ┌───────────▼───────────┐                           │
│              │   Connection Router    │                           │
│              │  (Read/Write Split)    │                           │
│              └───────────┬───────────┘                           │
└──────────────────────────┼───────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
    ┌─────────────┐              ┌─────────────────┐
    │   Primary   │              │  Read Replicas  │
    │   (Write)   │──Replication─▶│   (Read Only)   │
    └─────────────┘              └─────────────────┘
                                        │
                           ┌────────────┼────────────┐
                           │            │            │
                           ▼            ▼            ▼
                      ┌────────┐  ┌────────┐  ┌────────┐
                      │Replica1│  │Replica2│  │Replica3│
                      └────────┘  └────────┘  └────────┘
```

## Kubernetes Helm Configuration

### Basic Read Replica Setup

```yaml
# values.yaml
postgresql:
  enabled: true
  architecture: replication  # Enable replication

  auth:
    postgresPassword: ${POSTGRES_ADMIN_PASSWORD}
    username: agentsmith
    password: ${POSTGRES_PASSWORD}
    database: agentsmith
    replicationUsername: replicator
    replicationPassword: ${REPLICATION_PASSWORD}

  primary:
    persistence:
      enabled: true
      size: 100Gi
      storageClass: gp3
    resources:
      requests:
        cpu: 500m
        memory: 1Gi
      limits:
        cpu: 2000m
        memory: 4Gi
    # Optimized for write operations
    configuration: |
      max_connections = 200
      shared_buffers = 1GB
      effective_cache_size = 3GB
      maintenance_work_mem = 256MB
      checkpoint_completion_target = 0.9
      wal_buffers = 16MB
      default_statistics_target = 100
      random_page_cost = 1.1
      effective_io_concurrency = 200
      work_mem = 5MB
      min_wal_size = 1GB
      max_wal_size = 4GB
      max_worker_processes = 4
      max_parallel_workers_per_gather = 2
      max_parallel_workers = 4
      max_parallel_maintenance_workers = 2
      # Replication settings
      wal_level = replica
      max_wal_senders = 10
      wal_keep_size = 1GB
      hot_standby = on

  readReplicas:
    replicaCount: 2
    persistence:
      enabled: true
      size: 100Gi
      storageClass: gp3
    resources:
      requests:
        cpu: 250m
        memory: 512Mi
      limits:
        cpu: 1000m
        memory: 2Gi
    # Optimized for read operations
    configuration: |
      max_connections = 400
      shared_buffers = 512MB
      effective_cache_size = 1536MB
      work_mem = 10MB
      hot_standby = on
      hot_standby_feedback = on
      max_standby_streaming_delay = 30s
      max_standby_archive_delay = 60s
```

## Application Configuration

### Connection String Format

```bash
# Primary (writes)
DATABASE_URL_PRIMARY=postgresql://agentsmith:password@postgresql-primary:5432/agentsmith

# Read Replicas (reads)
DATABASE_URL_REPLICA=postgresql://agentsmith:password@postgresql-read:5432/agentsmith
```

### Environment Variables

```yaml
# Kubernetes ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: agentsmith-db-config
data:
  # Primary connection for writes
  DATABASE_URL: postgresql://agentsmith:password@postgresql-primary:5432/agentsmith

  # Replica pool for reads
  DATABASE_REPLICA_URL: postgresql://agentsmith:password@postgresql-read:5432/agentsmith

  # Enable read/write splitting
  DATABASE_READ_REPLICA_ENABLED: "true"

  # Load balancing strategy (round-robin, least-connections, random)
  DATABASE_REPLICA_STRATEGY: "round-robin"

  # Connection pool sizes
  DATABASE_POOL_SIZE_PRIMARY: "20"
  DATABASE_POOL_SIZE_REPLICA: "40"
```

### Drizzle ORM Configuration

```typescript
// src/db/config.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Primary pool for writes
const primaryPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_SIZE_PRIMARY || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Replica pool for reads
const replicaPool = process.env.DATABASE_REPLICA_URL
  ? new Pool({
      connectionString: process.env.DATABASE_REPLICA_URL,
      max: parseInt(process.env.DATABASE_POOL_SIZE_REPLICA || '40'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

export const primaryDb = drizzle(primaryPool);
export const replicaDb = replicaPool ? drizzle(replicaPool) : primaryDb;

// Helper function for read/write routing
export function getDb(operation: 'read' | 'write' = 'read') {
  if (operation === 'write') {
    return primaryDb;
  }
  return replicaDb || primaryDb;
}
```

### Usage in Services

```typescript
// src/services/WorkflowService.ts
import { getDb, primaryDb, replicaDb } from '../db/config';
import { workflows } from '../db/schema';
import { eq } from 'drizzle-orm';

export class WorkflowService {
  // Write operations always use primary
  async createWorkflow(data: CreateWorkflowDto) {
    return primaryDb.insert(workflows).values(data).returning();
  }

  async updateWorkflow(id: string, data: UpdateWorkflowDto) {
    return primaryDb
      .update(workflows)
      .set(data)
      .where(eq(workflows.id, id))
      .returning();
  }

  async deleteWorkflow(id: string) {
    return primaryDb.delete(workflows).where(eq(workflows.id, id));
  }

  // Read operations use replica
  async getWorkflow(id: string) {
    return replicaDb
      .select()
      .from(workflows)
      .where(eq(workflows.id, id))
      .limit(1);
  }

  async listWorkflows(userId: string, options: ListOptions) {
    return replicaDb
      .select()
      .from(workflows)
      .where(eq(workflows.userId, userId))
      .orderBy(workflows.updatedAt)
      .limit(options.limit)
      .offset(options.offset);
  }

  // For operations requiring fresh data, use primary
  async getWorkflowForExecution(id: string) {
    // Use primary to avoid replication lag issues
    return primaryDb
      .select()
      .from(workflows)
      .where(eq(workflows.id, id))
      .limit(1);
  }
}
```

## Replication Lag Handling

### Monitor Replication Lag

```typescript
// src/services/DatabaseHealthService.ts
import { sql } from 'drizzle-orm';
import { primaryDb, replicaDb } from '../db/config';

export class DatabaseHealthService {
  // Check replication lag on replicas
  async getReplicationLag(): Promise<number> {
    const result = await replicaDb.execute(sql`
      SELECT
        EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) as lag_seconds
    `);
    return result.rows[0]?.lag_seconds || 0;
  }

  // Health check including replication status
  async checkHealth(): Promise<{
    primary: boolean;
    replica: boolean;
    replicationLagMs: number;
    isHealthy: boolean;
  }> {
    const maxAcceptableLagMs = 5000; // 5 seconds

    let primaryHealthy = false;
    let replicaHealthy = false;
    let lagMs = 0;

    try {
      await primaryDb.execute(sql`SELECT 1`);
      primaryHealthy = true;
    } catch (error) {
      console.error('Primary health check failed:', error);
    }

    try {
      await replicaDb.execute(sql`SELECT 1`);
      replicaHealthy = true;
      lagMs = (await this.getReplicationLag()) * 1000;
    } catch (error) {
      console.error('Replica health check failed:', error);
    }

    return {
      primary: primaryHealthy,
      replica: replicaHealthy,
      replicationLagMs: lagMs,
      isHealthy: primaryHealthy && replicaHealthy && lagMs < maxAcceptableLagMs,
    };
  }
}
```

### Automatic Fallback

```typescript
// src/db/ReplicaRouter.ts
import { primaryDb, replicaDb } from './config';

const MAX_ACCEPTABLE_LAG_MS = 5000;
let currentLagMs = 0;
let lastLagCheck = 0;
const LAG_CHECK_INTERVAL_MS = 10000;

async function checkLag(): Promise<number> {
  if (Date.now() - lastLagCheck < LAG_CHECK_INTERVAL_MS) {
    return currentLagMs;
  }

  try {
    const result = await replicaDb.execute(sql`
      SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) * 1000 as lag_ms
    `);
    currentLagMs = result.rows[0]?.lag_ms || 0;
    lastLagCheck = Date.now();
  } catch {
    currentLagMs = Infinity;
  }

  return currentLagMs;
}

export async function getReadDb() {
  const lag = await checkLag();

  if (lag > MAX_ACCEPTABLE_LAG_MS) {
    console.warn(`Replication lag too high (${lag}ms), falling back to primary`);
    return primaryDb;
  }

  return replicaDb || primaryDb;
}
```

## AWS RDS Read Replicas

### RDS Configuration

```yaml
# values-production.yaml for AWS RDS
externalDatabase:
  enabled: true
  host: agentsmith-primary.cluster-xxxx.us-east-1.rds.amazonaws.com
  port: 5432
  username: agentsmith
  database: agentsmith
  ssl: true
  sslMode: require

  # Read replica configuration
  readReplica:
    enabled: true
    host: agentsmith-replica.cluster-ro-xxxx.us-east-1.rds.amazonaws.com
    port: 5432
```

### RDS Terraform Configuration

```hcl
# terraform/rds.tf
resource "aws_rds_cluster" "agentsmith" {
  cluster_identifier     = "agentsmith"
  engine                 = "aurora-postgresql"
  engine_version         = "15.4"
  database_name          = "agentsmith"
  master_username        = "agentsmith"
  master_password        = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  storage_encrypted      = true
  kms_key_id            = aws_kms_key.rds.arn

  backup_retention_period = 35
  preferred_backup_window = "03:00-04:00"

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Environment = var.environment
    Application = "agentsmith"
  }
}

# Primary instance
resource "aws_rds_cluster_instance" "primary" {
  identifier           = "agentsmith-primary"
  cluster_identifier   = aws_rds_cluster.agentsmith.id
  instance_class       = "db.r6g.xlarge"
  engine               = aws_rds_cluster.agentsmith.engine

  performance_insights_enabled = true
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn
}

# Read replicas
resource "aws_rds_cluster_instance" "replicas" {
  count                = 2
  identifier           = "agentsmith-replica-${count.index + 1}"
  cluster_identifier   = aws_rds_cluster.agentsmith.id
  instance_class       = "db.r6g.large"
  engine               = aws_rds_cluster.agentsmith.engine

  performance_insights_enabled = true
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn
}

# Outputs
output "primary_endpoint" {
  value = aws_rds_cluster.agentsmith.endpoint
}

output "reader_endpoint" {
  value = aws_rds_cluster.agentsmith.reader_endpoint
}
```

## Monitoring

### Prometheus Metrics

```yaml
# prometheus/alerts/database-replication.yaml
groups:
  - name: database.replication
    rules:
      - alert: HighReplicationLag
        expr: pg_replication_lag_seconds > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL replication lag is high"
          description: "Replication lag is {{ $value }}s on {{ $labels.instance }}"

      - alert: CriticalReplicationLag
        expr: pg_replication_lag_seconds > 30
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL replication lag is critical"
          description: "Replication lag is {{ $value }}s - falling back to primary"

      - alert: ReplicaDown
        expr: pg_up{instance=~".*replica.*"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL read replica is down"
```

### Grafana Dashboard Queries

```promql
# Replication lag
pg_replication_lag_seconds{instance=~".*replica.*"}

# Connections per node
pg_stat_activity_count{datname="agentsmith"}

# Read vs Write queries
rate(pg_stat_statements_calls{query=~"SELECT.*"}[5m]) as reads
rate(pg_stat_statements_calls{query=~"INSERT|UPDATE|DELETE.*"}[5m]) as writes
```

## Best Practices

### 1. Query Routing Guidelines

| Operation Type | Use Primary | Use Replica |
|----------------|-------------|-------------|
| INSERT/UPDATE/DELETE | ✅ | ❌ |
| SELECT (dashboard lists) | ❌ | ✅ |
| SELECT (fresh data needed) | ✅ | ❌ |
| SELECT (reports/analytics) | ❌ | ✅ |
| Transactions | ✅ | ❌ |

### 2. Connection Pool Sizing

```
Primary connections = (num_workers * max_concurrent_writes) + overhead
Replica connections = (num_workers * max_concurrent_reads) / num_replicas
```

### 3. Handling Replication Lag

- Use primary for reads that require immediate consistency
- Set appropriate `max_standby_streaming_delay` based on query patterns
- Implement automatic fallback when lag exceeds threshold
- Monitor and alert on replication lag

### 4. Failover Planning

- Configure automatic failover in RDS/Cloud SQL
- Test failover procedures regularly
- Document manual failover steps
- Set up monitoring for failover events

## Troubleshooting

### Check Replication Status

```sql
-- On primary
SELECT
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  pg_wal_lsn_diff(sent_lsn, replay_lsn) as replication_lag_bytes
FROM pg_stat_replication;

-- On replica
SELECT
  pg_last_wal_receive_lsn() as received,
  pg_last_wal_replay_lsn() as replayed,
  pg_last_xact_replay_timestamp() as last_replay_time,
  now() - pg_last_xact_replay_timestamp() as lag;
```

### Common Issues

1. **High replication lag**: Check network bandwidth, replica resources, long-running queries on replica
2. **Replica disconnections**: Verify `wal_keep_size` is sufficient, check network stability
3. **Connection exhaustion**: Increase `max_connections` on replicas, use connection pooling

## Related Documentation

- [Database Backup Guide](./database-backups.md)
- [Performance Tuning](./performance-tuning.md)
- [High Availability Setup](./high-availability.md)
