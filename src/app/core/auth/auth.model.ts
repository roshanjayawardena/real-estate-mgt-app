/** Mirrors SignedInUser on the API. */
export interface SignedInUser {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: Role;
  readonly userType: string;
  readonly agencyId: string | null;
  readonly permissions: readonly string[];
}

export interface AuthenticationResponse {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly refreshToken: string;
  readonly user: SignedInUser;
}

/** The five logins from the specification. */
export type Role = 'SuperAdmin' | 'PropertyManager' | 'Owner' | 'Tenant' | 'Supplier';

/**
 * The permission names the API authorizes on. Kept as constants so a typo is a compile error
 * rather than a button that silently never shows.
 */
export const Permissions = {
  agenciesManage: 'agencies.manage',
  usersInvite: 'users.invite',
  usersManage: 'users.manage',
  propertiesView: 'properties.view',
  propertiesManage: 'properties.manage',
  tenanciesView: 'tenancies.view',
  tenanciesManage: 'tenancies.manage',
  paymentsView: 'payments.view',
  paymentsRecord: 'payments.record',
  paymentsReverse: 'payments.reverse',
  statementsGenerate: 'statements.generate',
  payoutsRecord: 'payouts.record',
  maintenanceView: 'maintenance.view',
  maintenanceManage: 'maintenance.manage',
  maintenanceApprove: 'maintenance.approve',
  inspectionsManage: 'inspections.manage',
  documentsView: 'documents.view',
  documentsUpload: 'documents.upload',
  auditView: 'audit.view',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

/** Where each role lands after signing in. */
export function homeRouteFor(role: Role): string {
  switch (role) {
    case 'SuperAdmin':
      return '/agencies';
    case 'Tenant':
      return '/portal/tenancy';
    case 'Owner':
      return '/portal/owner';
    case 'Supplier':
      return '/portal/work';
    default:
      return '/dashboard';
  }
}
