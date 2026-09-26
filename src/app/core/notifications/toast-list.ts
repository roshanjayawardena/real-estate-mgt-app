import { Component, inject } from '@angular/core';

import { ToastStore } from './toast.store';

@Component({
  selector: 'app-toast-list',
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast--' + toast.kind">
          <span>{{ toast.message }}</span>
          <button type="button" class="close" aria-label="Dismiss" (click)="toasts.dismiss(toast.id)">
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 50;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: min(420px, calc(100vw - 40px));
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow);
      background: var(--surface);
      border-left: 3px solid var(--ink-faint);
      animation: rise 140ms ease-out;
    }

    .toast--success {
      border-left-color: var(--ok);
    }

    .toast--error {
      border-left-color: var(--bad);
    }

    .toast--info {
      border-left-color: var(--brand);
    }

    .close {
      border: none;
      background: none;
      color: var(--ink-faint);
      font-size: 1.125rem;
      line-height: 1;
      cursor: pointer;
    }

    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
  `,
})
export class ToastList {
  protected readonly toasts = inject(ToastStore);
}
