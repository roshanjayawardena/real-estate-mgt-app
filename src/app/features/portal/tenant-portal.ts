import { httpResource } from '@angular/common/http';
import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

import { apiUrl } from '../../core/api/api';
import { LedgerTable } from '../payments/ledger-table';
import { LedgerStatement } from '../payments/payments.api';
import { Tenancy } from '../tenancies/tenancies.api';
import { AuDatePipe, HumanisePipe, MoneyPipe } from '../../shared/format';
import { PageHeader, StateNote } from '../../shared/page';
import { StatusBadge } from '../../shared/status-badge';

/**
 * TEN-08. What a renter sees: their tenancy, what they owe, and every line of their ledger.
 *
 * The renter never passes an id — the API answers from their token, so there is nothing here to
 * change in a URL to see somebody else's tenancy.
 */
@Component({
  selector: 'app-tenant-portal',
  imports: [PageHeader, StateNote, StatusBadge, MoneyPipe, AuDatePipe, HumanisePipe],
  templateUrl: './tenant-portal.html',
  styleUrl: './portal.scss',
})
export class TenantPortal {
  protected readonly tenancy = httpResource<Tenancy>(() => apiUrl('/api/v1/portal/tenancy'));

  protected readonly owing = computed(() => this.tenancy.value()?.amountOwing ?? 0);
}

/** The same ledger the agency sees, from the renter's side. */
@Component({
  selector: 'app-tenant-ledger',
  imports: [RouterLink, PageHeader, StateNote, LedgerTable, MoneyPipe],
  template: `
    <app-page-header heading="My rent ledger" subheading="Every charge, payment and adjustment.">
      <a class="button button--quiet" routerLink="/portal/tenancy">My tenancy</a>
    </app-page-header>

    <section class="card">
      @if (ledger.value(); as statement) {
        <div class="card__header">
          <h2>Statement</h2>
          <strong>Balance {{ statement.balance | money }}</strong>
        </div>
        <app-ledger-table [entries]="statement.entries" />
      } @else if (ledger.isLoading()) {
        <app-state-note>Loading your ledger…</app-state-note>
      } @else {
        <app-state-note tone="bad">No ledger was found for your tenancy.</app-state-note>
      }
    </section>
  `,
})
export class TenantLedger {
  protected readonly ledger = httpResource<LedgerStatement>(() => apiUrl('/api/v1/portal/ledger'));
}
