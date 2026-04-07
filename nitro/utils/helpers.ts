import { v4 as uuidv4 } from "uuid";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

export function genUID(): string {
  return nanoid(8).toLowerCase();
}

export function genUUID(): string {
  return uuidv4();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function toTimestamp(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString();
}

export function extractTags(content: string): string[] {
  const matches: string[] = content.match(/#([^\s#]+)/g) || [];
  return matches.map((t) => t.slice(1));
}

export function extractUsernameFromResourceName(
  name: string,
  prefix = "users/",
): string {
  if (!name.startsWith(prefix)) throw new Error(`Invalid resource name: ${name}`);
  return name.slice(prefix.length);
}

export function extractUIDFromResourceName(
  name: string,
  prefix: string,
): string {
  if (!name.startsWith(prefix)) throw new Error(`Invalid resource name: ${name}`);
  return name.slice(prefix.length);
}
