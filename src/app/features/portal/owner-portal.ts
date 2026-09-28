import { httpResource } from '@angular/common/http';
import { Component, computed } from '@angular/core';

import { apiUrl, valueOrNull } from '../../core/api/api';
import { LedgerTable } from '../payments/ledger-table';
import { LedgerStatement } from '../payments/payments.api';
import { MoneyPipe } from '../../shared/format';
import { PageHeader, StateNote } from '../../shared/page';

/**
 * PAY-07 from the owner's side: one ledger per property, because that is how owners are paid and
 * reported to. Rent in, fee and GST out, and what is held for them at the bottom.
 */
@Component({
  selector: 'app-owner-portal',
  imports: [PageHeader, StateNote, LedgerTable, MoneyPipe],
  template: `
    <app-page-header
      heading="My properties"
      [subheading]="statements().length + ' managed · ' + (held() | money) + ' held'"
    />

    @if (ledgers.isLoading()) {
      <app-state-note>Loading your statements…</app-state-note>
    } @else if (ledgers.error()) {
      <app-state-note tone="bad">Your statements could not be loaded.</app-state-note>
    } @else if (statements().length === 0) {
      <app-state-note>No properties are being managed for you yet.</app-state-note>
    } @else {
      <div class="stack">
        @for (statement of statements(); track statement.ledgerId) {
          <section class="card">
            <div class="card__header">
              <h2>Property statement</h2>
              <strong>{{ statement.balance | money }} held</strong>
            </div>
            <app-ledger-table [entries]="statement.entries" />
          </section>
        }
      </div>
    }
  `,
})
export class OwnerPortal {
  protected readonly ledgers = httpResource<LedgerStatement[]>(
    () => apiUrl('/api/v1/portal/owner/ledgers'),
    { defaultValue: [] },
  );

  protected readonly statements = computed(() => valueOrNull(this.ledgers) ?? []);

  protected readonly held = computed(() =>
    this.statements().reduce((total, statement) => total + statement.balance, 0),
  );
}
