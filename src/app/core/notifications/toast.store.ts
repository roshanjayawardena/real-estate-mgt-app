import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly message: string;
}

/** Short-lived messages: what happened, and whether it worked. */
@Injectable({ providedIn: 'root' })
export class ToastStore {
  private nextId = 1;

  readonly toasts = signal<readonly Toast[]>([]);

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  dismiss(id: number): void {
    this.toasts.update((current) => current.filter((toast) => toast.id !== id));
  }

  private push(kind: ToastKind, message: string): void {
    const id = this.nextId++;

    this.toasts.update((current) => [...current, { id, kind, message }]);

    // An error stays long enough to be read and copied; a success does not need to linger.
    setTimeout(() => this.dismiss(id), kind === 'error' ? 8000 : 4000);
  }
}
