import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { createHash, randomBytes } from "node:crypto";

export const JWT_ISSUER = "memos";
export const JWT_KEY_ID = "v1";
export const ACCESS_TOKEN_AUDIENCE = "user.access-token";
export const REFRESH_TOKEN_AUDIENCE = "user.refresh-token";
export const ACCESS_TOKEN_DURATION = 15 * 60 * 1000; // 15 minutes in ms
export const REFRESH_TOKEN_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
export const REFRESH_TOKEN_COOKIE = "memos_refresh";
export const PAT_PREFIX = "memos_pat_";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable must be set in production");
    }
    // Development-only fallback — not safe for production
    return new TextEncoder().encode("memos-dev-secret-DO-NOT-USE-IN-PROD");
  }
  return new TextEncoder().encode(secret);
}

export interface AccessTokenPayload extends JWTPayload {
  type: "access";
  role: string;
  status: string;
  username: string;
}

export interface RefreshTokenPayload extends JWTPayload {
  type: "refresh";
  tid: string;
}

export async function generateAccessToken(
  userId: number,
  username: string,
  role: string,
  status: string,
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_DURATION);
  const secret = getSecretKey();

  const token = await new SignJWT({
    type: "access",
    role,
    status,
    username,
  } as AccessTokenPayload)
    .setProtectedHeader({ alg: "HS256", kid: JWT_KEY_ID })
    .setIssuer(JWT_ISSUER)
    .setAudience(ACCESS_TOKEN_AUDIENCE)
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);

  return { token, expiresAt };
}

export async function generateRefreshToken(
  userId: number,
  tokenId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DURATION);
  const secret = getSecretKey();

  const token = await new SignJWT({
    type: "refresh",
    tid: tokenId,
  } as RefreshTokenPayload)
    .setProtectedHeader({ alg: "HS256", kid: JWT_KEY_ID })
    .setIssuer(JWT_ISSUER)
    .setAudience(REFRESH_TOKEN_AUDIENCE)
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);

  return { token, expiresAt };
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
      algorithms: ["HS256"],
    });
    if ((payload as AccessTokenPayload).type !== "access") return null;
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenPayload | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: REFRESH_TOKEN_AUDIENCE,
      algorithms: ["HS256"],
    });
    if ((payload as RefreshTokenPayload).type !== "refresh") return null;
    return payload as RefreshTokenPayload;
  } catch {
    return null;
  }
}

export function generatePAT(): string {
  const randomStr = randomBytes(24).toString("hex");
  return PAT_PREFIX + randomStr;
}

export function hashPAT(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateTokenId(): string {
  return randomBytes(16).toString("hex");
}

export function extractBearerToken(authHeader: string): string {
  // Note: Bearer scheme is case-insensitive per RFC 7235
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7);
}

export function extractRefreshTokenFromCookie(cookieHeader: string): string {
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  return cookies[REFRESH_TOKEN_COOKIE] || "";
}
