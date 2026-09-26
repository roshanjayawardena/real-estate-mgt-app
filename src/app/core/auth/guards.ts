import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Permission, Role, homeRouteFor } from './auth.model';
import { SessionStore } from './session.store';

/**
 * Routing is a convenience, not the security boundary: every request is authorized again on the
 * server. These guards keep a person out of screens their role has no business seeing.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return session.isAuthenticated()
    ? true
    : router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
};

export function requirePermission(...permissions: readonly Permission[]): CanActivateFn {
  return () => {
    const session = inject(SessionStore);
    const router = inject(Router);

    if (!session.isAuthenticated()) {
      return router.createUrlTree(['/sign-in']);
    }

    return session.hasAny(...permissions) ? true : elsewhere(session, router);
  };
}

export function requireRole(...roles: readonly Role[]): CanActivateFn {
  return () => {
    const session = inject(SessionStore);
    const router = inject(Router);

    if (!session.isAuthenticated()) {
      return router.createUrlTree(['/sign-in']);
    }

    return session.isRole(...roles) ? true : elsewhere(session, router);
  };
}

/** Sends a signed-in person to their own home rather than showing them a locked door. */
function elsewhere(session: SessionStore, router: Router) {
  const role = session.role();

  return router.createUrlTree([role ? homeRouteFor(role) : '/sign-in']);
}

/** The root route: each role starts somewhere different. */
export const homeRedirect: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  const role = session.role();

  return router.createUrlTree([role ? homeRouteFor(role) : '/sign-in']);
};
