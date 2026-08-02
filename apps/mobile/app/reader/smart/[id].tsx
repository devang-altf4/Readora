import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { WebView } from 'react-native-webview';
import { Paths, File, Directory } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BookSQLiteRepository } from '../../../src/database/repositories/bookRepository';
import { LocalBook } from '../../../src/types';
import { apiClient } from '../../../src/services/apiClient';
import { getBookerlyFontFaceStyles } from '../../../src/utils/localFontLoader';
import { uploadBookForSmartReading } from '../../../src/services/importService';
import { API_CONFIG } from '../../../src/constants/config';

const KINDLE_TYPOGRAPHY = {
  fontSize: 18,
  lineHeight: 1.285,
  horizontalMargin: 32,
} as const;

const SMART_READER_TIMEOUT_MS = 5 * 60 * 1000;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const getReaderErrorMessage = (error: unknown): string => {
  const requestError = error as any;
  const backendDetail = requestError?.response?.data?.detail;
  if (typeof backendDetail === 'string' && backendDetail) {
    return backendDetail;
  }
  if (requestError?.code === 'ECONNABORTED') {
    return 'The reader service timed out.';
  }
  if (requestError?.message === 'Network Error') {
    return `The phone could not reach ${API_CONFIG.baseUrl}. Check that the backend is running and both devices are on the same Wi-Fi.`;
  }
  return requestError?.message || 'Smart Reader content could not be loaded.';
};

export default function SmartReadingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const repo = new BookSQLiteRepository(db);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [book, setBook] = useState<LocalBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [controlsVisible, setControlsVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading Reader...');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Calibrated defaults matching the Kindle reference density and rhythm.
  const [theme, setTheme] = useState<'light' | 'sepia' | 'dark'>('dark');
  const [fontSize, setFontSize] = useState<number>(KINDLE_TYPOGRAPHY.fontSize);
  const [lineHeight, setLineHeight] = useState<number>(KINDLE_TYPOGRAPHY.lineHeight);
  const [horizontalMargin, setHorizontalMargin] = useState<number>(KINDLE_TYPOGRAPHY.horizontalMargin);
  const [fontFamily, setFontFamily] = useState<'Bookerly' | 'Georgia' | 'System'>('Bookerly');
  const [fontFontFaceCss, setFontFaceCss] = useState('');
  const [isTrueBookerlyLoaded, setIsTrueBookerlyLoaded] = useState(false);

  // Page locations
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [readingProgress, setReadingProgress] = useState(0);

  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSmartContent() {
      if (!id) {
        setLoadError('This book does not have a valid local ID.');
        setLoading(false);
        return;
      }

      let currentBook: LocalBook | null = null;

      const loadCachedContent = async (candidate: LocalBook | null): Promise<boolean> => {
        if (!candidate?.cachedSmartContentUri) return false;

        const cachedFile = new File(candidate.cachedSmartContentUri);
        if (!cachedFile.exists) return false;

        const content = await cachedFile.text();
        if (!content.trim()) return false;

        if (!cancelled) {
          setHtmlContent(content);
          setBook(candidate);
        }
        return true;
      };

      try {
        setLoading(true);
        setLoadError(null);
        setLoadingMessage('Loading Reader...');

        // Load local font CSS declarations
        const fontData = await getBookerlyFontFaceStyles();
        if (cancelled) return;
        setFontFaceCss(fontData.fontCss);
        setIsTrueBookerlyLoaded(fontData.isLoaded);

        // Load saved global reader settings
        const savedSettings = await repo.getReaderSettings();
        if (savedSettings) {
          const hasLegacyDefaultTypography =
            savedSettings.fontSize === 15 &&
            (Math.abs(savedSettings.lineHeight - 1.35) < 0.001 || Math.abs(savedSettings.lineHeight - 1.6) < 0.001) &&
            (savedSettings.horizontalMargin === 20 || savedSettings.horizontalMargin === 24);

          if (savedSettings.theme) setTheme(savedSettings.theme as any);
          setFontSize(hasLegacyDefaultTypography ? KINDLE_TYPOGRAPHY.fontSize : savedSettings.fontSize);
          setLineHeight(hasLegacyDefaultTypography ? KINDLE_TYPOGRAPHY.lineHeight : savedSettings.lineHeight);
          setHorizontalMargin(hasLegacyDefaultTypography ? KINDLE_TYPOGRAPHY.horizontalMargin : savedSettings.horizontalMargin);
          if (savedSettings.fontFamily) setFontFamily(savedSettings.fontFamily as any);

          if (hasLegacyDefaultTypography) {
            await repo.saveReaderSettings(KINDLE_TYPOGRAPHY);
          }
        }

        const data = await repo.getBookById(id);
        if (!data) {
          throw new Error('This book is no longer available in the local library.');
        }
        currentBook = data;
        setBook(data);

        // Repair books imported by older builds that opened the reader before
        // their background upload returned a backend ID.
        if (!currentBook.backendBookId) {
          setLoadingMessage('Connecting to Smart Reader...');
          currentBook = await uploadBookForSmartReading(repo, currentBook);
          if (cancelled) return;
          setBook(currentBook);
        }

        const backendBookId = currentBook.backendBookId;
        if (!backendBookId) {
          throw new Error('The backend did not return a Smart Reader book ID.');
        }

        const deadline = Date.now() + SMART_READER_TIMEOUT_MS;
        let contentReady = false;

        while (!cancelled && !contentReady) {
          const statusResponse = await apiClient.get(`/books/${backendBookId}`, { timeout: 10000 });
          const backendBook = statusResponse.data;
          const status = backendBook.processingStatus || 'processing';
          const progress = backendBook.processingProgress ?? 0;
          const stage = backendBook.processingStage || 'preparing_content';

          await repo.updateBackendStatus(
            currentBook.id,
            backendBookId,
            status,
            progress,
            status === 'ready' || status === 'ocr_required'
          );

          currentBook = {
            ...currentBook,
            backendProcessingStatus: status,
            backendProcessingProgress: progress,
            smartModeAvailable: status === 'ready' || status === 'ocr_required',
          };

          if (!cancelled) {
            setBook(currentBook);
            setLoadingMessage(`Preparing Reader... ${progress}% (${stage.replace(/_/g, ' ')})`);
          }

          if (status === 'ready' || status === 'ocr_required') {
            contentReady = true;
            break;
          }
          if (status === 'failed') {
            throw new Error(backendBook.processingError?.message || 'The backend could not process this PDF.');
          }
          if (Date.now() >= deadline) {
            throw new Error('Smart Reader processing took longer than five minutes. Please retry.');
          }

          await wait(1200);
        }

        if (cancelled) return;

        setLoadingMessage('Opening Reader...');
        const response = await apiClient.get(`/books/${backendBookId}/content?format=html`, { timeout: 30000 });
        const fetchedHtml = response.data;
        if (typeof fetchedHtml !== 'string' || !fetchedHtml.trim()) {
          throw new Error('The backend returned empty Smart Reader content.');
        }

        const booksDir = new Directory(Paths.document, 'books/');
        if (!booksDir.exists) { booksDir.create(); }
        const cacheFile = new File(booksDir, `cache_${currentBook.id}.html`);
        cacheFile.write(fetchedHtml);
        await repo.updateSmartContentCache(currentBook.id, cacheFile.uri);

        if (!cancelled) {
          setHtmlContent(fetchedHtml);
        }
      } catch (error) {
        if (cancelled) return;

        try {
          if (await loadCachedContent(currentBook)) return;
        } catch (cacheError) {
          console.warn('Could not read cached Smart Reader content:', cacheError);
        }

        setLoadError(getReaderErrorMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSmartContent();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const postWebViewMessage = (msgObj: object) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(msgObj));
    }
  };

  const changeTheme = async (newTheme: 'light' | 'sepia' | 'dark') => {
    setTheme(newTheme);
    postWebViewMessage({ type: 'SET_THEME', theme: newTheme });
    await repo.saveReaderSettings({ theme: newTheme });
  };

  const changeFontSize = async (delta: number) => {
    const newSize = Math.min(30, Math.max(12, fontSize + delta));
    setFontSize(newSize);
    postWebViewMessage({ type: 'SET_FONT_SIZE', size: newSize });
    await repo.saveReaderSettings({ fontSize: newSize });
  };

  const resetTypographyToDefault = async () => {
    setFontSize(KINDLE_TYPOGRAPHY.fontSize);
    setLineHeight(KINDLE_TYPOGRAPHY.lineHeight);
    setHorizontalMargin(KINDLE_TYPOGRAPHY.horizontalMargin);
    setTheme('dark');
    setFontFamily('Bookerly');
    await repo.saveReaderSettings({
      ...KINDLE_TYPOGRAPHY,
      theme: 'dark',
      fontFamily: 'Bookerly',
    });
  };

  // Theme color tokens matching Kindle screenshot exactly
  const bgColors = {
    light: '#F7F6F2',
    sepia: '#F3E8D2',
    dark: '#000000',
  };

  const textColors = {
    light: '#171717',
    sepia: '#2C221E',
    dark: '#D0D0D0',
  };

  const subTextColors = {
    light: '#5F635F',
    sepia: '#7A6B60',
    dark: '#BCBCBC',
  };

  // Pre-compile full styles into HTML head in memory so Frame 1 rendering is INSTANT with zero style shift
  const preparedHtmlContent = useMemo(() => {
    if (!htmlContent) return '';

    const fontStr = fontFamily === 'Bookerly' ? '"Bookerly", Georgia, serif' : 'Georgia, serif';

    const customStyleBlock = `
      <style id="kindle-calibrated-head-styles">
        ${fontFontFaceCss}

        :root {
          --reader-background: ${bgColors[theme]};
          --reader-text: ${textColors[theme]};
          --reader-secondary-text: ${subTextColors[theme]};
          --reader-bold-text: #D7D7D7;
          --reader-font-size: ${fontSize}px;
          --reader-line-height: ${lineHeight};
          --reader-horizontal-padding: ${horizontalMargin}px;
          --reader-top-padding: 72px;
          --reader-bottom-padding: 92px;
          --reader-paragraph-spacing: 0.72em;
        }
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background-color: var(--reader-background) !important;
          color: var(--reader-text) !important;
        }
        body {
          font-family: ${fontStr} !important;
          font-size: var(--reader-font-size) !important;
          font-style: normal !important;
          font-weight: 400 !important;
          line-height: var(--reader-line-height) !important;
          letter-spacing: 0 !important;
          word-spacing: normal !important;
          font-kerning: normal !important;
          font-optical-sizing: auto !important;
          font-synthesis: none !important;
          font-feature-settings: "kern" 1, "liga" 1, "clig" 1 !important;
          text-rendering: optimizeLegibility !important;
          -webkit-font-smoothing: antialiased !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          -webkit-hyphens: auto !important;
          hyphens: auto !important;
        }
        body.theme-light {
          background-color: #F7F6F2 !important;
          color: #171717 !important;
        }
        body.theme-sepia {
          background-color: #F3E8D2 !important;
          color: #2C221E !important;
        }
        body.theme-dark {
          background-color: #000000 !important;
          color: #D0D0D0 !important;
        }
        .reader-container, #slider {
          height: 100vh !important;
          width: 100vw !important;
          box-sizing: border-box !important;
          padding-top: var(--reader-top-padding) !important;
          padding-bottom: var(--reader-bottom-padding) !important;
          padding-left: 0px !important;
          padding-right: 0px !important;

          column-width: 100vw !important;
          column-gap: 0px !important;
          column-fill: auto !important;

          overflow-x: scroll !important;
          overflow-y: hidden !important;
          scroll-snap-type: x mandatory !important;
          -webkit-overflow-scrolling: touch !important;
          scrollbar-width: none !important;
        }
        .reader-container::-webkit-scrollbar {
          display: none !important;
        }
        .dindle-heading {
          font-family: ${fontStr} !important;
          font-weight: 700 !important;
          margin-top: 1.4em !important;
          margin-bottom: 0.8em !important;
          line-height: 1.3 !important;
          color: var(--reader-text) !important;
          letter-spacing: 0.05em !important;
          text-transform: uppercase !important;
          font-size: 1.15em !important;
          padding-left: var(--reader-horizontal-padding) !important;
          padding-right: var(--reader-horizontal-padding) !important;
          text-align: left !important;
          break-inside: auto !important;
          scroll-snap-align: start !important;
        }
        .dindle-paragraph, p {
          font-family: ${fontStr} !important;
          font-size: var(--reader-font-size) !important;
          line-height: var(--reader-line-height) !important;
          width: 100vw !important;
          max-width: 100vw !important;
          box-sizing: border-box !important;
          padding-left: var(--reader-horizontal-padding) !important;
          padding-right: var(--reader-horizontal-padding) !important;
          margin-top: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          margin-bottom: var(--reader-paragraph-spacing) !important;
          text-align: left !important;
          text-indent: 0 !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          break-inside: auto !important;
          scroll-snap-align: start !important;
          orphans: 2 !important;
          widows: 2 !important;
        }
        em, i {
          font-family: ${fontStr} !important;
          font-style: italic !important;
          font-weight: 400 !important;
        }
        strong, b {
          font-family: ${fontStr} !important;
          font-style: normal !important;
          font-weight: 700 !important;
          color: #D7D7D7 !important;
        }
        strong em, strong i {
          font-family: ${fontStr} !important;
          font-style: italic !important;
          font-weight: 700 !important;
          color: #D7D7D7 !important;
        }
      </style>
    `;

    // Processed books may contain an older interaction bridge. The app owns
    // gestures, so removing embedded scripts prevents duplicate swipe handlers.
    return htmlContent
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace('</head>', `${customStyleBlock}</head>`)
      .replace(/<body class="theme-[^"]*"/, `<body class="theme-${theme}"`);
  }, [htmlContent, theme, fontSize, lineHeight, horizontalMargin, fontFamily, fontFontFaceCss]);

  const webViewSource = useMemo(
    () => ({ html: preparedHtmlContent }),
    [preparedHtmlContent]
  );

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, backgroundColor: bgColors[theme] }]}>
        <ActivityIndicator size="large" color={textColors[theme]} />
        <Text style={[styles.loadingText, { color: subTextColors[theme] }]}>{loadingMessage}</Text>
      </View>
    );
  }

  if (!book || loadError || !htmlContent) {
    return (
      <View style={[styles.centered, styles.errorContainer, { paddingTop: insets.top, backgroundColor: bgColors[theme] }]}>
        <Text style={[styles.errorTitle, { color: textColors[theme] }]}>Smart Reader Unavailable</Text>
        <Text style={[styles.errorMessage, { color: subTextColors[theme] }]}>
          {loadError || 'No Smart Reader content is available for this book.'}
        </Text>
        <Text style={[styles.apiAddressText, { color: subTextColors[theme] }]}>{API_CONFIG.baseUrl}</Text>
        <View style={styles.errorActions}>
          <TouchableOpacity
            style={styles.primaryErrorButton}
            onPress={() => setReloadKey((value) => value + 1)}
          >
            <Text style={styles.primaryErrorButtonText}>Retry Smart Reader</Text>
          </TouchableOpacity>
          {book && (
            <TouchableOpacity
              style={[styles.secondaryErrorButton, { borderColor: subTextColors[theme] }]}
              onPress={() => router.replace(`/reader/pdf/${book.id}`)}
            >
              <Text style={[styles.secondaryErrorButtonText, { color: textColors[theme] }]}>Open Original PDF</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.replace('/')}>
            <Text style={[styles.libraryLink, { color: subTextColors[theme] }]}>Back to Library</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Interaction bridge: native scrolling owns swipes; JS only handles taps and reporting.
  const injectedJs = `
    (function() {
      var slider = document.getElementById('slider') || document.querySelector('.reader-container') || document.body;
      var scrollTimeout = null;

      function updatePageInfo() {
        var pageWidth = window.innerWidth;
        var totalWidth = slider.scrollWidth || document.documentElement.scrollWidth;
        var currentScroll = slider.scrollLeft || window.scrollX || 0;

        var currentPage = Math.max(1, Math.round(currentScroll / pageWidth) + 1);
        var totalPages = Math.max(1, Math.ceil(totalWidth / pageWidth));
        var progress = Math.min(100, Math.round((currentPage / totalPages) * 100));

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PAGE_UPDATE',
          currentPage: currentPage,
          totalPages: totalPages,
          progress: progress
        }));
      }

      slider.addEventListener('scroll', function() {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(updatePageInfo, 100);
      });
      window.addEventListener('resize', updatePageInfo);
      setTimeout(updatePageInfo, 100);

      document.fonts.ready.then(function() {
        var isBookerlyLoaded = document.fonts.check('${fontSize}px "Bookerly"');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'FONT_STATUS',
          font: 'Bookerly',
          loaded: isBookerlyLoaded
        }));
      });

      function turnPage(direction) {
        var width = window.innerWidth;
        var maxScroll = Math.max(0, slider.scrollWidth - width);
        var currentPageStart = Math.round(slider.scrollLeft / width) * width;
        var target = Math.min(maxScroll, Math.max(0, currentPageStart + (direction * width)));
        slider.scrollTo({ left: target, behavior: 'smooth' });
      }

      var touchStartX = 0;
      var touchStartY = 0;
      var touchStartTime = 0;

      slider.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          touchStartTime = Date.now();
        }
      }, { passive: true });

      slider.addEventListener('touchend', function(e) {
        if (!e.changedTouches || e.changedTouches.length === 0) return;

        var touchEndX = e.changedTouches[0].clientX;
        var touchEndY = e.changedTouches[0].clientY;
        var deltaX = touchEndX - touchStartX;
        var deltaY = touchEndY - touchStartY;
        var duration = Date.now() - touchStartTime;

        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && duration < 300) {
          var width = window.innerWidth;
          var clickX = touchEndX;
          if (clickX < width * 0.25) {
            turnPage(-1);
          } else if (clickX > width * 0.75) {
            turnPage(1);
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TOGGLE_CONTROLS' }));
          }
        }
      }, { passive: true });

      window.addEventListener('message', function(event) {
        try {
          var data = JSON.parse(event.data);
          if (data.type === 'SET_THEME') {
            document.body.className = 'theme-' + data.theme;
            document.documentElement.style.setProperty('--reader-background', data.theme === 'dark' ? '#000000' : data.theme === 'sepia' ? '#F3E8D2' : '#F7F6F2');
          } else if (data.type === 'SET_FONT_SIZE') {
            document.documentElement.style.setProperty('--reader-font-size', data.size + 'px');
          }
        } catch(e) {}
      });
    })();
    true;
  `;

  return (
    <View style={[styles.container, { backgroundColor: bgColors[theme] }]}>
      {/* Immersive Status Bar (Hidden when reading, shown when controls visible) */}
      <StatusBar hidden={!controlsVisible} style={theme === 'dark' ? 'light' : 'dark'} backgroundColor={bgColors[theme]} />

      {/* Top Navigation Overlay */}
      {controlsVisible && (
        <View style={[
          styles.topHeader,
          {
            backgroundColor: bgColors[theme],
            paddingTop: Math.max(insets.top, 12),
            height: 52 + Math.max(insets.top, 12),
          }
        ]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Text style={[styles.navBtnText, { color: textColors[theme] }]}>← Library</Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: textColors[theme] }]} numberOfLines={1}>
            {book.title}
          </Text>

          <TouchableOpacity onPress={() => setSettingsModalVisible(true)} style={styles.navBtn}>
            <Text style={[styles.navBtnText, { color: textColors[theme], fontWeight: 'bold' }]}>Aa</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reflowable Horizontal Paged Reader */}
      <View style={[styles.readerArea, { backgroundColor: bgColors[theme] }]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={webViewSource}
          style={[styles.webview, { backgroundColor: bgColors[theme] }]}
          containerStyle={{ backgroundColor: bgColors[theme] }}
          injectedJavaScript={injectedJs}
          bounces={false}
          overScrollMode="never"
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'PAGE_UPDATE') {
                const cur = data.currentPage || 1;
                const tot = data.totalPages || 1;
                const prog = Math.round(data.progress || 0);
                setCurrentPage(cur);
                setTotalPages(tot);
                setReadingProgress(prog);
                repo.updateReadingProgress(book.id, cur, tot, prog);
              } else if (data.type === 'TOGGLE_CONTROLS') {
                setControlsVisible(!controlsVisible);
              } else if (data.type === 'FONT_STATUS') {
                if (data.font === 'Bookerly') {
                  setIsTrueBookerlyLoaded(data.loaded);
                }
              }
            } catch (e) {}
          }}
        />
      </View>

      {/* Fixed Kindle Progress Footer Overlay */}
      <View style={[
        styles.kindleLocationFooter,
        {
          backgroundColor: bgColors[theme],
          bottom: 28 + Math.max(insets.bottom, 0),
        }
      ]}>
        <Text style={[styles.kindleLocationText, { color: subTextColors[theme] }]}>
          Location {currentPage} of {totalPages}
        </Text>
        <Text style={[styles.kindleLocationText, { color: subTextColors[theme] }]}>
          {readingProgress}%
        </Text>
      </View>

      {/* Kindle Settings Sheet */}
      <Modal
        visible={settingsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSettingsModalVisible(false)}
        >
          <View style={[
            styles.settingsSheet,
            {
              backgroundColor: theme === 'dark' ? '#1C1C1E' : bgColors[theme],
              paddingBottom: Math.max(insets.bottom, 24),
              borderColor: theme === 'dark' ? '#333' : '#E3E2DF',
            }
          ]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: textColors[theme] }]}>Typography & Appearance</Text>
              <TouchableOpacity onPress={resetTypographyToDefault}>
                <Text style={styles.resetBtnText}>Reset Default</Text>
              </TouchableOpacity>
            </View>

            {/* Font Status Indicator */}
            <View style={styles.fontStatusRow}>
              <Text style={[styles.fontStatusLabel, { color: subTextColors[theme] }]}>Active Font:</Text>
              <Text style={[styles.fontStatusValue, { color: isTrueBookerlyLoaded ? '#10B981' : '#F59E0B' }]}>
                {isTrueBookerlyLoaded ? 'Bookerly Regular (Active)' : 'Bookerly (Missing .ttf files)'}
              </Text>
            </View>

            {/* Color Mode Options */}
            <Text style={[styles.label, { color: subTextColors[theme] }]}>Color Mode</Text>
            <View style={styles.themeRow}>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  styles.themeLight,
                  theme === 'light' && styles.activeTheme
                ]}
                onPress={() => changeTheme('light')}
              >
                <Text style={styles.themeTextLight}>Light</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  styles.themeSepia,
                  theme === 'sepia' && styles.activeTheme
                ]}
                onPress={() => changeTheme('sepia')}
              >
                <Text style={styles.themeTextSepia}>Sepia</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  styles.themeDark,
                  theme === 'dark' && styles.activeTheme
                ]}
                onPress={() => changeTheme('dark')}
              >
                <Text style={styles.themeTextDark}>Black</Text>
              </TouchableOpacity>
            </View>

            {/* Font Size Controls */}
            <Text style={[styles.label, { color: subTextColors[theme] }]}>Text Size ({fontSize}px)</Text>
            <View style={styles.sizeRow}>
              <TouchableOpacity
                style={[styles.sizeBtn, { backgroundColor: theme === 'dark' ? '#2C2C2E' : '#EFEEE9' }]}
                onPress={() => changeFontSize(-2)}
              >
                <Text style={[styles.sizeBtnText, { color: textColors[theme] }]}>A-</Text>
              </TouchableOpacity>

              <Text style={[styles.currentSizeText, { color: textColors[theme] }]}>{fontSize} pt</Text>

              <TouchableOpacity
                style={[styles.sizeBtn, { backgroundColor: theme === 'dark' ? '#2C2C2E' : '#EFEEE9' }]}
                onPress={() => changeFontSize(2)}
              >
                <Text style={[styles.sizeBtnText, { color: textColors[theme] }]}>A+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorContainer: {
    paddingHorizontal: 28,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  apiAddressText: {
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  errorActions: {
    width: '100%',
    maxWidth: 320,
    marginTop: 24,
    gap: 12,
  },
  primaryErrorButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryErrorButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryErrorButton: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryErrorButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  libraryLink: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  navBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  navBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  readerArea: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  kindleLocationFooter: {
    position: 'absolute',
    left: 32,
    right: 32,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  kindleLocationText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 18,
    color: '#BCBCBC',
    letterSpacing: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetBtnText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
  },
  fontStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fontStatusLabel: {
    fontSize: 12,
  },
  fontStatusValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOption: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8D6D0',
  },
  activeTheme: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  themeLight: {
    backgroundColor: '#F7F6F2',
  },
  themeSepia: {
    backgroundColor: '#F3E8D2',
  },
  themeDark: {
    backgroundColor: '#000000',
  },
  themeTextLight: {
    color: '#171717',
    fontWeight: '600',
    fontSize: 13,
  },
  themeTextSepia: {
    color: '#2C221E',
    fontWeight: '600',
    fontSize: 13,
  },
  themeTextDark: {
    color: '#F2F2F2',
    fontWeight: '600',
    fontSize: 13,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sizeBtn: {
    width: 44,
    height: 38,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentSizeText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
