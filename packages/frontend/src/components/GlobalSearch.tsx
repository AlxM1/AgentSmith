// Global Search Component (Cmd+K)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Workflow,
  Key,
  Play,
  User,
  Settings,
  Clock,
  ArrowRight,
  Command,
  X,
  Star,
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useFavoritesStore } from '../stores/favoritesStore';

interface SearchResult {
  id: string;
  type: 'workflow' | 'execution' | 'credential' | 'user' | 'page';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  url: string;
  isFavorite?: boolean;
}

const pageResults: SearchResult[] = [
  { id: 'page-workflows', type: 'page', title: 'Workflows', subtitle: 'Manage your workflows', icon: <Workflow className="w-4 h-4" />, url: '/workflows' },
  { id: 'page-executions', type: 'page', title: 'Executions', subtitle: 'View execution history', icon: <Play className="w-4 h-4" />, url: '/executions' },
  { id: 'page-credentials', type: 'page', title: 'Credentials', subtitle: 'Manage credentials', icon: <Key className="w-4 h-4" />, url: '/credentials' },
  { id: 'page-settings', type: 'page', title: 'Settings', subtitle: 'Account settings', icon: <Settings className="w-4 h-4" />, url: '/settings' },
];

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const favorites = useFavoritesStore(state => state.favorites);

  // Load recent searches
  useEffect(() => {
    const saved = localStorage.getItem('agentsmith-recent-searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      // Show pages and favorites when query is short
      const favoriteResults: SearchResult[] = favorites.slice(0, 5).map(f => ({
        id: f.id,
        type: 'workflow' as const,
        title: f.name,
        subtitle: 'Favorite workflow',
        icon: <Star className="w-4 h-4 text-yellow-500" />,
        url: `/workflows/${f.id}`,
        isFavorite: true
      }));
      setResults([...favoriteResults, ...pageResults]);
      return;
    }

    setLoading(true);
    try {
      // Search workflows
      const workflowsRes = await api.get(`/workflows?search=${encodeURIComponent(searchQuery)}&perPage=5`);
      const workflows = workflowsRes.data.data?.workflows || [];

      // Search executions
      const executionsRes = await api.get(`/executions?search=${encodeURIComponent(searchQuery)}&perPage=3`);
      const executions = executionsRes.data.data?.executions || [];

      // Search credentials
      const credentialsRes = await api.get(`/credentials?search=${encodeURIComponent(searchQuery)}&perPage=3`);
      const credentials = credentialsRes.data.data?.credentials || [];

      const searchResults: SearchResult[] = [
        // Workflows
        ...workflows.map((w: any) => ({
          id: w.id,
          type: 'workflow' as const,
          title: w.name,
          subtitle: w.description || `${w.nodes?.length || 0} nodes`,
          icon: <Workflow className="w-4 h-4 text-blue-500" />,
          url: `/workflows/${w.id}`,
          isFavorite: favorites.some(f => f.id === w.id)
        })),
        // Executions
        ...executions.map((e: any) => ({
          id: e.id,
          type: 'execution' as const,
          title: e.workflowName,
          subtitle: `Execution ${e.status} - ${new Date(e.startedAt).toLocaleString()}`,
          icon: <Play className="w-4 h-4 text-green-500" />,
          url: `/executions/${e.id}`
        })),
        // Credentials
        ...credentials.map((c: any) => ({
          id: c.id,
          type: 'credential' as const,
          title: c.name,
          subtitle: c.type,
          icon: <Key className="w-4 h-4 text-purple-500" />,
          url: `/credentials/${c.id}`
        })),
        // Filter matching pages
        ...pageResults.filter(p =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      ];

      setResults(searchResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, [favorites]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    // Save to recent searches
    if (query.length >= 2) {
      const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('agentsmith-recent-searches', JSON.stringify(updated));
    }

    navigate(result.url);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-start justify-center pt-[15vh] px-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search workflows, executions, credentials..."
              className="flex-1 bg-transparent text-gray-900 dark:text-white text-lg focus:outline-none placeholder-gray-400"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">esc</kbd>
              <span>to close</span>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto" />
              </div>
            ) : results.length > 0 ? (
              <ul className="py-2">
                {results.map((result, index) => (
                  <li key={result.id}>
                    <button
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        index === selectedIndex
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${
                        index === selectedIndex
                          ? 'bg-blue-100 dark:bg-blue-900'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        {result.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {result.title}
                          </span>
                          {result.isFavorite && (
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {result.subtitle && (
                          <span className="text-sm text-gray-500 truncate block">
                            {result.subtitle}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 capitalize">
                        {result.type}
                      </span>
                      <ArrowRight className={`w-4 h-4 transition-opacity ${
                        index === selectedIndex ? 'opacity-100 text-blue-500' : 'opacity-0'
                      }`} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : query.length >= 2 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No results found for "{query}"</p>
              </div>
            ) : null}

            {/* Recent Searches */}
            {!query && recentSearches.length > 0 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase">Recent Searches</span>
                  <button
                    onClick={() => {
                      setRecentSearches([]);
                      localStorage.removeItem('agentsmith-recent-searches');
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(search)}
                      className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <Clock className="w-3 h-3" />
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd>
                to select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Command className="w-3 h-3" />K to open
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
