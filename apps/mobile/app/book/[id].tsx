import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Paths, File } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { BookSQLiteRepository } from '../../src/database/repositories/bookRepository';
import { LocalBook } from '../../src/types';
import { apiClient } from '../../src/services/apiClient';
import { useAppColors } from '../../src/theme/useAppColors';

export default function BookDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const repo = new BookSQLiteRepository(db);
  const router = useRouter();
  const colors = useAppColors();

  const [book, setBook] = useState<LocalBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadBook = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await repo.getBookById(id);
      setBook(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBook();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [id]);

  const pollBackendStatus = (backendBookId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get(`/books/${backendBookId}`);
        const data = res.data;
        setProcessingProgress(data.processingProgress || 50);
        setProcessingStage(data.processingStage || 'Processing');

        if (data.processingStatus === 'ready' || data.processingStatus === 'ocr_required') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setProcessing(false);
          setProcessingProgress(100);

          if (id) {
            await repo.updateBackendStatus(id, backendBookId, data.processingStatus, 100, true);
            await loadBook();
          }
        } else if (data.processingStatus === 'failed') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setProcessing(false);
        }
      } catch (err) {
        console.log('Polling error:', err);
      }
    }, 1200);
  };

  const handleOpenBook = async () => {
    if (!book) return;
    // Default reading mode is ALWAYS Smart Mode
    router.push(`/reader/smart/${book.id}`);

    // If backend processing has not started yet, trigger in background automatically
    if (!book.smartModeAvailable && !book.backendBookId) {
      try {
        setProcessing(true);
        const formData = new FormData();
        formData.append('file', {
          uri: book.localFileUri,
          name: book.originalFileName,
          type: 'application/pdf',
        } as any);

        const response = await apiClient.post('/books/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const backendBook = response.data;
        await repo.updateBackendStatus(
          book.id,
          backendBook._id,
          backendBook.processingStatus,
          backendBook.processingProgress || 10,
          backendBook.processingStatus === 'ready'
        );
        if (backendBook.processingStatus !== 'ready') {
          pollBackendStatus(backendBook._id);
        }
      } catch (e) {
        console.log('Background upload error:', e);
      }
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Remove Book',
      'Are you sure you want to remove this book from Dindle? The local file and reading progress will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!book) return;
            try {
              const localFile = new File(book.localFileUri);
              if (localFile.exists) {
                localFile.delete();
              }
              await repo.deleteBook(book.id);
              router.replace('/');
            } catch (e: any) {
              Alert.alert('Delete Error', e.message);
            }
          },
        },
      ]
    );
  };

  if (loading || !book) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />

      {/* Book Cover Card */}
      <View style={[styles.coverContainer, { backgroundColor: colors.cardBg, borderColor: colors.divider }]}>
        {book.coverUri ? (
          <Image source={{ uri: book.coverUri }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={[styles.coverInitials, { color: colors.textPrimary }]}>
              {book.title.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Title and Author */}
      <Text style={[styles.title, { color: colors.textPrimary }]}>{book.title}</Text>
      <Text style={[styles.author, { color: colors.textSecondary }]}>{book.author || 'Unknown Author'}</Text>

      {/* Reading Progress */}
      <View style={[styles.progressCard, { backgroundColor: colors.cardBg, borderColor: colors.divider }]}>
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Reading Progress</Text>
          <Text style={[styles.progressValue, { color: colors.textPrimary }]}>
            {Math.round(book.readingProgress || 0)}%
          </Text>
        </View>
        <View style={[styles.trackBar, { backgroundColor: colors.divider }]}>
          <View style={[styles.fillBar, { width: `${book.readingProgress}%`, backgroundColor: colors.accent }]} />
        </View>
      </View>

      {/* Single Prominent Open Book Action Button */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          onPress={handleOpenBook}
        >
          <Text style={styles.primaryButtonText}>📖 Open Book</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>🗑 Remove Book from Library</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverContainer: {
    width: 160,
    height: 240,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverInitials: {
    fontSize: 42,
    fontWeight: 'bold',
    fontFamily: 'Playfair Display',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Playfair Display',
    textAlign: 'center',
    marginBottom: 6,
  },
  author: {
    fontSize: 15,
    marginBottom: 20,
  },
  progressCard: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  trackBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fillBar: {
    height: '100%',
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
