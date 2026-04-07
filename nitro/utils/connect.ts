import type { H3Event } from "h3";
import { setResponseHeader, createError } from "h3";

// Standard gRPC status codes mapped to HTTP
export const GrpcStatus = {
  OK: 0,
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  UNAUTHENTICATED: 16,
  INTERNAL: 13,
} as const;

const grpcToHttp: Record<number, number> = {
  0: 200,
  1: 408,
  2: 500,
  3: 400,
  5: 404,
  6: 409,
  7: 403,
  13: 500,
  16: 401,
};

export function connectError(code: number, message: string): never {
  throw createError({
    statusCode: grpcToHttp[code] ?? 500,
    data: { code, message },
  });
}

export function connectOk<T>(data: T): T {
  return data;
}

export function setConnectHeaders(event: H3Event) {
  setResponseHeader(event, "Content-Type", "application/connect+json");
}
