import React, { useState } from 'react';
import { StyleSheet, Text, View, Dimensions, PixelRatio, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TypographyCalibrationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fontLoaded, setFontLoaded] = useState<boolean | null>(null);

  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  const dpr = PixelRatio.get();

  const calibrationHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
      <title>Typography Calibration</title>
      <style>
        :root {
          --reader-background: #000000;
          --reader-text: #D0D0D0;
          --reader-secondary-text: #BDBDBD;
          --reader-bold-text: #D7D7D7;
          --reader-font-size: 18px;
          --reader-line-height: 1.285;
          --reader-horizontal-padding: 32px;
          --reader-top-padding: 72px;
          --reader-bottom-padding: 92px;
          --reader-paragraph-gap: 0.72em;
        }

        html, body {
          width: 100%;
          min-height: 100%;
          margin: 0;
          padding: 0;
          background: var(--reader-background);
          color: var(--reader-text);
        }

        body {
          font-family: "Bookerly", Georgia, serif;
          font-size: var(--reader-font-size);
          font-style: normal;
          font-weight: 400;
          line-height: var(--reader-line-height);

          letter-spacing: 0;
          word-spacing: normal;

          font-kerning: normal;
          font-optical-sizing: auto;
          font-synthesis: none;

          font-feature-settings: "kern" 1, "liga" 1, "clig" 1;

          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;

          overflow-wrap: normal;
          word-break: normal;

          -webkit-hyphens: auto;
          hyphens: auto;
        }

        .reader-content {
          box-sizing: border-box;
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
          padding: var(--reader-top-padding) var(--reader-horizontal-padding) var(--reader-bottom-padding);
        }

        .reader-content p {
          margin: 0 0 var(--reader-paragraph-gap);
          padding: 0;
          text-align: left;
          text-indent: 0;
          orphans: 2;
          widows: 2;
        }

        .reader-content em, .reader-content i {
          font-family: "Bookerly", Georgia, serif;
          font-style: italic;
          font-weight: 400;
        }

        .reader-content strong, .reader-content b {
          font-family: "Bookerly", Georgia, serif;
          font-style: normal;
          font-weight: 700;
          color: var(--reader-bold-text);
        }

        .reader-content strong em, .reader-content strong i {
          font-family: "Bookerly", Georgia, serif;
          font-style: italic;
          font-weight: 700;
          color: var(--reader-bold-text);
        }
      </style>
    </head>
    <body>
      <div class="reader-content">
        <p>CHAPTER 1</p>
        <p><strong>CALIBRATION DEMO</strong></p>
        <p>
          “Where in the world had the original documents gone?” she wondered quietly, holding the warm leather volume in her hands. It wasn’t in the cabinet, nor beside the desk—where it should have been resting in un-character-istically neat, perfectly aligned rows.
        </p>
        <p>
          She popped out of the quiet study space she’d searched through just in case, brushing a stray lock of hair away from her face. <em>Tonight had to be flawless.</em>
        </p>
        <p>
          “There you are!” her companion called out warmly, handing over a cold glass of sparkling water. “Don’t tell me you’re still hunting for those 1,744 archival prints—we left them back at the gallery.”
        </p>
        <p>
          The truth of the matter was that <strong>everything had gone strictly according to plan</strong>—a rare stroke of luck that left everyone feeling remarkably relieved.
        </p>
      </div>

      <script>
        document.fonts.ready.then(function() {
          var isBookerlyLoaded = document.fonts.check('18px "Bookerly"');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FONT_STATUS',
            font: 'Bookerly',
            loaded: isBookerlyLoaded
          }));
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {/* Dev Bar Header */}
      <View style={[styles.devBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.devTitle}>Typography Calibration</Text>
      </View>

      {/* WebView Reader Area */}
      <WebView
        originWhitelist={['*']}
        source={{ html: calibrationHtml }}
        style={styles.webview}
        containerStyle={{ backgroundColor: '#000000' }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'FONT_STATUS') {
              setFontLoaded(data.loaded);
            }
          } catch (e) {}
        }}
      />

      {/* Kindle Fixed Footer */}
      <View style={[styles.footer, { bottom: 28 + Math.max(insets.bottom, 0) }]}>
        <Text style={styles.footerText}>Location 204 of 744</Text>
        <Text style={styles.footerText}>27%</Text>
      </View>

      {/* Dev Diagnostic Panel */}
      <View style={styles.diagnosticPanel}>
        <Text style={styles.diagTitle}>DIAGNOSTICS:</Text>
        <Text style={styles.diagItem}>Bookerly Loaded: {fontLoaded === null ? 'Checking...' : fontLoaded ? '✅ YES (True Bookerly)' : '❌ NO (Using Fallback)'}</Text>
        <Text style={styles.diagItem}>Base Font Size: 18px | Line Height: 1.285 (23.1px)</Text>
        <Text style={styles.diagItem}>Padding: 32px | Paragraph Gap: 0.72em</Text>
        <Text style={styles.diagItem}>Viewport: {Math.round(windowWidth)} × {Math.round(windowHeight)} @ {dpr}x DPR</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  devBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  devTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 16,
    fontSize: 14,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  footer: {
    position: 'absolute',
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  footerText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 18,
    color: '#BDBDBD',
  },
  diagnosticPanel: {
    backgroundColor: '#111827',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#374151',
  },
  diagTitle: {
    color: '#F3F4F6',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  diagItem: {
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 16,
  },
});
