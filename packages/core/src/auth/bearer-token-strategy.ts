import type { AuthResult, AuthStrategy } from "./types.js";

/**
 * Verifies a bearer token and resolves the authenticated user.
 *
 * Implementations are responsible for cryptographically verifying the
 * token and validating all relevant claims, including expiration,
 * issuer, audience, and permitted signing algorithms.
 *
 * Do not use an unverified token payload to construct an AuthResult.
 *
 * Return null when the token is invalid. Throw an error when verification
 * cannot be completed because of an operational failure.
 */
export type BearerTokenVerifier = (
  token: string,
) => AuthResult | null | Promise<AuthResult | null>;

export class BearerTokenStrategy implements AuthStrategy {
  readonly name = "bearer-token";

  constructor(
    private readonly verifyToken: BearerTokenVerifier,
  ) {}

  async authenticate(
    credentials: unknown,
  ): Promise<AuthResult | null> {
    if (typeof credentials !== "string") {
      return null;
    }

    const token = credentials.trim();

    if (token.length === 0) {
      return null;
    }

    return this.verifyToken(token);
  }
}