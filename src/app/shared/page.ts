import { Component, input } from '@angular/core';

/** The heading block every screen opens with: what this page is, and what can be done from it. */
@Component({
  selector: 'app-page-header',
  template: `
    <header class="header">
      <div>
        <h1>{{ heading() }}</h1>
        @if (subheading()) {
          <p class="muted">{{ subheading() }}</p>
        }
      </div>
      <div class="row"><ng-content /></div>
    </header>
  `,
  styles: `
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    p {
      margin: 4px 0 0;
    }
  `,
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly subheading = input<string>();
}

/** Loading, failed and empty all look the same to a person: nothing is there yet, and here is why. */
@Component({
  selector: 'app-state-note',
  template: `
    <p class="note" [class.note--bad]="tone() === 'bad'">
      <ng-content />
    </p>
  `,
  styles: `
    .note {
      margin: 0;
      padding: 28px 20px;
      text-align: center;
      color: var(--ink-faint);
    }

    .note--bad {
      color: var(--bad);
    }
  `,
})
export class StateNote {
  readonly tone = input<'quiet' | 'bad'>('quiet');
}
