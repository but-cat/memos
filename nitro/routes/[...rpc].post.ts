import { defineEventHandler, getRequestURL, setResponseHeader, createError } from "h3";
import { handleAuthService } from "../handlers/auth";
import { handleUserService } from "../handlers/user";
import { handleMemoService } from "../handlers/memo";
import { handleInstanceService } from "../handlers/instance";
import { handleAttachmentService } from "../handlers/attachment";
import { handleIdpService } from "../handlers/idp";
import { handleShortcutService } from "../handlers/shortcut";

type ServiceHandler = (method: string, event: any) => Promise<unknown>;

function handleHealthService(_method: string, _event: any): Promise<unknown> {
  return Promise.resolve({ status: "SERVING" });
}

const serviceHandlers: Record<string, ServiceHandler> = {
  "memos.api.v1.AuthService": handleAuthService,
  "memos.api.v1.UserService": handleUserService,
  "memos.api.v1.MemoService": handleMemoService,
  "memos.api.v1.InstanceService": handleInstanceService,
  "memos.api.v1.AttachmentService": handleAttachmentService,
  "memos.api.v1.IdentityProviderService": handleIdpService,
  "memos.api.v1.ShortcutService": handleShortcutService,
  "memos.api.v1.HealthService": handleHealthService,
};

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  // pathname starts with "/" — strip it and split
  const parts = url.pathname.slice(1).split("/");
  if (parts.length < 2) {
    throw createError({ statusCode: 404, message: "Not found" });
  }

  const serviceName = parts[0];
  const methodName = parts[1];

  const handler = serviceHandlers[serviceName];
  if (!handler) {
    throw createError({
      statusCode: 404,
      message: `Service ${serviceName} not found`,
    });
  }

  setResponseHeader(event, "Content-Type", "application/connect+json");
  return handler(methodName, event);
});
