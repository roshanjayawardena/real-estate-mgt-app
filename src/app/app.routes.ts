import { Routes } from '@angular/router';

import { Permissions } from './core/auth/auth.model';
import { authGuard, homeRedirect, requirePermission, requireRole } from './core/auth/guards';

/**
 * Everything behind the shell is lazy: a renter signing in to check their balance never downloads
 * the agency screens. The guards decide what a role may open; the API decides it again.
 */
export const routes: Routes = [
  {
    path: 'sign-in',
    loadComponent: () => import('./features/auth/sign-in').then((m) => m.SignIn),
    title: 'Sign in · Keyhouse',
  },
  {
    // Where an invitation link lands. Anonymous: the token is the credential.
    path: 'invitations/:token',
    loadComponent: () => import('./features/auth/accept-invitation').then((m) => m.AcceptInvitation),
    title: 'Accept your invitation · Keyhouse',
  },
  {
    path: '',
    loadComponent: () => import('./core/layout/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [homeRedirect], children: [] },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        canActivate: [requirePermission(Permissions.propertiesView)],
        title: 'Dashboard · Keyhouse',
      },
      {
        path: 'properties',
        canActivate: [requirePermission(Permissions.propertiesView)],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/properties/properties-list').then((m) => m.PropertiesList),
            title: 'Properties · Keyhouse',
          },
          {
            path: 'new',
            loadComponent: () => import('./features/properties/new-property').then((m) => m.NewProperty),
            canActivate: [requirePermission(Permissions.propertiesManage)],
            title: 'Add property · Keyhouse',
          },
          {
            // withComponentInputBinding turns :propertyId into the component's input.
            path: ':propertyId',
            loadComponent: () => import('./features/properties/property-detail').then((m) => m.PropertyDetail),
            title: 'Property · Keyhouse',
          },
        ],
      },
      {
        path: 'tenancies',
        canActivate: [requirePermission(Permissions.tenanciesView, Permissions.tenanciesManage)],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/tenancies/tenancies-list').then((m) => m.TenanciesList),
            title: 'Tenancies · Keyhouse',
          },
          {
            path: 'arrears',
            loadComponent: () => import('./features/tenancies/tenancies-list').then((m) => m.TenanciesList),
            data: { arrearsOnly: true },
            title: 'Arrears · Keyhouse',
          },
          {
            path: 'new',
            loadComponent: () => import('./features/tenancies/new-tenancy').then((m) => m.NewTenancy),
            canActivate: [requirePermission(Permissions.tenanciesManage)],
            title: 'New tenancy · Keyhouse',
          },
          {
            path: ':tenancyId',
            loadComponent: () => import('./features/tenancies/tenancy-detail').then((m) => m.TenancyDetail),
            title: 'Tenancy · Keyhouse',
          },
        ],
      },
      {
        path: 'people',
        loadComponent: () => import('./features/people/people').then((m) => m.People),
        canActivate: [requirePermission(Permissions.usersManage, Permissions.usersInvite)],
        title: 'People · Keyhouse',
      },
      {
        path: 'agencies',
        loadComponent: () => import('./features/agencies/agencies').then((m) => m.Agencies),
        canActivate: [requireRole('SuperAdmin')],
        title: 'Agencies · Keyhouse',
      },
      {
        path: 'portal',
        children: [
          {
            path: 'tenancy',
            loadComponent: () => import('./features/portal/tenant-portal').then((m) => m.TenantPortal),
            canActivate: [requireRole('Tenant')],
            title: 'My tenancy · Keyhouse',
          },
          {
            path: 'ledger',
            loadComponent: () => import('./features/portal/tenant-portal').then((m) => m.TenantLedger),
            canActivate: [requireRole('Tenant')],
            title: 'My rent ledger · Keyhouse',
          },
          {
            path: 'owner',
            loadComponent: () => import('./features/portal/owner-portal').then((m) => m.OwnerPortal),
            canActivate: [requireRole('Owner')],
            title: 'My properties · Keyhouse',
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
