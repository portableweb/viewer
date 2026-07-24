import { PwebManifest, ZipEntry } from "@portableweb/core";
import { PwebdataDocument } from "@portableweb/store";

/**
 * One entry per open bundle window, keyed by webContents.id. Lets IPC
 * handlers (which only know which renderer sent the message) find the
 * right bundle's buffer/entries/store without trusting anything the
 * renderer claims about itself.
 */
export interface BundleContext {
  buffer: Uint8Array;
  entries: ZipEntry[];
  manifest: PwebManifest;
  storageEnabled: boolean;
  storeDoc: PwebdataDocument;
  storeBaseDir: string;
}

const registry = new Map<number, BundleContext>();

export function registerBundle(webContentsId: number, context: BundleContext): void {
  registry.set(webContentsId, context);
}

export function getBundle(webContentsId: number): BundleContext | undefined {
  return registry.get(webContentsId);
}

export function unregisterBundle(webContentsId: number): void {
  registry.delete(webContentsId);
}
