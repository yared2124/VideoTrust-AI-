import type { ExtensionMessage, ExtensionResponse } from '../types/index.js';
import { cleanExpiredCache } from '../utils/storage.js';

const API_BASE_URL = 'http://localhost:4000';

console.log('[VideoTrust AI] Service worker initialized.');

// Periodic cache cleanup on extension install or browser update
chrome.runtime.onInstalled.addListener(() => {
  cleanExpiredCache().catch(console.error);
});

// Message dispatcher for content script requests
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then((res) => sendResponse(res))
    .catch((err) => {
      console.error('[VideoTrust AI Worker] Error handling message:', err);
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown background error',
      });
    });

  // Return true to signal asynchronous response
  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'ANALYZE_VIDEO': {
      const { videoId, forceRefresh } = message.payload;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        const response = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ videoId, forceRefresh }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: response.statusText }));
          return {
            success: false,
            error: errData.error || `Server responded with status ${response.status}`,
          };
        }

        const data = await response.json();
        return {
          success: true,
          data: data.data,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return {
            success: false,
            error: 'Analysis request timed out after 35s. Please retry.',
          };
        }
        return {
          success: false,
          error: `Could not connect to VideoTrust backend (${API_BASE_URL}). Ensure docker-compose is running.`,
        };
      }
    }

    case 'GET_CACHED_REPORT': {
      const { videoId } = message.payload;
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/video/${encodeURIComponent(videoId)}`);
        if (!response.ok) {
          return {
            success: false,
            error: 'No cached report found',
          };
        }
        const data = await response.json();
        return {
          success: true,
          data: data.data,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message,
        };
      }
    }

    case 'SUBMIT_FEEDBACK': {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message.payload),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: response.statusText }));
          return {
            success: false,
            error: errData.error || `Status ${response.status}`,
          };
        }

        const data = await response.json();
        return {
          success: true,
          data,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to submit feedback: ${err.message}`,
        };
      }
    }

    default:
      return {
        success: false,
        error: 'Unsupported message type',
      };
  }
}
