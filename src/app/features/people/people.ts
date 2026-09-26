import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PagedList, apiUrl } from '../../core/api/api';
import { Permissions } from '../../core/auth/auth.model';
import { SessionStore } from '../../core/auth/session.store';
import { ToastStore } from '../../core/notifications/toast.store';
import { AuDatePipe, HumanisePipe } from '../../shared/format';
import { PageHeader, StateNote } from '../../shared/page';
import { StatusBadge } from '../../shared/status-badge';

export interface Person {
  readonly userId: string;
  readonly fullName: string;
  readonly email: string;
  readonly role: string;
  readonly isActive: boolean;
  readonly lastLoginAtUtc: string | null;
}

export interface PendingInvitation {
  readonly invitationId: string;
  readonly email: string;
  readonly role: string;
  readonly expiresAtUtc: string;
  readonly hasExpired: boolean;
}

/**
 * IDN-03 and IDN-05. The agency's people: who can sign in, and who has been asked to.
 *
 * The user id is shown on purpose. Owners are attached to a property and renters to a tenancy by
 * id, so this is the screen a property manager copies from — until those forms grow a picker of
 * their own, this is what makes the rest of the app usable.
 */
@Component({
  selector: 'app-people',
  imports: [ReactiveFormsModule, PageHeader, StateNote, StatusBadge, AuDatePipe, HumanisePipe],
  templateUrl: './people.html',
  styleUrl: './people.scss',
})
export class People {
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastStore);
  private readonly session = inject(SessionStore);

  protected readonly canInvite = this.session.has(Permissions.usersInvite);
  protected readonly roles = ['PropertyManager', 'Owner', 'Tenant', 'Supplier'] as const;

  protected readonly inviting = signal(false);
  protected readonly saving = signal(false);
  protected readonly roleFilter = signal('');
  protected readonly search = signal('');

  protected readonly people = httpResource<PagedList<Person>>(() => {
    const parameters = new URLSearchParams({ pageSize: '100' });
    const search = this.search().trim();

    if (search) {
      parameters.set('search', search);
    }

    if (this.roleFilter()) {
      parameters.set('role', this.roleFilter());
    }

    return apiUrl(`/api/v1/users?${parameters}`);
  });

  protected readonly invitations = httpResource<PendingInvitation[]>(
    () => (this.canInvite ? apiUrl('/api/v1/invitations') : undefined),
    { defaultValue: [] },
  );

  protected readonly items = computed(() => this.people.value()?.items ?? []);
  protected readonly total = computed(() => this.people.value()?.total ?? 0);
  protected readonly pending = computed(() => this.invitations.value());

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    role: ['Owner', [Validators.required]],
  });

  protected async invite(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);

    try {
      await firstValueFrom(
        this.http.post(apiUrl('/api/v1/invitations'), { ...this.form.getRawValue(), linkedEntityId: null }),
      );

      // Notifications sends the email; until that module exists the invitation is visible here and
      // the link has to be handed over another way.
      this.toasts.success('Invitation sent. It is valid for seven days.');
      this.form.reset({ role: this.form.getRawValue().role });
      this.inviting.set(false);
      this.invitations.reload();
    } catch {
      // Announced by the error interceptor.
    } finally {
      this.saving.set(false);
    }
  }

  protected async copyId(userId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(userId);
      this.toasts.info('User id copied.');
    } catch {
      this.toasts.error('The clipboard is not available here.');
    }
  }

  protected onSearch(value: string): void {
    this.search.set(value);
  }

  protected onRole(value: string): void {
    this.roleFilter.set(value);
  }
}
