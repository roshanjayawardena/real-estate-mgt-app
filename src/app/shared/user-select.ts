import { httpResource } from '@angular/common/http';
import { Component, computed, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PagedList, apiUrl } from '../core/api/api';
import { Role } from '../core/auth/auth.model';
import { StateNote } from './page';

interface Person {
  readonly userId: string;
  readonly fullName: string;
  readonly email: string;
  readonly role: string;
}

/**
 * Picks people by name, and hands back their ids.
 *
 * A tenancy stores the renters' user ids and a property stores its owners' — which is correct, and
 * which nobody should ever type. This asks the API for the agency's users in a role and lets the
 * person choose; the id never appears on screen.
 */
@Component({
  selector: 'app-user-select',
  imports: [RouterLink, StateNote],
  template: `
    @if (people.isLoading()) {
      <app-state-note>Loading…</app-state-note>
    } @else if (people.error()) {
      <app-state-note tone="bad">The list of people could not be loaded.</app-state-note>
    } @else if (options().length === 0) {
      <p class="empty">
        Nobody with the {{ role() }} role yet.
        <a routerLink="/people">Invite one from People</a>, then come back.
      </p>
    } @else {
      <ul class="people">
        @for (person of options(); track person.userId) {
          <li>
            <label>
              <input
                [type]="multiple() ? 'checkbox' : 'radio'"
                [name]="'user-select-' + role()"
                [checked]="isChosen(person.userId)"
                (change)="toggle(person.userId, $any($event.target).checked)"
              />
              <span class="who">
                <strong>{{ person.fullName }}</strong>
                <small class="muted">{{ person.email }}</small>
              </span>
            </label>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .people {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 2px;
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--surface);
    }

    label {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      cursor: pointer;
    }

    label:hover {
      background: var(--surface-sunken);
    }

    input {
      width: auto;
      margin: 0;
    }

    .who {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }

    .who small {
      font-size: 0.8125rem;
    }

    .empty {
      margin: 0;
      padding: 12px;
      border: 1px dashed var(--line);
      border-radius: var(--radius-sm);
      color: var(--ink-faint);
      font-size: 0.9375rem;
    }
  `,
})
export class UserSelect {
  /** Which role to offer: Tenant for a tenancy, Owner for a property. */
  readonly role = input.required<Role>();

  /** A tenancy can be in several names; a single owner row cannot. */
  readonly multiple = input(false);

  /** Two-way bound: the chosen user ids. */
  readonly selected = model<string[]>([]);

  protected readonly people = httpResource<PagedList<Person>>(() =>
    apiUrl(`/api/v1/users?role=${this.role()}&pageSize=100`),
  );

  protected readonly options = computed(() => this.people.value()?.items ?? []);

  protected isChosen(userId: string): boolean {
    return this.selected().includes(userId);
  }

  protected toggle(userId: string, checked: boolean): void {
    if (!this.multiple()) {
      this.selected.set(checked ? [userId] : []);

      return;
    }

    this.selected.update((current) =>
      checked ? [...current, userId] : current.filter((id) => id !== userId),
    );
  }
}
