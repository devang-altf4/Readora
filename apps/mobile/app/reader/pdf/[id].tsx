import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookSQLiteRepository } from '../../../src/database/repositories/bookRepository';
import { LocalBook } from '../../../src/types';
import { SERENE_LITHOS_TOKENS } from '../../../src/theme/tokens';

export default function OriginalPdfReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const repo = new BookSQLiteRepository(db);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [book, setBook] = useState<LocalBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    async function init() {
      if (!id) return;
      try {
        const data = await repo.getBookById(id);
        if (data) {
          setBook(data);
          setCurrentPage(data.currentPage || 1);
          setTotalPages(data.totalPages || 1);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id]);

  const toggleControls = () => {
    setControlsVisible(!controlsVisible);
  };

  const handleAddBookmark = async () => {
    if (!book) return;
    try {
      await repo.addBookmark({
        id: `${Date.now()}`,
        bookId: book.id,
        pageNumber: currentPage,
        createdAt: new Date().toISOString(),
      });
      Alert.alert('Bookmark Saved', `Page ${currentPage} bookmarked.`);
    } catch (e: any) {
      Alert.alert('Bookmark Error', e.message);
    }
  };

  if (loading || !book) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={SERENE_LITHOS_TOKENS.colors.primaryInk} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header Bar with Safe Area Top Inset */}
      {controlsVisible && (
        <View style={[
          styles.topHeader,
          {
            paddingTop: Math.max(insets.top, 12),
            height: 54 + Math.max(insets.top, 12),
          }
        ]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Text style={styles.navBtnText}>← Library</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {book.title}
          </Text>
          <TouchableOpacity onPress={handleAddBookmark} style={styles.navBtn}>
            <Text style={styles.navBtnText}>🔖</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PDF WebView */}
      <View style={styles.readerArea}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ uri: book.localFileUri }}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          style={styles.webview}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'TOGGLE_CONTROLS') {
                toggleControls();
              }
            } catch (e) {}
          }}
        />
      </View>

      {/* Bottom Progress Controls with Safe Area Bottom Inset */}
      {controlsVisible && (
        <View style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            height: 42 + Math.max(insets.bottom, 12),
          }
        ]}>
          <Text style={styles.progressText}>
            Page {currentPage} of {totalPages} ({Math.round((currentPage / (totalPages || 1)) * 100)}%)
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SERENE_LITHOS_TOKENS.colors.background,
  },
  topHeader: {
    backgroundColor: 'rgba(23, 23, 23, 0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  navBtn: {
    padding: 8,
  },
  navBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFF',
    fontSize: 14,
    fontFamily: SERENE_LITHOS_TOKENS.fonts.heading,
    marginHorizontal: 8,
  },
  readerArea: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  bottomBar: {
    backgroundColor: 'rgba(23, 23, 23, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  progressText: {
    color: '#D0D0D0',
    fontSize: 12,
    fontWeight: '500',
  },
});
