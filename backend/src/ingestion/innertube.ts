import { Innertube, UniversalCache } from 'youtubei.js';

let innertubeInstance: Innertube | null = null;
let initPromise: Promise<Innertube> | null = null;

/**
 * Returns a singleton instance of Innertube.
 * Reusing this instance is critical to avoid re-authenticating / re-handshaking
 * with YouTube InnerTube on every single request.
 */
export async function getInnertubeClient(): Promise<Innertube> {
  if (innertubeInstance) {
    return innertubeInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      innertubeInstance = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });
      return innertubeInstance;
    } catch (error) {
      initPromise = null;
      throw new Error(`Failed to initialize InnerTube client: ${(error as Error).message}`);
    }
  })();

  return initPromise;
}
