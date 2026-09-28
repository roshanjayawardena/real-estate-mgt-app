import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PagedList, apiUrl, describeFailure, valueOrNull } from '../../core/api/api';
import { Permissions } from '../../core/auth/auth.model';
import { SessionStore } from '../../core/auth/session.store';
import { ToastStore } from '../../core/notifications/toast.store';
import { AuDatePipe, HumanisePipe } from '../../shared/format';
import { FormError, PageHeader, StateNote } from '../../shared/page';
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

interface InvitationSent {
  readonly invitationId: string;
  readonly expiresAtUtc: string;
  /**
   * Only outside production, and only in this one response: the database keeps a hash, so once
   * this is gone the link cannot be recovered. It exists because Notifications — the module that
   * emails it — is Phase 2.
   */
  readonly acceptUrl: string | null;
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
  imports: [ReactiveFormsModule, PageHeader, StateNote, StatusBadge, AuDatePipe, HumanisePipe, FormError],
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
  protected readonly failure = signal<string | null>(null);

  /** The link from the last invitation, shown until it is sent or the page is left. */
  protected readonly lastLink = signal<{ email: string; url: string } | null>(null);
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

  protected readonly items = computed(() => valueOrNull(this.people)?.items ?? []);
  protected readonly total = computed(() => valueOrNull(this.people)?.total ?? 0);
  protected readonly pending = computed(() => valueOrNull(this.invitations) ?? []);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    role: ['Owner', [Validators.required]],
  });

  protected async invite(): Promise<void> {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.failure.set('A first name, last name and email address are needed.');

      return;
    }

    this.saving.set(true);
    this.failure.set(null);
    const { email, role } = this.form.getRawValue();

    try {
      const sent = await firstValueFrom(
        this.http.post<InvitationSent>(apiUrl('/api/v1/invitations'), {
          ...this.form.getRawValue(),
          linkedEntityId: null,
        }),
      );

      // Notifications is what emails the link. Until it exists the API hands it back here, once,
      // and it has to be passed on by hand.
      this.lastLink.set(sent.acceptUrl ? { email, url: sent.acceptUrl } : null);

      this.toasts.success(
        sent.acceptUrl
          ? `Invitation created for ${email}. Copy the link below — it is shown only now.`
          : `Invitation emailed to ${email}. It is valid for seven days.`,
      );

      this.form.reset({ role });
      this.inviting.set(false);
      this.invitations.reload();
    } catch (error) {
      // The common refusal is an email that already has an account at this agency.
      this.failure.set(describeFailure(error, 'The invitation could not be sent.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async copyId(userId: string): Promise<void> {
    await this.copy(userId, 'User id copied.');
  }

  protected async copyLink(url: string): Promise<void> {
    await this.copy(url, 'Invitation link copied.');
  }

  private async copy(value: string, confirmation: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.toasts.info(confirmation);
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
