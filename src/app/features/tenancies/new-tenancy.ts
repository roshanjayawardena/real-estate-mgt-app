import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PagedList, apiUrl, describeFailure, valueOrNull } from '../../core/api/api';
import { ToastStore } from '../../core/notifications/toast.store';
import { PropertyListItem } from '../properties/properties.api';
import { today } from '../../shared/format';
import { FormError, PageHeader } from '../../shared/page';
import { UserSelect } from '../../shared/user-select';
import { TenanciesService, paymentFrequencies } from './tenancies.api';

/**
 * TEN-01. A tenancy starts as a draft: nothing is charged and no ledger exists until the bond is
 * recorded and it is activated, which is the order the law expects.
 */
@Component({
  selector: 'app-new-tenancy',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, FormError, UserSelect],
  templateUrl: './new-tenancy.html',
  styles: `
    form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0 20px;
    }

    .wide {
      grid-column: 1 / -1;
    }
  `,
})
export class NewTenancy {
  private readonly tenancies = inject(TenanciesService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastStore);

  protected readonly frequencies = paymentFrequencies;
  protected readonly saving = signal(false);
  protected readonly failure = signal<string | null>(null);

  /**
   * Vacant *and* managed. Leasing refuses a tenancy on a property with no active agreement, so
   * offering one here would only produce a 422 two clicks later.
   */
  protected readonly properties = httpResource<PagedList<PropertyListItem>>(() =>
    apiUrl('/api/v1/properties?status=Vacant&managedOnly=true&pageSize=100'),
  );

  protected readonly options = computed(() => valueOrNull(this.properties)?.items ?? []);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    propertyId: ['', [Validators.required]],
    // Ids, chosen by name in the picker. Angular's required rejects an empty array.
    tenantUserIds: [[] as string[], [Validators.required]],
    startDate: [today(), [Validators.required]],
    endDate: ['', [Validators.required]],
    weeklyRent: [0, [Validators.required, Validators.min(0.01)]],
    frequency: ['Fortnightly', [Validators.required]],
  });

  protected async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }

    // Touch everything so the messages appear, and say so above the button: a click that silently
    // does nothing reads as a broken page.
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.failure.set('Check the highlighted fields and try again.');

      return;
    }

    this.saving.set(true);
    this.failure.set(null);
    const value = this.form.getRawValue();

    try {
      const created = await firstValueFrom(
        this.tenancies.create(value),
      );

      this.toasts.success('Draft tenancy created. Record the bond, then activate it.');
      await this.router.navigate(['/tenancies', created.id]);
    } catch (error) {
      // 400 never reaches a toast, by design — the form is where the message belongs.
      this.failure.set(describeFailure(error, 'The tenancy could not be created.'));
    } finally {
      this.saving.set(false);
    }
  }
}
