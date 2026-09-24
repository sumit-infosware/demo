import { randomUUID } from "node:crypto";
import { PhotoRequestStatus } from "../enums/status.enum.js";

export interface PhotoRequestPhoto {
  sequence: number;
  url: string;
  path: string; // relative — used later to move → tag folder
  capturedAt: string;
}

export interface PhotoRequest {
  requestId: string;
  sessionId: string; // groups all photos before tag is created
  packetIndex?: number;
  rrLineId?: string;
  itemCode?: string;
  totalPhotos: number; // 1..3
  capturedPhotos: PhotoRequestPhoto[];
  status: PhotoRequestStatus;
  deviceId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  attachedToTagId?: string; // set once photos are moved to a tag folder
}

/** In-memory store (survives process lifetime; auto-cleaned). */
const requests = new Map<string, PhotoRequest>();

/** Housekeeping — clear stale requests periodically. */
setInterval(
  () => {
    const now = Date.now();
    for (const [id, r] of requests) {
      const age = now - new Date(r.updatedAt).getTime();
      // consumed ones live 5 more minutes for debugging
      if (r.status === PhotoRequestStatus.CONSUMED && age > 5 * 60 * 1000) {
        requests.delete(id);
        continue;
      }
      // any unfinished ones expire after 60 minutes
      if (age > 60 * 60 * 1000) {
        requests.delete(id);
      }
    }
  },
  5 * 60 * 1000,
);

export const handheldService = {
  /** Create a new session-scoped photo request. */
  create(input: {
    sessionId: string;
    packetIndex?: number;
    rrLineId?: string;
    itemCode?: string;
    totalPhotos: number;
    createdBy?: string;
  }): PhotoRequest {
    const req: PhotoRequest = {
      requestId: randomUUID(),
      sessionId: input.sessionId,
      packetIndex: input.packetIndex,
      rrLineId: input.rrLineId,
      itemCode: input.itemCode,
      totalPhotos: Math.min(3, Math.max(1, input.totalPhotos)),
      capturedPhotos: [],
      status: PhotoRequestStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: input.createdBy,
    };
    requests.set(req.requestId, req);
    return req;
  },

  get(id: string): PhotoRequest | undefined {
    return requests.get(id);
  },

  /** For handheld polling — returns oldest PENDING / IN_PROGRESS. */
  pendingForDevice(deviceId?: string): PhotoRequest[] {
    return [...requests.values()]
      .filter((r) => {
        if (
          r.status !== PhotoRequestStatus.PENDING &&
          r.status !== PhotoRequestStatus.IN_PROGRESS
        ) {
          return false;
        }
        if (deviceId && r.deviceId && r.deviceId !== deviceId) return false;
        return true;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  addPhoto(requestId: string, photo: PhotoRequestPhoto, deviceId?: string): PhotoRequest {
    const r = requests.get(requestId);
    if (!r) throw new Error("Request not found");
    if (
      r.status === PhotoRequestStatus.COMPLETED ||
      r.status === PhotoRequestStatus.CANCELLED ||
      r.status === PhotoRequestStatus.CONSUMED
    ) {
      throw new Error(`Request already ${r.status}`);
    }
    // Replace if same sequence already captured (allow retry)
    r.capturedPhotos = r.capturedPhotos.filter((p) => p.sequence !== photo.sequence);
    r.capturedPhotos.push(photo);
    r.capturedPhotos.sort((a, b) => a.sequence - b.sequence);
    r.deviceId = deviceId ?? r.deviceId;
    r.status =
      r.capturedPhotos.length >= r.totalPhotos
        ? PhotoRequestStatus.COMPLETED
        : PhotoRequestStatus.IN_PROGRESS;
    r.updatedAt = new Date().toISOString();
    requests.set(requestId, r);
    return r;
  },

  cancel(id: string): PhotoRequest | undefined {
    const r = requests.get(id);
    if (!r) return undefined;
    r.status = PhotoRequestStatus.CANCELLED;
    r.updatedAt = new Date().toISOString();
    requests.set(id, r);
    return r;
  },

  /**
   * Mark as CONSUMED after tag is generated and photos moved.
   * Keeps the object alive briefly so the frontend's last poll sees the state.
   */
  markConsumed(requestId: string, tagId: string): PhotoRequest | undefined {
    const r = requests.get(requestId);
    if (!r) return undefined;
    r.attachedToTagId = tagId;
    r.status = PhotoRequestStatus.CONSUMED;
    r.updatedAt = new Date().toISOString();
    requests.set(requestId, r);
    return r;
  },
};
