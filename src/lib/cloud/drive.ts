import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type DriveRpc = {
  ok: boolean;
  payload: string;
  errorMessage?: string;
  loginRequired?: boolean;
  loginUrl?: string;
  pending?: boolean;
};

async function invoke(toolName: string, args: Record<string, string | undefined>): Promise<DriveRpc> {
  const { callTool } = await import("@/lib/app-data/client.server");
  const { ConnectorType } = await import("@/lib/app-data");
  const result = await callTool(toolName, args, { connectorType: ConnectorType.GoogleDrive });
  return {
    ok: result.ok,
    payload: JSON.stringify(result.data ?? null),
    errorMessage: result.errorMessage,
    loginRequired: result.loginRequired,
    loginUrl: result.loginUrl,
    pending: result.pending,
  };
}

export const listDriveFolder = createServerFn({ method: "POST" })
  .validator(z.object({ folderId: z.string().optional() }))
  .handler(async ({ data }): Promise<DriveRpc> => {
    const { GoogleDriveTools } = await import("@/lib/app-data");
    const id = data.folderId ?? "root";
    return invoke(GoogleDriveTools.listFolder, { folder_id: id, folderId: id });
  });

export const searchDrive = createServerFn({ method: "POST" })
  .validator(z.object({ query: z.string() }))
  .handler(async ({ data }): Promise<DriveRpc> => {
    const { GoogleDriveTools } = await import("@/lib/app-data");
    return invoke(GoogleDriveTools.search, { query: data.query });
  });

export const readDriveFile = createServerFn({ method: "POST" })
  .validator(z.object({ fileId: z.string() }))
  .handler(async ({ data }): Promise<DriveRpc> => {
    const { GoogleDriveTools } = await import("@/lib/app-data");
    return invoke(GoogleDriveTools.readFile, { file_id: data.fileId, fileId: data.fileId });
  });

export const createDriveFolder = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string(), parentId: z.string().optional() }))
  .handler(async ({ data }): Promise<DriveRpc> => {
    const { GoogleDriveTools } = await import("@/lib/app-data");
    return invoke(GoogleDriveTools.createFolder, {
      name: data.name,
      parent_id: data.parentId,
      parentId: data.parentId,
    });
  });

export const trashDriveFile = createServerFn({ method: "POST" })
  .validator(z.object({ fileId: z.string() }))
  .handler(async ({ data }): Promise<DriveRpc> => {
    const { GoogleDriveTools } = await import("@/lib/app-data");
    return invoke(GoogleDriveTools.trashFile, { file_id: data.fileId, fileId: data.fileId });
  });
