import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PagedList, apiUrl, valueOrNull } from '../../core/api/api';
import { SessionStore } from '../../core/auth/session.store';
import { PropertyListItem } from '../properties/properties.api';
import { TenancyListItem } from '../tenancies/tenancies.api';
import { AuDatePipe, MoneyPipe } from '../../shared/format';
import { PageHeader, StateNote } from '../../shared/page';
import { StatusBadge } from '../../shared/status-badge';

/**
 * A property manager's morning: what is behind on rent, and how the portfolio sits.
 *
 * The counts come from the totals the list endpoints already return, so the dashboard adds no
 * endpoints of its own and cannot drift from the lists it links to.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, PageHeader, StateNote, StatusBadge, MoneyPipe, AuDatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly session = inject(SessionStore);

  private readonly arrears = httpResource<PagedList<TenancyListItem>>(() =>
    apiUrl('/api/v1/tenancies/arrears?pageSize=8'),
  );

  private readonly leased = httpResource<PagedList<PropertyListItem>>(() =>
    apiUrl('/api/v1/properties?status=Leased&pageSize=1'),
  );

  private readonly vacant = httpResource<PagedList<PropertyListItem>>(() =>
    apiUrl('/api/v1/properties?status=Vacant&pageSize=1'),
  );

  protected readonly behind = computed(() => valueOrNull(this.arrears)?.items ?? []);
  protected readonly behindCount = computed(() => valueOrNull(this.arrears)?.total ?? 0);
  protected readonly leasedCount = computed(() => valueOrNull(this.leased)?.total ?? 0);
  protected readonly vacantCount = computed(() => valueOrNull(this.vacant)?.total ?? 0);
  protected readonly loading = computed(() => this.arrears.isLoading() || this.leased.isLoading());

  protected readonly occupancy = computed(() => {
    const total = this.leasedCount() + this.vacantCount();

    return total === 0 ? 0 : Math.round((this.leasedCount() / total) * 100);
  });

  protected readonly owed = computed(() =>
    this.behind().reduce((total, tenancy) => total + tenancy.amountOwing, 0),
  );
}
