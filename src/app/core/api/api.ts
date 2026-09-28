import { HttpErrorResponse } from '@angular/common/http';

import { environment } from '../../../environments/environment';

/** Every request goes through here, so the base URL is decided in exactly one place. */
export function apiUrl(path: string): string {
  return `${environment.apiBaseUrl}${path}`;
}

/** RFC 9457. What the API returns for every failure, from ResultExtensions on the server. */
export interface ProblemDetails {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  /** The domain error code, e.g. "Tenancy.PropertyAlreadyTenanted". */
  readonly code?: string;
  /** Present on validation failures: field or rule name to messages. */
  readonly errors?: Record<string, string[]>;
}

/**
 * The sentence to show a person. The API writes messages meant to be read ("Bond of $4,200 is above
 * the 4 week cap of $3,920"), so the detail is used as-is rather than being translated into
 * something vaguer.
 */
export function describeProblem(problem: ProblemDetails | null | undefined, fallback: string): string {
  if (!problem) {
    return fallback;
  }

  if (problem.errors) {
    const messages = Object.values(problem.errors).flat();

    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  return problem.detail ?? problem.title ?? fallback;
}

/**
 * What a form shows when its request failed.
 *
 * The error interceptor deliberately leaves 400 alone so the form that caused it can put the
 * message where the person is looking. This is how a form does that: one sentence, from the
 * server's own words where it has them.
 */
export function describeFailure(error: unknown, fallback = 'That did not work.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.status === 0) {
    return 'The API did not respond. Check that it is running.';
  }

  if (error.status === 403) {
    return describeProblem(error.error as ProblemDetails, 'You do not have access to that.');
  }

  if (error.status >= 500) {
    return 'Something went wrong on the server. The error has been logged.';
  }

  // 400 carries a field map, 409 and 422 carry a business rule; both read well as a sentence.
  return describeProblem(error.error as ProblemDetails, fallback);
}

/**
 * A resource's value, or null when it does not have one.
 *
 * `httpResource(...).value()` **throws** when the request failed — a 404 included. Several of
 * these endpoints answer 404 as a normal outcome: a property with no management agreement yet, a
 * tenancy whose ledger has not been opened. Reading `.value()` there kills change detection
 * partway through the view, which looks nothing like a failed request: labels render blank,
 * later bindings stop updating, and buttons appear to do nothing.
 *
 * So nothing reads `.value()` directly. This asks first.
 */
export function valueOrNull<T>(resource: { hasValue(): boolean; value(): T }): T | null {
  return resource.hasValue() ? resource.value() : null;
}

/** Every list endpoint pages (NFR-13). */
export interface PagedList<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}

export const emptyPage: PagedList<never> = {
  items: [],
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
  hasPrevious: false,
  hasNext: false,
};
