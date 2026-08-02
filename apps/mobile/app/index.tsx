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
import { BackendBookResponse, LocalBook } from '../src/types';
import { useLibraryStore } from '../src/state/useLibraryStore';
import { useAppColors } from '../src/theme/useAppColors';
import { useThemeStore } from '../src/state/useThemeStore';
import { BookCoverCard } from '../src/components/BookCoverCard';
import { useAuthStore } from '../src/state/useAuthStore';
import {
  addCatalogBook,
  getCatalogCoverUrl,
  listCatalogBooks,
  STARTER_CATALOG_BOOKS,
} from '../src/services/catalogService';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

function getCatalogIdFromLocalBookId(localBookId: string): string | null {
  return (
    STARTER_CATALOG_BOOKS.find(
      (catalogBook) =>
        catalogBook.catalogId && localBookId.endsWith(`-${catalogBook.catalogId}`),
    )?.catalogId ?? null
  );
}

export default function LibraryScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const repo = new BookSQLiteRepository(db, user?.id || '');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { themeMode, setThemeMode } = useThemeStore();

  const [books, setBooks] = useState<LocalBook[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<BackendBookResponse[]>(STARTER_CATALOG_BOOKS);
  const [addingCatalogId, setAddingCatalogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'library' | 'settings'>('home');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeFilter, setActiveFilter] = useState<string>('Best Sellers');
  const importPromptProgress = useSharedValue(0);

  const importPromptAnimation = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(importPromptProgress.value, [0, 1], [0, -3]) }],
  }));

  const importArrowAnimation = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(importPromptProgress.value, [0, 1], [0, 5]) }],
    opacity: interpolate(importPromptProgress.value, [0, 1], [0.65, 1]),
  }));

  const { searchQuery, setSearchQuery, viewMode, setViewMode, sortBy } = useLibraryStore();

  const loadBooks = async () => {
    try {
      setLoading(true);
      const data = await repo.getAllBooks(sortBy, 'DESC');
      setBooks(data);

      // Catalog copies use a public shared-cover URL. Unlike private user books,
      // React Native's Image cannot attach the user's bearer token to an image
      // request, so catalog artwork must not use the protected /books/{id}/cover URL.
      const { apiClient } = require('../src/services/apiClient');
      const { API_CONFIG } = require('../src/constants/config');
      let anyUpdated = false;
      for (const b of data) {
        const catalogId = getCatalogIdFromLocalBookId(b.id);
        if (catalogId) {
          const catalogCoverUrl = getCatalogCoverUrl(catalogId);
          if (b.coverUri !== catalogCoverUrl) {
            await repo.updateCoverUri(b.id, catalogCoverUrl);
            anyUpdated = true;
          }
          continue;
        }

        if (!b.coverUri && b.backendBookId) {
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
      }
      if (anyUpdated) {
        const refreshed = await repo.getAllBooks(sortBy, 'DESC');
        setBooks(refreshed);
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

  useEffect(() => {
    importPromptProgress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(importPromptProgress);
  }, [importPromptProgress]);

  useEffect(() => {
    let active = true;
    listCatalogBooks()
      .then((data) => {
        if (active) setCatalogBooks(data);
      })
      .catch((error) => {
        console.warn('Starter catalog unavailable:', error);
        setCatalogBooks(STARTER_CATALOG_BOOKS);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAddCatalogBook = async (catalogBook: BackendBookResponse) => {
    const catalogId = catalogBook.catalogId;
    if (!catalogId || addingCatalogId) return;

    const localCatalogId = `catalog-${user?.id || 'user'}-${catalogId}`;
    const existingLocal = books.find((book) => book.id === localCatalogId);
    if (existingLocal) {
      router.push(`/reader/smart/${existingLocal.id}`);
      return;
    }

    try {
      setAddingCatalogId(catalogId);
      const backendBook = await addCatalogBook(catalogId);
      const now = new Date().toISOString();
      const localBook: LocalBook = {
        id: localCatalogId,
        localFileUri: '',
        originalFileName: backendBook.originalFilename,
        title: backendBook.title || catalogBook.title || 'Untitled Book',
        author: backendBook.author || catalogBook.author || null,
        coverUri: getCatalogCoverUrl(catalogId),
        fileSize: backendBook.fileSize || 0,
        fileHash: backendBook.fileHash || null,
        totalPages: backendBook.pageCount || 1,
        currentPage: 1,
        readingProgress: 0,
        lastOpenedAt: null,
        importedAt: now,
        updatedAt: now,
        backendBookId: backendBook._id,
        backendProcessingStatus: (backendBook.processingStatus || 'ready') as LocalBook['backendProcessingStatus'],
        backendProcessingProgress: backendBook.processingProgress ?? 100,
        smartModeAvailable: backendBook.processingStatus === 'ready' || backendBook.processingStatus === 'ocr_required',
        cachedSmartContentUri: null,
      };
      await repo.insertBook(localBook);
      await loadBooks();
      setActiveTab('library');
      Alert.alert('Added to Library', `${localBook.title} is ready to read.`);
    } catch (error: any) {
      Alert.alert('Could Not Add Book', error?.message || 'Please try again.');
    } finally {
      setAddingCatalogId(null);
    }
  };

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
          <View style={[styles.settingCard, { backgroundColor: colors.cardBg, borderColor: colors.divider }]}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Account</Text>
            <Text style={[styles.accountText, { color: colors.textSecondary }]}>{user?.username}</Text>
            <TouchableOpacity
              style={[styles.logoutButton, { borderColor: colors.divider }]}
              onPress={() => void logout()}
            >
              <Text style={[styles.logoutButtonText, { color: colors.textPrimary }]}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : activeTab === 'library' ? (
        <ScrollView style={styles.mainScrollView} contentContainerStyle={styles.mainScrollContent}>
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
              <TouchableOpacity style={[styles.emptyImportBtn, { backgroundColor: colors.accent }]} onPress={handleImport}>
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
      ) : (
        <ScrollView style={styles.mainScrollView} contentContainerStyle={styles.mainScrollContent}>
          {/* Stitch MCP Generated Flashy Hero Welcome Card */}
          <View style={[
            styles.stitchHeroCard,
            {
              backgroundColor: colors.isDark ? '#0C0A19' : '#F4ECE1',
              borderColor: colors.isDark ? 'rgba(139, 92, 246, 0.35)' : '#D6C8B4',
            }
          ]}>
            {/* Ambient Mesh Glow Accent Layers */}
            <View style={[styles.stitchMeshGlowTop, { backgroundColor: colors.isDark ? '#6366F125' : '#D4A37330' }]} />
            <View style={[styles.stitchMeshGlowBottom, { backgroundColor: colors.isDark ? '#8B5CF620' : '#C49A4520' }]} />

            <View style={styles.stitchCardContent}>
              {/* Logo Row */}
              <View style={styles.stitchLogoHeaderRow}>
                <View style={[styles.stitchLogoBadge, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={styles.stitchLogoEmoji}>📖</Text>
                </View>
                <View style={[styles.stitchSanctuaryTag, { backgroundColor: colors.isDark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(196, 154, 69, 0.15)' }]}>
                  <Text style={[styles.stitchSanctuaryText, { color: colors.isDark ? '#A5B4FC' : '#855B14' }]}>
                    DIGITAL SANCTUARY
                  </Text>
                </View>
              </View>

              {/* Title & Tagline */}
              <Text style={[styles.stitchHeroTitle, { color: colors.isDark ? '#FFFFFF' : '#1C1917' }]}>
                Welcome to Readora
              </Text>
              <Text style={[styles.stitchHeroSubtitle, { color: colors.isDark ? '#CBD5E1' : '#57534E' }]}>
                Your Sanctuary for Quiet, Distraction-Free Reading
              </Text>

              {/* Action Button */}
              <TouchableOpacity
                style={[
                  styles.stitchStartBtn,
                  {
                    backgroundColor: colors.isDark ? '#FFFFFF' : '#171717',
                    shadowColor: colors.isDark ? '#6366F1' : '#000000',
                  }
                ]}
                activeOpacity={0.85}
                onPress={handleImport}
              >
                <Text style={[styles.stitchStartBtnText, { color: colors.isDark ? '#0F172A' : '#FFFFFF' }]}>
                  Start Reading ✨
                </Text>
              </TouchableOpacity>
            </View>
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

          <Animated.View
            style={[
              styles.importPromptCard,
              {
                backgroundColor: colors.isDark ? '#11152B' : '#F4ECE1',
                borderColor: colors.isDark ? '#3B82F6' : '#C49A45',
              },
              importPromptAnimation,
            ]}
          >
            <View style={styles.importPromptCopy}>
              <Text style={[styles.importPromptEyebrow, { color: colors.isDark ? '#3B82F6' : '#855B14' }]}>YOUR BOOK, YOUR SANCTUARY</Text>
              <Text style={[styles.importPromptTitle, { color: colors.textPrimary }]}>Want to read your own book?</Text>
              <Text style={[styles.importPromptSubtitle, { color: colors.textSecondary }]}>Tap Import Book to bring a PDF, EPUB, Kindle file, or any supported format into Readora.</Text>
            </View>
            <TouchableOpacity
              style={[styles.importPromptButton, { backgroundColor: colors.accent }]}
              onPress={handleImport}
              disabled={importing}
              activeOpacity={0.82}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.importPromptButtonText}>Import Book</Text>
                  <Animated.Text style={[styles.importPromptArrow, importArrowAnimation]}>→</Animated.Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {catalogBooks.length > 0 && (
            <View style={styles.catalogSection}>
              <View style={styles.catalogHeaderRow}>
                <Text style={[styles.librarySectionTitle, { color: colors.textPrimary }]}>Starter Library</Text>
                <Text style={[styles.catalogHint, { color: colors.textSecondary }]}>Free for everyone</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catalogScrollContent}
              >
                {catalogBooks.map((catalogBook) => {
                  const alreadyAdded = Boolean(
                    user?.id &&
                    catalogBook.catalogId &&
                    books.some((book) => book.id === `catalog-${user.id}-${catalogBook.catalogId}`)
                  );
                  const isAdding = addingCatalogId === catalogBook.catalogId;
                  return (
                    <View key={catalogBook.catalogId || catalogBook._id} style={[styles.catalogCard, { backgroundColor: colors.cardBg, borderColor: colors.divider }]}>
                      <BookCoverCard
                        title={catalogBook.title || 'Untitled Book'}
                        author={catalogBook.author}
                        coverUri={catalogBook.catalogId ? getCatalogCoverUrl(catalogBook.catalogId) : null}
                        height={165}
                        width="100%"
                        isNew={!alreadyAdded}
                      />
                      <View style={styles.catalogCardDetails}>
                        <View>
                          <Text style={[styles.catalogTitle, { color: colors.textPrimary }]} numberOfLines={2}>{catalogBook.title}</Text>
                          <Text style={[styles.catalogAuthor, { color: colors.textSecondary }]} numberOfLines={1}>{catalogBook.author || 'Readora Book'}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.catalogAddButton, { backgroundColor: alreadyAdded ? colors.divider : colors.accent }]}
                          disabled={alreadyAdded || isAdding}
                          onPress={() => void handleAddCatalogBook(catalogBook)}
                        >
                          {isAdding ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.catalogAddButtonText}>{alreadyAdded ? 'In Library' : 'Add to Library'}</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
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
  stitchHeroCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    marginVertical: 14,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5,
  },
  stitchMeshGlowTop: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  stitchMeshGlowBottom: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  stitchCardContent: {
    padding: 22,
    gap: 10,
  },
  stitchLogoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stitchLogoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchLogoEmoji: {
    fontSize: 22,
  },
  stitchSanctuaryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stitchSanctuaryText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stitchHeroTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    fontFamily: 'Playfair Display',
    letterSpacing: -0.3,
  },
  stitchHeroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  stitchStartBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  stitchStartBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
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
  importPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
    marginBottom: 14,
  },
  importPromptCopy: {
    flex: 1,
    gap: 3,
  },
  importPromptEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  importPromptTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  importPromptSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  importPromptButton: {
    minWidth: 104,
    minHeight: 42,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  importPromptButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  importPromptArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  catalogSection: {
    marginTop: 14,
  },
  catalogHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  catalogHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  catalogScrollContent: {
    gap: 12,
    paddingRight: 16,
    paddingVertical: 4,
  },
  catalogCard: {
    width: 145,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  catalogCardDetails: {
    flex: 1,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  catalogTitle: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    minHeight: 32,
  },
  catalogAuthor: {
    fontSize: 10,
    marginTop: 2,
    marginBottom: 8,
  },
  catalogAddButton: {
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  catalogAddButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
    marginBottom: 14,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  accountText: {
    fontSize: 14,
    marginBottom: 12,
  },
  logoutButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
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
