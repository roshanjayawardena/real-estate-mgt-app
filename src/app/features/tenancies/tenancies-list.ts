import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PagedList, apiUrl, valueOrNull } from '../../core/api/api';
import { Permissions } from '../../core/auth/auth.model';
import { SessionStore } from '../../core/auth/session.store';
import { AuDatePipe, HumanisePipe, MoneyPipe } from '../../shared/format';
import { PageHeader, StateNote } from '../../shared/page';
import { StatusBadge } from '../../shared/status-badge';
import { TenancyListItem } from './tenancies.api';

/**
 * TEN-02 and TEN-05. The tenancy list, and the arrears board, which is the same query with the
 * filter fixed — a property manager's morning starts on the second one.
 */
@Component({
  selector: 'app-tenancies-list',
  imports: [RouterLink, PageHeader, StateNote, StatusBadge, MoneyPipe, AuDatePipe, HumanisePipe],
  templateUrl: './tenancies-list.html',
})
export class TenanciesList {
  /** Set by the route: the arrears board is this list with one filter pinned on. */
  readonly arrearsOnly = input(false);

  private readonly session = inject(SessionStore);

  protected readonly page = signal(1);
  protected readonly status = signal('');
  protected readonly canManage = this.session.has(Permissions.tenanciesManage);

  protected readonly tenancies = httpResource<PagedList<TenancyListItem>>(() => {
    const parameters = new URLSearchParams({ page: `${this.page()}`, pageSize: '25' });

    if (this.arrearsOnly()) {
      parameters.set('inArrearsOnly', 'true');
    } else if (this.status()) {
      parameters.set('status', this.status());
    }

    return apiUrl(`/api/v1/tenancies?${parameters}`);
  });

  protected readonly items = computed(() => valueOrNull(this.tenancies)?.items ?? []);
  protected readonly total = computed(() => valueOrNull(this.tenancies)?.total ?? 0);
  protected readonly hasPrevious = computed(() => valueOrNull(this.tenancies)?.hasPrevious ?? false);
  protected readonly hasNext = computed(() => valueOrNull(this.tenancies)?.hasNext ?? false);

  protected readonly owed = computed(() =>
    this.items().reduce((total, tenancy) => total + tenancy.amountOwing, 0),
  );

  protected onStatus(value: string): void {
    this.page.set(1);
    this.status.set(value);
  }

  protected step(by: number): void {
    this.page.update((current) => Math.max(1, current + by));
  }
}
