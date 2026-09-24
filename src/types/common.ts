export interface AccountSnapshot {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

/**
 * Authenticated device actor (set by device-auth middleware).
 *
 * Device-authenticated requests have no JWT user; the device identity replaces
 * it. `userId`/`email` are kept empty so callers sharing the
 * `{ userId, email }` service signature can pass them through — services must
 * map an empty userId to null when the destination column is @db.Uuid
 * (e.g. Transfer.createdBy, EventLog.appUser).
 */
export interface DeviceActor {
  userId: string;
  email: string;
  deviceId: string;
  deviceType: string;
}

export const DEVICE_ACTOR_EMPTY_USER = "";
export const DEVICE_ACTOR_EMPTY_EMAIL = "";
