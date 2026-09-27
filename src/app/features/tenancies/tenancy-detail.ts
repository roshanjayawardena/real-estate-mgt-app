import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';

import { apiUrl, describeFailure } from '../../core/api/api';
import { Permissions } from '../../core/auth/auth.model';
import { SessionStore } from '../../core/auth/session.store';
import { ToastStore } from '../../core/notifications/toast.store';
import { LedgerTable } from '../payments/ledger-table';
import { LedgerStatement } from '../payments/payments.api';
import { RecordPayment } from '../payments/record-payment';
import { Property } from '../properties/properties.api';
import { AuDatePipe, HumanisePipe, MoneyPipe, today } from '../../shared/format';
import { FormError, PageHeader, StateNote } from '../../shared/page';
import { StatusBadge } from '../../shared/status-badge';
import { RentIncreaseEligibility, Tenancy, TenanciesService } from './tenancies.api';

type Panel = 'bond' | 'lodge' | 'increase' | 'notice' | 'renew' | 'payment' | null;

/**
 * The tenancy, and everything a property manager does to one: bond, activation, rent increases,
 * notice, renewal, and taking the rent.
 *
 * Every rule behind these actions lives on the server — the four week bond cap, the twelve month
 * gap between increases, the sixty days' notice. This screen shows what the rules allow and lets
 * the server refuse the rest, rather than keeping a second copy of NSW law in TypeScript.
 */
@Component({
  selector: 'app-tenancy-detail',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    PageHeader,
    StateNote,
    FormError,
    StatusBadge,
    LedgerTable,
    RecordPayment,
    MoneyPipe,
    AuDatePipe,
    HumanisePipe,
  ],
  templateUrl: './tenancy-detail.html',
  styleUrl: './tenancy-detail.scss',
})
export class TenancyDetail {
  readonly tenancyId = input.required<string>();

  private readonly tenancies = inject(TenanciesService);
  private readonly toasts = inject(ToastStore);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly builder = inject(FormBuilder);

  protected readonly canManage = this.session.has(Permissions.tenanciesManage);
  protected readonly canRecordPayments = this.session.has(Permissions.paymentsRecord);
  protected readonly panel = signal<Panel>(null);
  protected readonly working = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected readonly tenancy = httpResource<Tenancy>(() => apiUrl(`/api/v1/tenancies/${this.tenancyId()}`));

  protected readonly property = httpResource<Property>(() => {
    const propertyId = this.tenancy.value()?.propertyId;

    return propertyId ? apiUrl(`/api/v1/properties/${propertyId}`) : undefined;
  });

  protected readonly ledger = httpResource<LedgerStatement>(() =>
    apiUrl(`/api/v1/ledgers/tenancy/${this.tenancyId()}`),
  );

  /** Only asked for when the panel is open: it is a question about rules, not part of the tenancy. */
  protected readonly eligibility = httpResource<RentIncreaseEligibility>(() =>
    this.panel() === 'increase'
      ? apiUrl(`/api/v1/tenancies/${this.tenancyId()}/rent-increase/eligibility`)
      : undefined,
  );

  protected readonly isDraft = computed(() => this.tenancy.value()?.status === 'Draft');
  protected readonly isRunning = computed(() => {
    const status = this.tenancy.value()?.status;

    return status === 'Active' || status === 'Ending';
  });

  protected readonly bondForm = this.builder.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    receivedOn: [today(), [Validators.required]],
  });

  protected readonly lodgeForm = this.builder.nonNullable.group({
    lodgedOn: [today(), [Validators.required]],
    reference: ['', [Validators.required]],
  });

  protected readonly increaseForm = this.builder.nonNullable.group({
    newWeeklyRent: [0, [Validators.required, Validators.min(0.01)]],
    effectiveFrom: ['', [Validators.required]],
  });

  protected readonly noticeForm = this.builder.nonNullable.group({
    receivedOn: [today(), [Validators.required]],
    vacateDate: ['', [Validators.required]],
    givenBy: ['Tenant', [Validators.required]],
  });

  protected readonly renewForm = this.builder.nonNullable.group({
    newEndDate: ['', [Validators.required]],
  });

  protected open(panel: Panel): void {
    this.failure.set(null);
    this.panel.set(this.panel() === panel ? null : panel);

    if (panel === 'increase') {
      const current = this.tenancy.value();

      if (current) {
        this.increaseForm.patchValue({ newWeeklyRent: current.weeklyRent });
      }
    }
  }

  /** Every action is the same shape: call, say what happened, reload what moved. */
  private async run<T>(work: Observable<T>, message: string): Promise<void> {
    if (this.working()) {
      return;
    }

    this.working.set(true);
    this.failure.set(null);

    try {
      await firstValueFrom(work);

      this.toasts.success(message);
      this.panel.set(null);
      this.tenancy.reload();
    } catch (error) {
      // The panel stays open with the reason on it: a refused bond or a rent increase that is too
      // soon is something the person can correct in place.
      this.failure.set(describeFailure(error, 'That could not be saved.'));
    } finally {
      this.working.set(false);
    }
  }

  protected activate(): void {
    void this.run(this.tenancies.activate(this.tenancyId()), 'The tenancy is active. Rent will start being charged.');
  }

  protected recordBond(): void {
    if (this.bondForm.invalid) {
      this.bondForm.markAllAsTouched();
      this.failure.set('Enter the bond amount and the date it was received.');

      return;
    }

    const { amount, receivedOn } = this.bondForm.getRawValue();

    void this.run(
      this.tenancies.recordBond(this.tenancyId(), amount, receivedOn),
      'Bond recorded. It must reach the authority within ten working days.',
    );
  }

  protected lodgeBond(): void {
    if (this.lodgeForm.invalid) {
      this.lodgeForm.markAllAsTouched();
      this.failure.set('Enter the lodgement date and the authority reference.');

      return;
    }

    const { lodgedOn, reference } = this.lodgeForm.getRawValue();

    void this.run(this.tenancies.lodgeBond(this.tenancyId(), lodgedOn, reference), 'Bond lodgement recorded.');
  }

  protected scheduleIncrease(): void {
    if (this.increaseForm.invalid) {
      this.increaseForm.markAllAsTouched();
      this.failure.set('Enter the new weekly rent and the date it takes effect.');

      return;
    }

    const { newWeeklyRent, effectiveFrom } = this.increaseForm.getRawValue();

    void this.run(
      this.tenancies.scheduleRentIncrease(this.tenancyId(), newWeeklyRent, effectiveFrom),
      'Rent increase scheduled. The new rent applies from the effective date.',
    );
  }

  protected giveNotice(): void {
    if (this.noticeForm.invalid) {
      this.noticeForm.markAllAsTouched();
      this.failure.set('Enter both dates and who gave notice.');

      return;
    }

    void this.run(
      this.tenancies.giveNotice(this.tenancyId(), this.noticeForm.getRawValue()),
      'Notice recorded. The tenancy is ending.',
    );
  }

  protected renew(): void {
    if (this.renewForm.invalid) {
      this.renewForm.markAllAsTouched();
      this.failure.set('Enter the new end date.');

      return;
    }

    void this.run(
      this.tenancies.renew(this.tenancyId(), this.renewForm.getRawValue().newEndDate),
      'The fixed term has been extended.',
    );
  }

  protected async end(): Promise<void> {
    if (!confirm('End this tenancy today? The property becomes vacant and rent stops being charged.')) {
      return;
    }

    try {
      await firstValueFrom(this.tenancies.end(this.tenancyId(), today()));

      this.toasts.success('The tenancy has ended.');
      await this.router.navigate(['/tenancies']);
    } catch {
      // Announced by the error interceptor.
    }
  }

  protected onPaymentRecorded(): void {
    // The receipt moved the ledger here and the paid-to date in Leasing.
    this.ledger.reload();
    this.tenancy.reload();
  }
}
