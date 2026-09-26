import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PagedList, apiUrl } from '../../core/api/api';
import { Permissions } from '../../core/auth/auth.model';
import { SessionStore } from '../../core/auth/session.store';
import { HumanisePipe } from '../../shared/format';
import { PageHeader, StateNote } from '../../shared/page';
import { StatusBadge } from '../../shared/status-badge';
import { PropertyListItem } from './properties.api';

/**
 * PRP-02. The portfolio. The search and the paging live in the URL the resource builds, so the
 * list refetches by itself whenever either signal changes.
 */
@Component({
  selector: 'app-properties-list',
  imports: [RouterLink, PageHeader, StateNote, StatusBadge, HumanisePipe],
  templateUrl: './properties-list.html',
})
export class PropertiesList {
  private readonly session = inject(SessionStore);

  protected readonly search = signal('');
  protected readonly status = signal('');
  protected readonly page = signal(1);

  protected readonly canManage = this.session.has(Permissions.propertiesManage);

  protected readonly properties = httpResource<PagedList<PropertyListItem>>(() => {
    const parameters = new URLSearchParams({ page: `${this.page()}`, pageSize: '25' });
    const search = this.search().trim();

    if (search) {
      parameters.set('search', search);
    }

    if (this.status()) {
      parameters.set('status', this.status());
    }

    return apiUrl(`/api/v1/properties?${parameters}`);
  });

  protected readonly items = computed(() => this.properties.value()?.items ?? []);
  protected readonly total = computed(() => this.properties.value()?.total ?? 0);
  protected readonly hasPrevious = computed(() => this.properties.value()?.hasPrevious ?? false);
  protected readonly hasNext = computed(() => this.properties.value()?.hasNext ?? false);

  protected onSearch(value: string): void {
    this.page.set(1);
    this.search.set(value);
  }

  protected onStatus(value: string): void {
    this.page.set(1);
    this.status.set(value);
  }

  protected step(by: number): void {
    this.page.update((current) => Math.max(1, current + by));
  }
}
