import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  MoreVertical,
  Play,
  Pause,
  Copy,
  Trash2,
  Workflow,
  Loader2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toaster';
import { workflowApi } from '../lib/api';
import { formatRelativeTime } from '../lib/utils';
import type { IWorkflowListItem } from '@agentsmith/shared';

export function WorkflowsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['workflows', search],
    queryFn: () => workflowApi.list({ search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => workflowApi.create({ name }),
    onSuccess: (response) => {
      if (response.success && response.data) {
        queryClient.invalidateQueries({ queryKey: ['workflows'] });
        navigate(`/workflows/${(response.data as any).id}`);
        toast({ title: 'Workflow created', type: 'success' });
      }
    },
    onError: () => {
      toast({ title: 'Failed to create workflow', type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({ title: 'Workflow deleted', type: 'success' });
    },
    onError: () => {
      toast({ title: 'Failed to delete workflow', type: 'error' });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => workflowApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({ title: 'Workflow activated', type: 'success' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => workflowApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({ title: 'Workflow deactivated', type: 'success' });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => workflowApi.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({ title: 'Workflow duplicated', type: 'success' });
    },
  });

  const handleCreateWorkflow = () => {
    createMutation.mutate('New Workflow');
  };

  const workflows: IWorkflowListItem[] = (data as any)?.data || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'error':
        return <Badge variant="error">Error</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">
            Create and manage your automated workflows
          </p>
        </div>
        <Button onClick={handleCreateWorkflow} disabled={createMutation.isPending}>
          {createMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          New Workflow
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search workflows..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Workflow list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Workflow className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first workflow to get started
            </p>
            <Button onClick={handleCreateWorkflow}>
              <Plus className="w-4 h-4 mr-2" />
              Create Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <Link
                    to={`/workflows/${workflow.id}`}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="font-medium truncate hover:text-primary transition-colors">
                      {workflow.name}
                    </h3>
                    {workflow.description && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {workflow.description}
                      </p>
                    )}
                  </Link>
                  <div className="flex items-center gap-1 ml-2">
                    {getStatusBadge(workflow.status)}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{workflow.nodeCount} nodes</span>
                  <span>{formatRelativeTime(workflow.updatedAt)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                  {workflow.status === 'active' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deactivateMutation.mutate(workflow.id)}
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => activateMutation.mutate(workflow.id)}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Activate
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => duplicateMutation.mutate(workflow.id)}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this workflow?')) {
                        deleteMutation.mutate(workflow.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
