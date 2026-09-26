import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { apiUrl } from '../../core/api/api';
import { Permissions } from '../../core/auth/auth.model';
import { SessionStore } from '../../core/auth/session.store';
import { ToastStore } from '../../core/notifications/toast.store';
import { AuDatePipe, HumanisePipe, MoneyPipe, today } from '../../shared/format';
import { PageHeader, StateNote } from '../../shared/page';
import { StatusBadge } from '../../shared/status-badge';
import { Agreement, PropertiesService, Property } from './properties.api';

/**
 * PRP-03 and PRP-05. One property: what it is, who owns it, and on what terms we manage it.
 *
 * The management agreement is the important part of this screen — until it is signed, Payments
 * has no fee terms and Leasing will not let the property be let.
 */
@Component({
  selector: 'app-property-detail',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    PageHeader,
    StateNote,
    StatusBadge,
    MoneyPipe,
    AuDatePipe,
    HumanisePipe,
  ],
  templateUrl: './property-detail.html',
  styleUrl: './property-detail.scss',
})
export class PropertyDetail {
  /** Bound from the route, so the resources refetch when the id changes. */
  readonly propertyId = input.required<string>();

  private readonly properties = inject(PropertiesService);
  private readonly toasts = inject(ToastStore);
  private readonly session = inject(SessionStore);

  protected readonly canManage = this.session.has(Permissions.propertiesManage);
  protected readonly saving = signal(false);
  protected readonly editingTerms = signal(false);

  protected readonly property = httpResource<Property>(() =>
    apiUrl(`/api/v1/properties/${this.propertyId()}`),
  );

  /** 404 here is a normal answer: a property can be managed without an agreement yet. */
  protected readonly agreement = httpResource<Agreement>(() =>
    apiUrl(`/api/v1/properties/${this.propertyId()}/agreement`),
  );

  protected readonly hasAgreement = computed(() => this.agreement.value() != null);

  protected readonly ownership = computed(() =>
    (this.property.value()?.owners ?? []).reduce((total, owner) => total + owner.share, 0),
  );

  protected readonly termsForm = inject(FormBuilder).nonNullable.group({
    commissionRate: [6.5, [Validators.required, Validators.min(0), Validators.max(20)]],
    maintenanceApprovalLimit: [500, [Validators.required, Validators.min(0)]],
    startDate: [today(), [Validators.required]],
  });

  protected startEditingTerms(): void {
    const current = this.agreement.value();

    if (current) {
      this.termsForm.patchValue({
        commissionRate: current.commissionRate,
        maintenanceApprovalLimit: current.maintenanceApprovalLimit,
        startDate: current.startDate,
      });
    }

    this.editingTerms.set(true);
  }

  /**
   * Signing publishes the terms to Payments and Maintenance; amending replaces them from here on.
   * Both are the same form, because to a property manager they are the same conversation.
   */
  protected async saveTerms(): Promise<void> {
    if (this.termsForm.invalid || this.saving()) {
      this.termsForm.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    const { commissionRate, maintenanceApprovalLimit, startDate } = this.termsForm.getRawValue();

    try {
      if (this.hasAgreement()) {
        await firstValueFrom(
          this.properties.amendAgreement(this.propertyId(), { commissionRate, maintenanceApprovalLimit }),
        );
        this.toasts.success('The agreement terms have been amended.');
      } else {
        await firstValueFrom(
          this.properties.signAgreement(this.propertyId(), {
            commissionRate,
            maintenanceApprovalLimit,
            startDate,
            endDate: null,
          }),
        );
        this.toasts.success('The management agreement is signed.');
      }

      this.editingTerms.set(false);
      this.agreement.reload();
      this.property.reload();
    } catch {
      // The error interceptor has already said what went wrong.
    } finally {
      this.saving.set(false);
    }
  }
}
