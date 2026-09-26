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
