import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PagedList, apiUrl } from '../../core/api/api';
import { ToastStore } from '../../core/notifications/toast.store';
import { AuDatePipe } from '../../shared/format';
import { PageHeader, StateNote } from '../../shared/page';
import { StatusBadge } from '../../shared/status-badge';

interface AgencyListItem {
  readonly id: string;
  readonly name: string;
  readonly abn: string;
  readonly state: string;
  readonly status: string;
  readonly createdAtUtc: string;
}

interface Agency extends AgencyListItem {
  readonly licenceNumber: string;
  readonly timeZoneId: string;
  readonly contactEmail: string;
  readonly defaultCommissionRate: number;
  readonly suspensionReason: string | null;
}

/**
 * AGN-01 and AGN-02. The platform administrator's screen: the tenants of the SaaS itself.
 *
 * Creating an agency also invites its first property manager, so onboarding is one action rather
 * than two that can be half-done.
 */
@Component({
  selector: 'app-agencies',
  imports: [ReactiveFormsModule, PageHeader, StateNote, StatusBadge, AuDatePipe],
  templateUrl: './agencies.html',
  styles: `
    form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 0 20px;
    }

    .wide {
      grid-column: 1 / -1;
    }

    .id {
      font-family: var(--mono);
      font-size: 0.75rem;
      color: var(--ink-faint);
    }
  `,
})
export class Agencies {
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastStore);

  protected readonly adding = signal(false);
  protected readonly saving = signal(false);

  protected readonly agencies = httpResource<PagedList<AgencyListItem>>(() =>
    apiUrl('/api/v1/agencies?pageSize=50'),
  );

  protected readonly items = computed(() => this.agencies.value()?.items ?? []);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required]],
    abn: ['', [Validators.required]],
    licenceNumber: ['', [Validators.required]],
    state: ['NSW', [Validators.required]],
    timeZoneId: ['Australia/Sydney', [Validators.required]],
    contactEmail: ['', [Validators.required, Validators.email]],
    defaultCommissionRate: [6.5, [Validators.required, Validators.min(0), Validators.max(20)]],
    firstManagerEmail: ['', [Validators.required, Validators.email]],
  });

  protected async create(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);

    try {
      const created = await firstValueFrom(
        this.http.post<Agency>(apiUrl('/api/v1/agencies'), this.form.getRawValue()),
      );

      this.toasts.success(`${created.name} created. Their first property manager has been invited.`);
      this.form.reset();
      this.adding.set(false);
      this.agencies.reload();
    } catch {
      // Announced by the error interceptor.
    } finally {
      this.saving.set(false);
    }
  }

  protected async setStatus(agency: AgencyListItem, action: 'suspend' | 'activate'): Promise<void> {
    const body = action === 'suspend' ? { reason: 'Suspended by the platform administrator' } : {};

    try {
      await firstValueFrom(this.http.post(apiUrl(`/api/v1/agencies/${agency.id}/${action}`), body));

      this.toasts.success(`${agency.name} is now ${action === 'suspend' ? 'suspended' : 'active'}.`);
      this.agencies.reload();
    } catch {
      // Announced by the error interceptor.
    }
  }

  /** The agency id is what a person types into the sign-in form, so it is worth copying. */
  protected async copyId(agencyId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(agencyId);
      this.toasts.info('Agency id copied.');
    } catch {
      this.toasts.error('The clipboard is not available here.');
    }
  }
}
