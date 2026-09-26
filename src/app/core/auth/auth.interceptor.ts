import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { AuthService, SKIP_AUTH } from './auth.service';
import { SessionStore } from './session.store';

/**
 * Attaches the session to every request, and rescues the one case worth rescuing: an access token
 * that expired mid-session. One refresh, one retry, then the person signs in again.
 *
 * The X-Tenant header goes out alongside the token. The server treats the token's claim as the
 * authority and refuses a header that disagrees with it (NFR-02), so this is a convenience for the
 * server's resolution, never a way to reach another agency.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(SKIP_AUTH)) {
    return next(request);
  }

  const session = inject(SessionStore);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(authorize(request, session)).pipe(
    catchError((error: unknown) => {
      const isExpiredToken = error instanceof HttpErrorResponse && error.status === 401;

      if (!isExpiredToken || !session.refreshToken()) {
        return throwError(() => error);
      }

      return from(auth.refresh()).pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            void router.navigate(['/sign-in']);

            return throwError(() => error);
          }

          return next(authorize(request, session));
        }),
      );
    }),
  );
};

function authorize(request: HttpRequest<unknown>, session: SessionStore): HttpRequest<unknown> {
  const token = session.accessToken();

  if (!token) {
    return request;
  }

  const agencyId = session.agencyId();

  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
      ...(agencyId ? { 'X-Tenant': agencyId } : {}),
    },
  });
}
