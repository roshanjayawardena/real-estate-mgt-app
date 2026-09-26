import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ToastStore } from '../../core/notifications/toast.store';
import { MoneyPipe, today } from '../../shared/format';
import { PaymentsService, Receipt, paymentMethods } from './payments.api';

/**
 * PAY-02 and PAY-03. Taking rent: the amount, how it arrived, and the day it arrived — which is
 * not always today, and matters, because it is what the receipt and the ledger will say.
 *
 * The idempotency key is minted once per attempt and reused if the person presses the button
 * again, so a slow network cannot produce two receipts for one payment.
 */
@Component({
  selector: 'app-record-payment',
  imports: [ReactiveFormsModule, MoneyPipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="field">
        <label class="field__label" for="amount">Amount received</label>
        <input id="amount" type="number" step="0.01" min="0.01" formControlName="amount" />
      </div>

      <div class="field">
        <label class="field__label" for="method">Method</label>
        <select id="method" formControlName="method">
          @for (method of methods; track method) {
            <option [value]="method">{{ method }}</option>
          }
        </select>
      </div>

      <div class="field">
        <label class="field__label" for="paidOn">Received on</label>
        <input id="paidOn" type="date" formControlName="paidOn" />
      </div>

      <div class="row row--end actions">
        <button type="submit" class="button" [disabled]="saving()">
          {{ saving() ? 'Recording…' : 'Record payment' }}
        </button>
      </div>
    </form>

    @if (receipt(); as issued) {
      <div class="receipt">
        <h3>Receipt {{ issued.receiptNumber }}</h3>
        <p class="muted">{{ issued.amount | money }} received. The renter's balance is now {{ issued.renterBalance | money }}.</p>
        <dl>
          <div><dt>Commission</dt><dd>{{ issued.commission | money }}</dd></div>
          <div><dt>GST on the fee</dt><dd>{{ issued.gst | money }}</dd></div>
          <div><dt>Net to owners</dt><dd>{{ issued.netToOwners | money }}</dd></div>
        </dl>
      </div>
    }
  `,
  styles: `
    form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0 16px;
    }

    .actions {
      grid-column: 1 / -1;
    }

    .receipt {
      margin-top: 16px;
      padding: 16px;
      border-radius: var(--radius-sm);
      background: var(--ok-wash);
    }

    .receipt h3 {
      color: var(--ok);
    }

    .receipt p {
      margin: 4px 0 12px;
    }

    dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin: 0;
    }

    dt {
      font-size: 0.8125rem;
      color: var(--ink-soft);
    }

    dd {
      margin: 0;
      font-weight: 600;
    }
  `,
})
export class RecordPayment {
  readonly tenancyId = input.required<string>();

  /** The tenancy and its ledger both move when rent lands, so the parent reloads them. */
  readonly recorded = output<Receipt>();

  private readonly payments = inject(PaymentsService);
  private readonly toasts = inject(ToastStore);

  protected readonly methods = paymentMethods;
  protected readonly saving = signal(false);
  protected readonly receipt = signal<Receipt | null>(null);

  private idempotencyKey = crypto.randomUUID();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: ['BankTransfer', [Validators.required]],
    paidOn: [today(), [Validators.required]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    const { amount, method, paidOn } = this.form.getRawValue();

    try {
      const issued = await firstValueFrom(
        this.payments.recordRent({ tenancyId: this.tenancyId(), amount, method, paidOn }, this.idempotencyKey),
      );

      this.receipt.set(issued);
      this.toasts.success(`Receipt ${issued.receiptNumber} issued.`);
      this.recorded.emit(issued);

      // That payment is done with; the next one is a new attempt and needs its own key.
      this.idempotencyKey = crypto.randomUUID();
      this.form.patchValue({ amount: 0 });
      this.form.markAsUntouched();
    } catch {
      // Announced by the error interceptor. The key is kept, so pressing again retries the same
      // payment rather than starting a second one.
    } finally {
      this.saving.set(false);
    }
  }
}
