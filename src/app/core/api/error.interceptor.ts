import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ToastStore } from '../notifications/toast.store';
import { ProblemDetails, describeProblem } from './api';

/**
 * One place that turns a failed request into something a person can read.
 *
 * 401 is left alone: the auth interceptor is already refreshing the session, and a toast saying
 * "unauthorised" during a refresh that then succeeds would be a lie. 400 is left to the form that
 * made the request, which can put the message against the field.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const toasts = inject(ToastStore);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && shouldAnnounce(error.status)) {
        toasts.error(messageFor(error));
      }

      return throwError(() => error);
    }),
  );
};

function shouldAnnounce(status: number): boolean {
  return status !== 401 && status !== 400;
}

function messageFor(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'The server did not respond. Check that the API is running.';
  }

  if (error.status === 403) {
    return describeProblem(error.error as ProblemDetails, 'You do not have access to that.');
  }

  if (error.status === 429) {
    return 'Too many attempts. Wait a moment and try again.';
  }

  if (error.status >= 500) {
    return 'Something went wrong on the server. The error has been logged.';
  }

  return describeProblem(error.error as ProblemDetails, 'That did not work.');
}
