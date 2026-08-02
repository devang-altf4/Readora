import { create } from 'zustand';

interface LibraryState {
  searchQuery: string;
  viewMode: 'grid' | 'list';
  sortBy: 'lastOpenedAt' | 'title' | 'readingProgress';
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sort: 'lastOpenedAt' | 'title' | 'readingProgress') => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  searchQuery: '',
  viewMode: 'grid',
  sortBy: 'lastOpenedAt',
  setSearchQuery: (query) => set({ searchQuery: query }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (sort) => set({ sortBy: sort }),
}));
