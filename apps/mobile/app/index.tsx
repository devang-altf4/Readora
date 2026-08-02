import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BookSQLiteRepository } from '../src/database/repositories/bookRepository';
import { getBookExtension, importBook } from '../src/services/importService';
import { LocalBook } from '../src/types';
import { useLibraryStore } from '../src/state/useLibraryStore';
import { useAppColors } from '../src/theme/useAppColors';
import { useThemeStore } from '../src/state/useThemeStore';
import { BookCoverCard } from '../src/components/BookCoverCard';

export default function LibraryScreen() {
  const db = useSQLiteContext();
  const repo = new BookSQLiteRepository(db);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { themeMode, setThemeMode } = useThemeStore();

  const [books, setBooks] = useState<LocalBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'library' | 'settings'>('home');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeFilter, setActiveFilter] = useState<string>('Best Sellers');

  const { searchQuery, setSearchQuery, viewMode, setViewMode, sortBy } = useLibraryStore();

  const loadBooks = async () => {
    try {
      setLoading(true);
      const data = await repo.getAllBooks(sortBy, 'DESC');
      setBooks(data);

      // Resolve missing covers from backend (covers are generated asynchronously)
      const { apiClient } = require('../src/services/apiClient');
      const { API_CONFIG } = require('../src/constants/config');
      const booksNeedingCover = data.filter((b: LocalBook) => !b.coverUri && b.backendBookId);
      if (booksNeedingCover.length > 0) {
        let anyUpdated = false;
        for (const b of booksNeedingCover) {
          try {
            await apiClient.get(`/books/${b.backendBookId}/cover`, {
              responseType: 'arraybuffer',
              timeout: 3000,
            });
            const coverUrl = `${API_CONFIG.baseUrl}/books/${b.backendBookId}/cover`;
            await repo.updateCoverUri(b.id, coverUrl);
            anyUpdated = true;
          } catch {
            // Cover not ready yet or not available
          }
        }
        if (anyUpdated) {
          const refreshed = await repo.getAllBooks(sortBy, 'DESC');
          setBooks(refreshed);
        }
      }
    } catch (e) {
      console.error('Error loading books:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, [sortBy]);

  const handleImport = async () => {
    try {
      setImporting(true);
      const importedBook = await importBook(repo);
      if (importedBook) {
        await loadBooks();
        const isOfflinePdf = getBookExtension(importedBook.originalFileName) === 'pdf' && !importedBook.backendBookId;
        router.push(isOfflinePdf ? `/reader/pdf/${importedBook.id}` : `/reader/smart/${importedBook.id}`);
      }
    } catch (e: any) {
      Alert.alert('Import Failed', e.message || 'Could not import this book.');
    } finally {
      setImporting(false);
    }
  };

  const filteredBooks = books.filter((b) =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderBookItem = ({ item }: { item: LocalBook }) => {
    const progressPct = Math.round(item.readingProgress || 0);
    const isNew = !item.readingProgress || item.readingProgress === 0;

    return (
      <TouchableOpacity
        style={[
          viewMode === 'grid' ? styles.gridCard : styles.listCard,
          { backgroundColor: colors.cardBg, borderColor: colors.divider }
        ]}
        activeOpacity={0.8}
        onPress={() => {
          const isOfflinePdf = getBookExtension(item.originalFileName) === 'pdf' && !item.backendBookId;
          router.push(isOfflinePdf ? `/reader/pdf/${item.id}` : `/reader/smart/${item.id}`);
        }}
      >
        <BookCoverCard
          title={item.title}
          author={item.author}
          coverUri={item.coverUri}
          height={viewMode === 'grid' ? 190 : 130}
          width={viewMode === 'grid' ? '100%' : 95}
          progressPct={progressPct}
          isNew={isNew}
        />

        <View style={styles.bookInfo}>
          <View style={styles.bookHeaderRow}>
            <Text style={[styles.bookTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.title}
            </Text>
            <TouchableOpacity onPress={() => router.push(`/book/${item.id}`)}>
              <Text style={[styles.threeDots, { color: colors.textSecondary }]}>⋮</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.bookAuthor, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.author || 'Readora Book'}
          </Text>

          <View style={styles.progressContainer}>
            <View style={[styles.trackBar, { backgroundColor: colors.divider }]}>
              <View style={[styles.fillBar, { width: `${item.readingProgress}%`, backgroundColor: colors.accent }]} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />

      {/* Official Readora Top Search Bar Row */}
      <View style={styles.kindleHeaderRow}>
        <View style={[styles.kindleSearchPill, { backgroundColor: colors.searchBg, borderColor: colors.searchBorder }]}>
          <Text style={styles.searchIconText}>🔍</Text>
          <TextInput
            style={[styles.kindleSearchInput, { color: colors.textPrimary }]}
            placeholder="Search Readora"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Light / Dark Mode Quick Toggle */}
        <TouchableOpacity
          style={[styles.themeToggleBtn, { backgroundColor: colors.searchBg, borderColor: colors.searchBorder }]}
          onPress={() => setThemeMode(colors.isDark ? 'light' : 'dark')}
        >
          <Text style={{ fontSize: 16 }}>{colors.isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      {/* Primary Categories Scroll Bar */}
      <View style={styles.categoryScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScrollContent}>
          {['Explore', 'All', 'Readora Unlimited', 'Prime Reading'].map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isActive ? colors.chipActiveBg : colors.chipBg,
                    borderColor: isActive ? colors.chipActiveBorder : colors.searchBorder,
                  }
                ]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[
                  styles.categoryPillText,
                  { color: isActive ? '#FFFFFF' : colors.textPrimary }
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {activeTab === 'settings' ? (
        <ScrollView style={styles.settingsContainer} contentContainerStyle={styles.settingsContent}>
          <Text style={[styles.settingsTitle, { color: colors.textPrimary }]}>Appearance Settings</Text>
          <View style={[styles.settingCard, { backgroundColor: colors.cardBg, borderColor: colors.divider }]}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Theme Mode</Text>
            <View style={styles.themeOptionsRow}>
              <TouchableOpacity
                style={[
                  styles.themeOptionBtn,
                  {
                    backgroundColor: colors.isDark ? '#3B82F6' : '#EAE7DC',
                    borderColor: colors.isDark ? '#3B82F6' : '#D8D3C4',
                  },
                  colors.isDark && styles.activeThemeBtn
                ]}
                onPress={() => setThemeMode('dark')}
              >
                <Text style={[
                  styles.themeOptionText,
                  { color: colors.isDark ? '#FFFFFF' : '#171717' }
                ]}>
                  Dark Mode (E-Ink)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOptionBtn,
                  {
                    backgroundColor: !colors.isDark ? '#171717' : '#1C1C1E',
                    borderColor: !colors.isDark ? '#171717' : '#2C2C2E',
                  },
                  !colors.isDark && styles.activeThemeBtn
                ]}
                onPress={() => setThemeMode('light')}
              >
                <Text style={[
                  styles.themeOptionText,
                  { color: !colors.isDark ? '#FFFFFF' : '#A1A1A6' }
                ]}>
                  Light Mode (Paperwhite Vellum)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.mainScrollView} contentContainerStyle={styles.mainScrollContent}>
          {/* Welcome to Readora Greeting Banner */}
          <View style={[styles.welcomeCard, { backgroundColor: colors.welcomeBannerBg }]}>
            <Text style={[styles.accentDecoration, { color: colors.isDark ? '#3B82F6' : '#5F635F' }]}>
              ▼  ▲  ▼  ▲  ▼  ▲  ▼
            </Text>
            <Text style={[styles.welcomeTitle, { color: colors.welcomeBannerText }]}>
              Welcome to Readora
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.welcomeBannerSubtext }]}>
              Discover a quiet reading experience in reflowable Readora Smart Mode.
            </Text>
          </View>

          {/* Secondary Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.secondaryFilterContainer} contentContainerStyle={styles.categoryScrollContent}>
            {['Best Sellers', 'Romance', 'Literature & Fiction', 'Sci-Fi & Fantasy'].map((filter) => {
              const isActive = activeFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.secondaryPill,
                    {
                      backgroundColor: isActive ? (colors.isDark ? '#3B82F6' : colors.chipActiveBg) : colors.chipBg,
                      borderColor: isActive ? (colors.isDark ? '#3B82F6' : colors.chipActiveBorder) : colors.searchBorder,
                    }
                  ]}
                  onPress={() => setActiveFilter(filter)}
                >
                  <Text style={[
                    styles.secondaryPillText,
                    { color: isActive ? '#FFFFFF' : colors.textPrimary }
                  ]}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Your Library Header Row */}
          <View style={styles.libraryActionRow}>
            <Text style={[styles.librarySectionTitle, { color: colors.textPrimary }]}>Your Library</Text>

            <View style={styles.libraryControlsRight}>
              <TouchableOpacity
                style={[styles.importPillButton, { backgroundColor: colors.isDark ? '#1C1C1E' : '#EAE7DC', borderColor: colors.isDark ? '#3B82F6' : '#171717' }]}
                onPress={handleImport}
                disabled={importing}
              >
                {importing ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Text style={[styles.importPillText, { color: colors.isDark ? '#3B82F6' : colors.textPrimary }]}>
                    + Import Book
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleViewBtn}
                onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                <Text style={[styles.toggleViewText, { color: colors.textPrimary }]}>
                  {viewMode === 'grid' ? '≡ List' : '☷ Grid'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Books List or Empty State */}
          {loading ? (
            <ActivityIndicator size="large" color={colors.textPrimary} style={{ marginTop: 40 }} />
          ) : filteredBooks.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>No Books Found</Text>
              <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>
                Import PDF, EPUB, Kindle, HTML, TXT, or DOCX books to start reading.
              </Text>
              <TouchableOpacity style={styles.emptyImportBtn} onPress={handleImport}>
                <Text style={styles.emptyImportBtnText}>📖 Import Book</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredBooks}
              keyExtractor={(item) => item.id}
              renderItem={renderBookItem}
              key={viewMode}
              numColumns={viewMode === 'grid' ? 2 : 1}
              scrollEnabled={false}
              contentContainerStyle={styles.bookListContent}
            />
          )}
        </ScrollView>
      )}

      {/* Official Readora Bottom Tab Navigation Bar */}
      <View style={[styles.bottomTabBar, { backgroundColor: colors.bottomBarBg, borderColor: colors.divider }]}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('home')}
        >
          <Text style={{ fontSize: 20 }}>🏠</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'home' ? colors.accent : colors.textSecondary }]}>
            HOME
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('library')}
        >
          <Text style={{ fontSize: 20 }}>📖</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'library' ? colors.accent : colors.textSecondary }]}>
            LIBRARY
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={{ fontSize: 20 }}>⚙️</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'settings' ? colors.accent : colors.textSecondary }]}>
            MORE
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  kindleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10,
  },
  kindleSearchPill: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  searchIconText: {
    fontSize: 16,
    marginRight: 8,
  },
  kindleSearchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  themeToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  categoryScrollContainer: {
    marginBottom: 4,
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  welcomeCard: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 12,
  },
  accentDecoration: {
    fontSize: 10,
    letterSpacing: 6,
    marginBottom: 10,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Playfair Display',
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },
  secondaryFilterContainer: {
    marginVertical: 8,
  },
  secondaryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  libraryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  librarySectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Playfair Display',
  },
  libraryControlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  importPillButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  importPillText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  toggleViewBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  toggleViewText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bookListContent: {
    gap: 12,
  },
  gridCard: {
    flex: 0.5,
    margin: 6,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  listCard: {
    width: '100%',
    flexDirection: 'row',
    marginVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  bookInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  bookHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  threeDots: {
    fontSize: 16,
    paddingLeft: 6,
  },
  bookAuthor: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  progressContainer: {
    marginTop: 4,
  },
  trackBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fillBar: {
    height: '100%',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  emptyImportBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyImportBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  settingsContainer: {
    flex: 1,
  },
  settingsContent: {
    padding: 20,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  themeOptionsRow: {
    gap: 10,
  },
  themeOptionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  activeThemeBtn: {
    borderWidth: 2,
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    borderTopWidth: 1,
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
});
