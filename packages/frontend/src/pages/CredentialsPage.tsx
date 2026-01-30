import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Key, Trash2, Edit, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toaster';
import { credentialApi } from '../lib/api';
import { formatRelativeTime } from '../lib/utils';

interface Credential {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export function CredentialsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['credentials', search],
    queryFn: () => credentialApi.list({ search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => credentialApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast({ title: 'Credential deleted', type: 'success' });
    },
    onError: () => {
      toast({ title: 'Failed to delete credential', type: 'error' });
    },
  });

  const credentials: Credential[] = (data as any)?.data || [];

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      httpBasicAuth: 'HTTP Basic Auth',
      httpHeaderAuth: 'HTTP Header Auth',
      oAuth2Api: 'OAuth 2.0',
      openAiApi: 'OpenAI API',
      anthropicApi: 'Anthropic API',
      slackApi: 'Slack API',
      githubApi: 'GitHub API',
      postgres: 'PostgreSQL',
    };
    return labels[type] || type;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Credentials</h1>
          <p className="text-muted-foreground">
            Manage your API keys and authentication credentials
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Credential
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search credentials..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Credentials list */}
      <Card>
        <CardHeader>
          <CardTitle>All Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : credentials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Key className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No credentials yet</h3>
              <p className="text-muted-foreground mb-4">
                Add credentials to connect your workflows to external services
              </p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Credential
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {credentials.map((credential) => (
                <div
                  key={credential.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{credential.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {getTypeLabel(credential.type)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      Updated {formatRelativeTime(credential.updatedAt)}
                    </span>

                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this credential?')) {
                            deleteMutation.mutate(credential.id);
                          }
                        }}
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
