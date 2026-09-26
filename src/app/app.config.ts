import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { errorInterceptor } from './core/api/error.interceptor';
import { authInterceptor } from './core/auth/auth.interceptor';
import { routes } from './app.routes';

/**
 * The application's wiring. Zoneless by default in Angular 21, so change detection follows the
 * signals rather than patched browser APIs.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // Route params and data arrive as component inputs, so a screen reads :tenancyId as a signal.
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(
      withFetch(),
      // Order matters: the error interceptor is outermost, so it sees a 401 only once the auth
      // interceptor has given up on refreshing it.
      withInterceptors([errorInterceptor, authInterceptor]),
    ),
  ],
};
