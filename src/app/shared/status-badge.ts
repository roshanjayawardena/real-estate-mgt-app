import { Component, computed, input } from '@angular/core';

import { HumanisePipe } from './format';

type Tone = 'neutral' | 'good' | 'warn' | 'bad';

/**
 * A status word, coloured by what it means rather than by what it says, so "Notice14" reads as
 * trouble and "Active" does not.
 */
@Component({
  selector: 'app-status-badge',
  imports: [HumanisePipe],
  template: `<span class="badge" [class]="'badge--' + tone()">{{ status() | humanise }}</span>`,
  styles: `
    .badge {
      display: inline-block;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 0.8125rem;
      font-weight: 500;
      white-space: nowrap;
    }

    .badge--neutral {
      background: var(--surface-sunken);
      color: var(--ink-soft);
      box-shadow: inset 0 0 0 1px var(--line);
    }

    .badge--good {
      background: var(--ok-wash);
      color: var(--ok);
    }

    .badge--warn {
      background: var(--warn-wash);
      color: var(--warn);
    }

    .badge--bad {
      background: var(--bad-wash);
      color: var(--bad);
    }
  `,
})
export class StatusBadge {
  readonly status = input.required<string>();

  readonly tone = computed<Tone>(() => {
    switch (this.status()) {
      case 'Active':
      case 'Leased':
      case 'Lodged':
      case 'Signed':
      case 'Recorded':
      case 'None':
      case 'Paid':
        return 'good';
      case 'Ending':
      case 'Reminder3':
      case 'Reminder7':
      case 'Draft':
      case 'Held':
      case 'Pending':
      case 'Vacant':
        return 'warn';
      case 'Notice14':
      case 'Suspended':
      case 'Reversed':
      case 'Overdue':
      case 'Archived':
        return 'bad';
      default:
        return 'neutral';
    }
  });
}
