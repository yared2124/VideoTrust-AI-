import type { ExtensionMessage, ExtensionResponse } from '../types/index.js';

/**
 * Whether the current extension context is still valid.
 * Once invalidated (e.g. after an extension update), this flips to false and
 * all message calls become no-ops rather than throwing unhandled errors.
 */
let contextValid = true;

/**
 * Detect context invalidation proactively by listening for the runtime
 * becoming unavailable. This fires on extension reload/update while
 * content scripts from the old version are still alive in open tabs.
 */
function isContextInvalidated(): boolean {
  try {
    // Accessing chrome.runtime.id throws if the context is invalidated
    return !chrome.runtime?.id;
  } catch {
    return true;
  }
}

/**
 * Resilient wrapper around chrome.runtime.sendMessage.
 *
 * - Silently returns null when the extension context has been invalidated
 *   (i.e. the extension was updated/reloaded while this tab was open).
 * - Shows a one-time console warning instead of an unhandled error, so
 *   DevTools stays clean for the developer.
 * - Automatically marks the context as invalid on first invalidation so
 *   subsequent calls are immediate no-ops (O(1) cost).
 *
 * @param message  The message to send to the background service worker.
 * @returns        The response from the background worker, or null on error.
 */
export async function sendMessage(
  message: ExtensionMessage
): Promise<ExtensionResponse | null> {
  if (!contextValid || isContextInvalidated()) {
    contextValid = false;
    return null;
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response: ExtensionResponse) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          const msg = lastError.message ?? '';

          if (
            msg.includes('Extension context invalidated') ||
            msg.includes('context invalidated') ||
            msg.includes('receiving end does not exist') ||
            msg.includes('Could not establish connection')
          ) {
            if (contextValid) {
              // Only warn once per content script lifetime
              console.warn(
                '[VideoTrust AI] Extension context invalidated — ' +
                  'the extension was reloaded. Refresh this tab to restore functionality.'
              );
              contextValid = false;
            }
            resolve(null);
          } else {
            // Legitimate communication error — surface it as a failed response
            resolve({ success: false, error: msg || 'Worker connection failed' });
          }
          return;
        }

        resolve(response ?? null);
      });
    } catch (err: any) {
      // chrome.runtime.sendMessage itself throws if context is gone
      if (contextValid) {
        console.warn(
          '[VideoTrust AI] Extension context invalidated — ' +
            'the extension was reloaded. Refresh this tab to restore functionality.'
        );
        contextValid = false;
      }
      resolve(null);
    }
  });
}

/**
 * Convenience: returns true if the extension context is still alive.
 * Useful for guards before attempting any chrome API calls.
 */
export function isExtensionContextValid(): boolean {
  if (!contextValid) return false;
  if (isContextInvalidated()) {
    contextValid = false;
    return false;
  }
  return true;
}
