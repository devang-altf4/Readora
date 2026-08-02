import { Paths, File } from 'expo-file-system';

/**
 * Utility to resolve local font assets in apps/mobile/assets/fonts/
 * and inject webfont fallback declarations for Baskerville / Bookerly in WebView.
 */
export async function getBookerlyFontFaceStyles(): Promise<{ fontCss: string; isLoaded: boolean }> {
  const baskervilleGoogleFontCss = `
    @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');

    @font-face {
      font-family: "Baskerville";
      src: local("Baskerville"), local("Libre Baskerville"), url('https://fonts.gstatic.com/s/librebaskerville/v14/kmKiZpq3EH-6frQdcqiB6imWg0Q8sr7F_w0.woff2') format('woff2');
      font-style: normal;
      font-weight: 400;
    }
    @font-face {
      font-family: "Baskerville";
      src: local("Baskerville Bold"), local("Libre Baskerville Bold"), url('https://fonts.gstatic.com/s/librebaskerville/v14/kmKhZpq3EH-6frQdcqiB6imWg0Q8sp3y3yX92vU.woff2') format('woff2');
      font-style: normal;
      font-weight: 700;
    }
    @font-face {
      font-family: "Baskerville";
      src: local("Baskerville Italic"), local("Libre Baskerville Italic"), url('https://fonts.gstatic.com/s/librebaskerville/v14/kmKgZpq3EH-6frQdcqiB6imWg0Q8sr7p82Pz1w.woff2') format('woff2');
      font-style: italic;
      font-weight: 400;
    }
  `;

  try {
    const fontsDir = `${Paths.document}/../assets/fonts`;
    
    // Check for optional Bookerly local ttf assets
    const regularFile = new File(fontsDir, 'Bookerly-Regular.ttf');
    const italicFile = new File(fontsDir, 'Bookerly-Italic.ttf');
    const boldFile = new File(fontsDir, 'Bookerly-Bold.ttf');
    const boldItalicFile = new File(fontsDir, 'Bookerly-BoldItalic.ttf');

    if (!regularFile.exists) {
      return {
        fontCss: baskervilleGoogleFontCss,
        isLoaded: true,
      };
    }

    const regBase64 = await regularFile.bytes();
    const regUri = `data:font/truetype;base64,${Buffer.from(regBase64).toString('base64')}`;

    let italicUri = regUri;
    if (italicFile.exists) {
      const bytes = await italicFile.bytes();
      italicUri = `data:font/truetype;base64,${Buffer.from(bytes).toString('base64')}`;
    }

    let boldUri = regUri;
    if (boldFile.exists) {
      const bytes = await boldFile.bytes();
      boldUri = `data:font/truetype;base64,${Buffer.from(bytes).toString('base64')}`;
    }

    let boldItalicUri = regUri;
    if (boldItalicFile.exists) {
      const bytes = await boldItalicFile.bytes();
      boldItalicUri = `data:font/truetype;base64,${Buffer.from(bytes).toString('base64')}`;
    }

    const fontCss = `
      ${baskervilleGoogleFontCss}

      @font-face {
        font-family: "Bookerly";
        src: url("${regUri}") format("truetype");
        font-style: normal;
        font-weight: 400;
        font-display: block;
      }
      @font-face {
        font-family: "Bookerly";
        src: url("${italicUri}") format("truetype");
        font-style: italic;
        font-weight: 400;
        font-display: block;
      }
      @font-face {
        font-family: "Bookerly";
        src: url("${boldUri}") format("truetype");
        font-style: normal;
        font-weight: 700;
        font-display: block;
      }
      @font-face {
        font-family: "Bookerly";
        src: url("${boldItalicUri}") format("truetype");
        font-style: italic;
        font-weight: 700;
        font-display: block;
      }
    `;

    return { fontCss, isLoaded: true };
  } catch (e) {
    return {
      fontCss: baskervilleGoogleFontCss,
      isLoaded: true,
    };
  }
}
