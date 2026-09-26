import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { Permission, Permissions, Role } from '../auth/auth.model';
import { SessionStore } from '../auth/session.store';

interface NavItem {
  readonly label: string;
  readonly route: string;
  readonly permission?: Permission;
  readonly roles?: readonly Role[];
}

/**
 * The signed-in frame: one app, five roles, one navigation built from what the session may
 * actually do. A property manager and a tenant see different lists here, and the server checks
 * again on every request either way.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);

  protected readonly session = inject(SessionStore);
  protected readonly menuOpen = signal(false);

  private readonly allItems: readonly NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', permission: Permissions.propertiesView },
    { label: 'Properties', route: '/properties', permission: Permissions.propertiesView },
    { label: 'Tenancies', route: '/tenancies', permission: Permissions.tenanciesManage },
    { label: 'Arrears', route: '/tenancies/arrears', permission: Permissions.tenanciesManage },
    { label: 'People', route: '/people', permission: Permissions.usersInvite },
    { label: 'Agencies', route: '/agencies', roles: ['SuperAdmin'] },
    { label: 'My tenancy', route: '/portal/tenancy', roles: ['Tenant'] },
    { label: 'My rent ledger', route: '/portal/ledger', roles: ['Tenant'] },
    { label: 'My properties', route: '/portal/owner', roles: ['Owner'] },
  ];

  protected readonly items = computed(() =>
    this.allItems.filter((item) => {
      if (item.roles) {
        return this.session.isRole(...item.roles);
      }

      return item.permission ? this.session.has(item.permission) : true;
    }),
  );

  protected readonly initials = computed(() =>
    this.session
      .displayName()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
  );

  protected signOut(): void {
    void this.auth.logout();
  }
}
