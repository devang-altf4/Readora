import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BookSQLiteRepository } from '../src/database/repositories/bookRepository';
import { importPdfBook } from '../src/services/importService';
import { LocalBook } from '../src/types';
import { useLibraryStore } from '../src/state/useLibraryStore';
import { useAppColors } from '../src/theme/useAppColors';
import { useThemeStore } from '../src/state/useThemeStore';
import { API_CONFIG } from '../src/constants/config';

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
      const importedBook = await importPdfBook(repo);
      if (importedBook) {
        await loadBooks();
        if (importedBook.backendBookId) {
          router.push(`/reader/smart/${importedBook.id}`);
        } else {
          Alert.alert(
            'Smart Reader Unavailable',
            `The PDF was saved locally, but the phone could not reach ${API_CONFIG.baseUrl}. You can read the original PDF now and retry Smart Reader later.`,
            [
              { text: 'Stay in Library', style: 'cancel' },
              {
                text: 'Open Original PDF',
                onPress: () => router.push(`/reader/pdf/${importedBook.id}`),
              },
            ]
          );
        }
      }
    } catch (e: any) {
      Alert.alert('Import Failed', e.message || 'Could not import PDF.');
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
        onPress={() => router.push(`/reader/smart/${item.id}`)}
      >
        <View style={[styles.coverPlaceholder, { backgroundColor: colors.isDark ? '#2C2C2E' : '#EAE8E2' }]}>
          {item.coverUri ? (
            <Image source={{ uri: item.coverUri }} style={styles.coverImage} />
          ) : (
            <View style={styles.kindleDefaultCover}>
              <Text style={[styles.coverInitials, { color: colors.textPrimary }]}>
                {item.title.substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Kindle Badges */}
          {progressPct > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{progressPct}%</Text>
            </View>
          )}
          {isNew && (
            <View style={styles.newBadgeContainer}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>

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
            {item.author || 'Kindle Book'}
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

      {/* Official Amazon Kindle Top Search Bar Row */}
      <View style={styles.kindleHeaderRow}>
        <View style={[styles.kindleSearchPill, { backgroundColor: colors.searchBg, borderColor: colors.searchBorder }]}>
          <Text style={styles.searchIconText}>🔍</Text>
          <TextInput
            style={[styles.kindleSearchInput, { color: colors.textPrimary }]}
            placeholder="Search Kindle"
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
          {['Explore', 'All', 'Kindle Unlimited', 'Prime Reading'].map((cat) => {
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
                style={[styles.themeOptionBtn, colors.isDark && styles.activeThemeBtn]}
                onPress={() => setThemeMode('dark')}
              >
                <Text style={[styles.themeOptionText, { color: colors.isDark ? '#FFFFFF' : colors.textPrimary }]}>Dark Mode (E-Ink)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeOptionBtn, !colors.isDark && styles.activeThemeBtn]}
                onPress={() => setThemeMode('light')}
              >
                <Text style={[styles.themeOptionText, { color: !colors.isDark ? '#FFFFFF' : colors.textPrimary }]}>Light Mode (Paperwhite Vellum)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.mainScrollView} contentContainerStyle={styles.mainScrollContent}>
          {/* Welcome to Dindle Kindle Greeting Banner */}
          <View style={[styles.welcomeCard, { backgroundColor: colors.welcomeBannerBg }]}>
            <Text style={[styles.accentDecoration, { color: colors.isDark ? '#3B82F6' : '#5F635F' }]}>
              ▼  ▲  ▼  ▲  ▼  ▲  ▼
            </Text>
            <Text style={[styles.welcomeTitle, { color: colors.welcomeBannerText }]}>
              Welcome to Dindle
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.welcomeBannerSubtext }]}>
              Discover a quiet reading experience in reflowable Kindle Smart Mode.
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
                    + Import PDF
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
                Import a PDF book to start reading in Kindle Smart Mode.
              </Text>
              <TouchableOpacity style={styles.emptyImportBtn} onPress={handleImport}>
                <Text style={styles.emptyImportBtnText}>📖 Import PDF Book</Text>
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

      {/* Official Amazon Kindle Bottom Tab Navigation Bar */}
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
  coverPlaceholder: {
    height: 180,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  kindleDefaultCover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverInitials: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'Playfair Display',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  newBadgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bookInfo: {
    padding: 12,
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
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
  },
  activeThemeBtn: {
    borderWidth: 2,
    borderColor: '#3B82F6',
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
