import { Component, input } from '@angular/core';

import { AuDatePipe, HumanisePipe, MoneyPipe } from '../../shared/format';
import { StateNote } from '../../shared/page';
import { LedgerEntry } from './payments.api';

/**
 * PAY-04. A statement, read the way a ledger is read: oldest first, with the balance after every
 * line as it stood when the line was posted.
 *
 * A reversed line is struck through rather than removed, because it did happen, and the reversal
 * sits underneath it (BR-11).
 */
@Component({
  selector: 'app-ledger-table',
  imports: [StateNote, MoneyPipe, AuDatePipe, HumanisePipe],
  template: `
    @if (entries().length === 0) {
      <app-state-note>Nothing posted to this ledger yet.</app-state-note>
    } @else {
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Reference</th>
            <th scope="col">Description</th>
            <th scope="col" class="numeric">Debit</th>
            <th scope="col" class="numeric">Credit</th>
            <th scope="col" class="numeric">Balance</th>
          </tr>
        </thead>
        <tbody>
          @for (entry of entries(); track entry.id) {
            <tr [class.is-reversed]="entry.isReversed" [class.is-reversal]="entry.isReversal">
              <td>{{ entry.entryDate | auDate }}</td>
              <td class="reference">{{ entry.reference }}</td>
              <td>
                {{ entry.description }}
                <small class="muted">· {{ entry.type | humanise }}</small>
              </td>
              <td class="numeric">{{ entry.debit ? (entry.debit | money) : '' }}</td>
              <td class="numeric">{{ entry.credit ? (entry.credit | money) : '' }}</td>
              <td class="numeric strong">{{ entry.runningBalance | money }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: `
    .reference {
      font-family: var(--mono);
      font-size: 0.8125rem;
      color: var(--ink-soft);
      white-space: nowrap;
    }

    .strong {
      font-weight: 600;
    }

    .is-reversed td:not(.numeric) {
      text-decoration: line-through;
      color: var(--ink-faint);
    }

    .is-reversal {
      background: var(--bad-wash);
    }
  `,
})
export class LedgerTable {
  readonly entries = input.required<readonly LedgerEntry[]>();
}
