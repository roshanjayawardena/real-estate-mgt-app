import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { apiUrl, describeFailure } from '../../core/api/api';
import { Permissions } from '../../core/auth/auth.model';
import { SessionStore } from '../../core/auth/session.store';
import { ToastStore } from '../../core/notifications/toast.store';
import { AuDatePipe, HumanisePipe, MoneyPipe, today } from '../../shared/format';
import { FormError, PageHeader, StateNote } from '../../shared/page';
import { StatusBadge } from '../../shared/status-badge';
import { Agreement, OwnerShare, PropertiesService, Property } from './properties.api';

/** One row of the ownership table: who, how much of it, and whether they are the contact. */
type OwnerRow = FormGroup<{
  ownerUserId: FormControl<string>;
  share: FormControl<number>;
  isPrimaryContact: FormControl<boolean>;
}>;

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
    FormError,
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

  private readonly builder = inject(FormBuilder);

  protected readonly canManage = this.session.has(Permissions.propertiesManage);
  protected readonly saving = signal(false);
  protected readonly editingTerms = signal(false);
  protected readonly editingOwners = signal(false);
  protected readonly failure = signal<string | null>(null);

  /** The agency's owners, so a share is assigned to a person rather than to a pasted id. */
  protected readonly ownerOptions = httpResource<{ items: { userId: string; fullName: string; email: string }[] }>(
    () => apiUrl('/api/v1/users?role=Owner&pageSize=100'),
  );

  protected readonly ownerChoices = computed(() => this.ownerOptions.value()?.items ?? []);

  protected readonly property = httpResource<Property>(() =>
    apiUrl(`/api/v1/properties/${this.propertyId()}`),
  );

  /** 404 here is a normal answer: a property can be managed without an agreement yet. */
  protected readonly agreement = httpResource<Agreement>(() =>
    apiUrl(`/api/v1/properties/${this.propertyId()}/agreement`),
  );

  protected readonly hasAgreement = computed(() => this.agreement.value() != null);

  /** A name for an owner id, for the read-only table. */
  protected ownerName(ownerUserId: string): string {
    return this.ownerChoices().find((person) => person.userId === ownerUserId)?.fullName ?? ownerUserId;
  }

  protected readonly ownership = computed(() =>
    (this.property.value()?.owners ?? []).reduce((total, owner) => total + owner.share, 0),
  );

  /**
   * PRP-03. Shares have to total exactly 100: the rent is split by them, and a split that does
   * not add up is money unaccounted for. The server enforces it as well — showing the running
   * total here just means the person sees it while typing rather than after saving.
   */
  protected readonly owners = this.builder.array<OwnerRow>([]);

  protected readonly termsForm = inject(FormBuilder).nonNullable.group({
    commissionRate: [6.5, [Validators.required, Validators.min(0), Validators.max(20)]],
    maintenanceApprovalLimit: [500, [Validators.required, Validators.min(0)]],
    startDate: [today(), [Validators.required]],
  });

  private ownerRow(owner?: OwnerShare): OwnerRow {
    return this.builder.nonNullable.group({
      ownerUserId: [owner?.ownerUserId ?? '', [Validators.required]],
      share: [owner?.share ?? 100, [Validators.required, Validators.min(0.01), Validators.max(100)]],
      isPrimaryContact: [owner?.isPrimaryContact ?? false],
    });
  }

  protected shareTotal(): number {
    return this.owners.controls.reduce((total, row) => total + Number(row.getRawValue().share || 0), 0);
  }

  protected startEditingOwners(): void {
    this.failure.set(null);
    this.owners.clear();

    const current = this.property.value()?.owners ?? [];

    if (current.length === 0) {
      this.owners.push(this.ownerRow());
    } else {
      current.forEach((owner) => this.owners.push(this.ownerRow(owner)));
    }

    this.editingOwners.set(true);
  }

  protected addOwner(): void {
    this.owners.push(this.ownerRow({ ownerUserId: '', share: 0, isPrimaryContact: false }));
  }

  protected removeOwner(index: number): void {
    this.owners.removeAt(index);
  }

  /** Replaces the whole list, which is how the API models it: owners are set, not edited one by one. */
  protected async saveOwners(): Promise<void> {
    if (this.saving()) {
      return;
    }

    if (this.owners.invalid) {
      this.owners.markAllAsTouched();
      this.failure.set('Every owner needs a user id and a share.');

      return;
    }

    this.saving.set(true);
    this.failure.set(null);

    try {
      await firstValueFrom(
        this.properties.assignOwners(this.propertyId(), this.owners.getRawValue()),
      );

      this.toasts.success('Owners recorded.');
      this.editingOwners.set(false);
      this.property.reload();
    } catch (error) {
      // Including the share total the server rejects, which is the common one.
      this.failure.set(describeFailure(error, 'The owners could not be saved.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected startEditingTerms(): void {
    const current = this.agreement.value();

    if (current) {
      this.termsForm.patchValue({
        commissionRate: current.commissionRate,
        maintenanceApprovalLimit: current.maintenanceApprovalLimit,
        startDate: current.startDate,
      });
    }

    this.failure.set(null);
    this.editingTerms.set(true);
  }

  /**
   * Signing publishes the terms to Payments and Maintenance; amending replaces them from here on.
   * Both are the same form, because to a property manager they are the same conversation.
   */
  protected async saveTerms(): Promise<void> {
    if (this.saving()) {
      return;
    }

    if (this.termsForm.invalid) {
      this.termsForm.markAllAsTouched();
      this.failure.set('Check the commission rate and the approval limit.');

      return;
    }

    this.saving.set(true);
    this.failure.set(null);
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
    } catch (error) {
      this.failure.set(describeFailure(error, 'The agreement could not be saved.'));
    } finally {
      this.saving.set(false);
    }
  }
}
