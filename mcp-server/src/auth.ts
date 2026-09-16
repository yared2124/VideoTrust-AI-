import crypto from "node:crypto";

/**
 * Timing-safe authentication guard for VideoTrust AI MCP server.
 * Prevents side-channel timing attacks when validating client API tokens.
 */
export class AuthGuard {
  private configuredKey: string | null;

  constructor() {
    this.configuredKey = process.env.VIDEOTRUST_API_KEY || null;
  }

  /**
   * Validate provided token against configured secret.
   * If no secret is configured in environment, server operates in local trusted mode.
   */
  public validate(providedToken?: string): boolean {
    if (!this.configuredKey) {
      // Local trusted development mode (no auth enforcement required)
      return true;
    }

    if (!providedToken) {
      return false;
    }

    try {
      const expectedBuffer = Buffer.from(this.configuredKey, "utf-8");
      const providedBuffer = Buffer.from(providedToken, "utf-8");

      if (expectedBuffer.length !== providedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    } catch {
      return false;
    }
  }

  public isAuthRequired(): boolean {
    return this.configuredKey !== null;
  }
}
