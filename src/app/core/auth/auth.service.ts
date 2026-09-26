import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, tap } from 'rxjs';

import { apiUrl } from '../api/api';
import { AuthenticationResponse, homeRouteFor } from './auth.model';
import { SessionStore } from './session.store';

/**
 * Marks the requests that must not carry a bearer token or trigger a refresh: signing in, and
 * refreshing itself. Without it, a failing refresh would try to refresh.
 */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export function skipAuth(): HttpContext {
  return new HttpContext().set(SKIP_AUTH, true);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  /** In flight refresh, shared so a burst of 401s produces one refresh rather than five. */
  private refreshing: Promise<boolean> | null = null;

  /**
   * IDN-01. The agency is named in the X-Tenant header because an anonymous request has no token
   * to read it from; once signed in, the token's claim is the authority (NFR-02).
   */
  login(email: string, password: string, agencyId: string | null): Observable<AuthenticationResponse> {
    const headers: Record<string, string> = agencyId ? { 'X-Tenant': agencyId } : {};

    return this.http
      .post<AuthenticationResponse>(
        apiUrl('/api/v1/auth/login'),
        { email, password },
        { context: skipAuth(), headers },
      )
      .pipe(tap((response) => this.session.start(response)));
  }

  /**
   * Rotation: the old token is spent, and replaying it revokes the whole family on the server.
   * Concurrent callers share the one attempt.
   */
  refresh(): Promise<boolean> {
    this.refreshing ??= this.attemptRefresh().finally(() => {
      this.refreshing = null;
    });

    return this.refreshing;
  }

  async logout(): Promise<void> {
    const refreshToken = this.session.refreshToken();

    if (refreshToken) {
      try {
        await firstValueFrom(
          this.http.post(apiUrl('/api/v1/auth/logout'), { refreshToken }, { context: skipAuth() }),
        );
      } catch {
        // The session is ending either way; a failed revoke is not worth blocking the person.
      }
    }

    this.session.clear();
    await this.router.navigate(['/sign-in']);
  }

  /** Where this role belongs after signing in. */
  async goHome(): Promise<void> {
    const role = this.session.role();

    await this.router.navigateByUrl(role ? homeRouteFor(role) : '/sign-in');
  }

  private async attemptRefresh(): Promise<boolean> {
    const refreshToken = this.session.refreshToken();

    if (!refreshToken) {
      return false;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<AuthenticationResponse>(
          apiUrl('/api/v1/auth/refresh'),
          { refreshToken },
          { context: skipAuth() },
        ),
      );

      this.session.start(response);

      return true;
    } catch {
      this.session.clear();

      return false;
    }
  }
}
