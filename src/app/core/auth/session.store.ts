import { Injectable, computed, signal } from '@angular/core';

import { AuthenticationResponse, Permission, Role, SignedInUser } from './auth.model';

interface StoredSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAtEpochMs: number;
  readonly user: SignedInUser;
}

const storageKey = 'keyhouse.session';

/**
 * The signed-in session, held in signals so the whole UI reacts to it without a subscription.
 *
 * The tokens live in localStorage, which is the usual trade-off for a token-in-body API: it
 * survives a refresh, and it is readable by script, so the access token is short-lived (15
 * minutes) and the refresh token rotates on every use and is revoked as a family if one is
 * replayed. A cookie-based session would be the stronger option and is a server-side change.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly session = signal<StoredSession | null>(restore());

  readonly user = computed(() => this.session()?.user ?? null);

  readonly accessToken = computed(() => this.session()?.accessToken ?? null);

  readonly refreshToken = computed(() => this.session()?.refreshToken ?? null);

  readonly isAuthenticated = computed(() => this.session() !== null);

  readonly role = computed<Role | null>(() => this.session()?.user.role ?? null);

  /** The agency this session belongs to. Null for the platform admin, who is above any agency. */
  readonly agencyId = computed(() => this.session()?.user.agencyId ?? null);

  readonly displayName = computed(() => this.session()?.user.fullName ?? '');

  /** True a minute before the token actually expires, so a request is never sent with a dead one. */
  readonly isExpiring = computed(() => {
    const current = this.session();

    return current === null || current.expiresAtEpochMs - Date.now() < 60_000;
  });

  has(permission: Permission): boolean {
    return this.session()?.user.permissions.includes(permission) ?? false;
  }

  hasAny(...permissions: readonly Permission[]): boolean {
    return permissions.some((permission) => this.has(permission));
  }

  isRole(...roles: readonly Role[]): boolean {
    const role = this.role();

    return role !== null && roles.includes(role);
  }

  start(response: AuthenticationResponse): void {
    this.write({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAtEpochMs: Date.now() + response.expiresInSeconds * 1000,
      user: response.user,
    });
  }

  clear(): void {
    this.session.set(null);
    localStorage.removeItem(storageKey);
  }

  private write(session: StoredSession): void {
    this.session.set(session);

    try {
      localStorage.setItem(storageKey, JSON.stringify(session));
    } catch {
      // A private window with storage blocked: the session still works, it just will not survive
      // a reload. Not a reason to fail the sign-in.
    }
  }
}

function restore(): StoredSession | null {
  try {
    const raw = localStorage.getItem(storageKey);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredSession;

    // A refresh token outlives the access token, so an expired access token is not a dead session.
    return parsed.refreshToken ? parsed : null;
  } catch {
    return null;
  }
}
