import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Square,
  RotateCcw,
  Trash2,
  ChevronRight,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toaster';
import { executionApi } from '../lib/api';
import { formatRelativeTime, formatDuration } from '../lib/utils';
import type { IExecutionListItem, IExecutionStats } from '@agentsmith/shared';

export function ExecutionsPage() {
  const queryClient = useQueryClient();
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);

  const { data: executionsData, isLoading } = useQuery({
    queryKey: ['executions'],
    queryFn: () => executionApi.list({ perPage: 50 }),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: statsData } = useQuery({
    queryKey: ['executions-stats'],
    queryFn: () => executionApi.stats(),
    refetchInterval: 10000,
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => executionApi.stop(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      toast({ title: 'Execution stopped', type: 'success' });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => executionApi.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      toast({ title: 'Execution retried', type: 'success' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => executionApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      toast({ title: 'Execution deleted', type: 'success' });
    },
  });

  const executions: IExecutionListItem[] = (executionsData as any)?.data || [];
  const stats: IExecutionStats = (statsData as any)?.data || {
    total: 0,
    success: 0,
    failed: 0,
    running: 0,
    pending: 0,
    cancelled: 0,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'cancelled':
        return <Square className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="success">Success</Badge>;
      case 'failed':
        return <Badge variant="error">Failed</Badge>;
      case 'running':
        return <Badge variant="default">Running</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Executions</h1>
        <p className="text-muted-foreground">
          Monitor and manage workflow executions
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
            <div className="text-sm text-muted-foreground">Success</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
            <div className="text-sm text-muted-foreground">Running</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
      </div>

      {/* Executions list */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No executions yet
            </div>
          ) : (
            <div className="space-y-2">
              {executions.map((execution) => (
                <div
                  key={execution.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(execution.status)}
                    <div>
                      <div className="font-medium">{execution.workflowName}</div>
                      <div className="text-sm text-muted-foreground">
                        {execution.id} &bull; {formatRelativeTime(execution.startedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {getStatusBadge(execution.status)}

                    {execution.finishedAt && (
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(
                          new Date(execution.finishedAt).getTime() -
                            new Date(execution.startedAt).getTime()
                        )}
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      {execution.status === 'running' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => stopMutation.mutate(execution.id)}
                        >
                          <Square className="w-4 h-4" />
                        </Button>
                      )}
                      {execution.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => retryMutation.mutate(execution.id)}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(execution.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
