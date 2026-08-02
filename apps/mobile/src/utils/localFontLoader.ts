import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

/**
 * Loads the bundled OFL-licensed Libre Baskerville variable fonts and embeds
 * them into the reader HTML. Data URIs avoid Android WebView network/CORS
 * failures and keep typography available offline.
 */
export async function getReaderFontFaceStyles(): Promise<{ fontCss: string; isLoaded: boolean }> {
  const regularFontModule = require('../../assets/fonts/LibreBaskerville-VariableFont_wght.ttf');
  const italicFontModule = require('../../assets/fonts/LibreBaskerville-Italic-VariableFont_wght.ttf');

  try {
    const [regularAsset, italicAsset] = await Asset.loadAsync([
      regularFontModule,
      italicFontModule,
    ]);

    if (!regularAsset.localUri || !italicAsset.localUri) {
      throw new Error('Bundled Baskerville font assets did not resolve to local files.');
    }

    const [regularBase64, italicBase64] = await Promise.all([
      new File(regularAsset.localUri).base64(),
      new File(italicAsset.localUri).base64(),
    ]);

    const regularDataUri = `data:font/truetype;base64,${regularBase64}`;
    const italicDataUri = `data:font/truetype;base64,${italicBase64}`;

    const fontCss = `
      @font-face {
        font-family: "Libre Baskerville";
        src: url("${regularDataUri}") format("truetype");
        font-style: normal;
        font-weight: 400 700;
        font-display: block;
      }
      @font-face {
        font-family: "Libre Baskerville";
        src: url("${italicDataUri}") format("truetype");
        font-style: italic;
        font-weight: 400 700;
        font-display: block;
      }
    `;

    return { fontCss, isLoaded: true };
  } catch (error) {
    console.warn('Bundled Baskerville font could not be loaded:', error);
    return {
      fontCss: '',
      isLoaded: false,
    };
  }
}
