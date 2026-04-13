import { Clipboard } from '@capacitor/clipboard';

/**
 * A robust clipboard writer that handles:
 * 1. Native Capacitor copying (iOS/Android)
 * 2. Secure Web/localhost copying (Navigator API)
 * 3. Insecure HTTP testing environments (execCommand fallback)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Attempt standard Capacitor / Secure Web copy
    await Clipboard.write({ string: text });
    return true;
  } catch (e) {
    console.warn('Native/Secure clipboard failed, trying execCommand fallback...', e);
    // Legacy fallback for HTTP (ionic serve --external on local IP)
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      
      // Prevent zooming or scrolling
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return successful;
    } catch (err) {
      console.error('Fallback clipboard completely failed', err);
      return false;
    }
  }
}
