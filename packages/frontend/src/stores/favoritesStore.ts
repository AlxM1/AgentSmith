// Favorites Store - Manage pinned/favorite workflows
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoriteWorkflow {
  id: string;
  name: string;
  addedAt: string;
}

interface FavoritesState {
  favorites: FavoriteWorkflow[];
  recentlyUsed: string[];
  maxRecent: number;

  addFavorite: (id: string, name: string) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string, name: string) => void;

  addRecentlyUsed: (id: string) => void;
  clearRecentlyUsed: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      recentlyUsed: [],
      maxRecent: 10,

      addFavorite: (id: string, name: string) => {
        const { favorites } = get();
        if (!favorites.some(f => f.id === id)) {
          set({
            favorites: [
              ...favorites,
              { id, name, addedAt: new Date().toISOString() }
            ]
          });
        }
      },

      removeFavorite: (id: string) => {
        const { favorites } = get();
        set({
          favorites: favorites.filter(f => f.id !== id)
        });
      },

      isFavorite: (id: string) => {
        return get().favorites.some(f => f.id === id);
      },

      toggleFavorite: (id: string, name: string) => {
        const { isFavorite, addFavorite, removeFavorite } = get();
        if (isFavorite(id)) {
          removeFavorite(id);
        } else {
          addFavorite(id, name);
        }
      },

      addRecentlyUsed: (id: string) => {
        const { recentlyUsed, maxRecent } = get();
        // Remove if exists and add to front
        const filtered = recentlyUsed.filter(r => r !== id);
        const updated = [id, ...filtered].slice(0, maxRecent);
        set({ recentlyUsed: updated });
      },

      clearRecentlyUsed: () => {
        set({ recentlyUsed: [] });
      },
    }),
    {
      name: 'agentsmith-favorites',
    }
  )
);

// React hook for favorites
export function useFavorites() {
  const store = useFavoritesStore();

  return {
    favorites: store.favorites,
    recentlyUsed: store.recentlyUsed,
    addFavorite: store.addFavorite,
    removeFavorite: store.removeFavorite,
    isFavorite: store.isFavorite,
    toggleFavorite: store.toggleFavorite,
    addRecentlyUsed: store.addRecentlyUsed,
    clearRecentlyUsed: store.clearRecentlyUsed,
  };
}

export default useFavoritesStore;
