import { Paths, File } from 'expo-file-system';

/**
 * Utility to resolve local font assets in apps/mobile/assets/fonts/
 * and convert them to inline Base64 @font-face declarations for WebView.
 * This guarantees 100% offline, zero-network, local font rendering inside WebView.
 */
export async function getBookerlyFontFaceStyles(): Promise<{ fontCss: string; isLoaded: boolean }> {
  try {
    const fontsDir = `${Paths.document}/../assets/fonts`;
    
    // We check for the four required Bookerly variants
    const regularFile = new File(fontsDir, 'Bookerly-Regular.ttf');
    const italicFile = new File(fontsDir, 'Bookerly-Italic.ttf');
    const boldFile = new File(fontsDir, 'Bookerly-Bold.ttf');
    const boldItalicFile = new File(fontsDir, 'Bookerly-BoldItalic.ttf');
    const emberFile = new File(fontsDir, 'AmazonEmber-Regular.ttf');

    if (!regularFile.exists) {
      return {
        fontCss: `
          /* Bookerly font files not detected in assets/fonts/ */
          @font-face {
            font-family: "Bookerly";
            src: local("Georgia"), serif;
            font-style: normal;
            font-weight: 400;
          }
        `,
        isLoaded: false,
      };
    }

    const regBase64 = await regularFile.bytes(); // or base64
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

    let emberCss = '';
    if (emberFile.exists) {
      const bytes = await emberFile.bytes();
      const emberUri = `data:font/truetype;base64,${Buffer.from(bytes).toString('base64')}`;
      emberCss = `
        @font-face {
          font-family: "Amazon Ember";
          src: url("${emberUri}") format("truetype");
          font-style: normal;
          font-weight: 400;
          font-display: block;
        }
      `;
    }

    const fontCss = `
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
      ${emberCss}
    `;

    return { fontCss, isLoaded: true };
  } catch (e) {
    return {
      fontCss: '',
      isLoaded: false,
    };
  }
}
