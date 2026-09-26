import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PagedList, apiUrl } from '../../core/api/api';
import { ToastStore } from '../../core/notifications/toast.store';
import { PropertyListItem } from '../properties/properties.api';
import { today } from '../../shared/format';
import { PageHeader } from '../../shared/page';
import { TenanciesService, paymentFrequencies } from './tenancies.api';

/**
 * TEN-01. A tenancy starts as a draft: nothing is charged and no ledger exists until the bond is
 * recorded and it is activated, which is the order the law expects.
 */
@Component({
  selector: 'app-new-tenancy',
  imports: [ReactiveFormsModule, RouterLink, PageHeader],
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

  /** Only a vacant, managed property can be let, so that is all this list offers. */
  protected readonly properties = httpResource<PagedList<PropertyListItem>>(() =>
    apiUrl('/api/v1/properties?status=Vacant&pageSize=100'),
  );

  protected readonly options = computed(() => this.properties.value()?.items ?? []);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    propertyId: ['', [Validators.required]],
    tenantUserIds: ['', [Validators.required]],
    startDate: [today(), [Validators.required]],
    endDate: ['', [Validators.required]],
    weeklyRent: [0, [Validators.required, Validators.min(0.01)]],
    frequency: ['Fortnightly', [Validators.required]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();

    try {
      const created = await firstValueFrom(
        this.tenancies.create({
          ...value,
          tenantUserIds: value.tenantUserIds
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean),
        }),
      );

      this.toasts.success('Draft tenancy created. Record the bond, then activate it.');
      await this.router.navigate(['/tenancies', created.id]);
    } catch {
      // Announced by the error interceptor.
    } finally {
      this.saving.set(false);
    }
  }
}
