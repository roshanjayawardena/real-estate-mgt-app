import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../../core/api/api';

export interface PropertyListItem {
  readonly id: string;
  readonly address: string;
  readonly suburb: string;
  readonly type: string;
  /** "3 bed, 2 bath, 1 car" — built on the server so every screen says it the same way. */
  readonly summary: string;
  readonly status: string;
  readonly managedByUserId: string;
}

export interface OwnerShare {
  readonly ownerUserId: string;
  readonly share: number;
  readonly isPrimaryContact: boolean;
}

export interface Property {
  readonly id: string;
  readonly address: string;
  readonly suburb: string;
  readonly state: string;
  readonly postcode: string;
  readonly type: string;
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly carSpaces: number;
  readonly features: readonly string[];
  readonly status: string;
  readonly managedByUserId: string;
  readonly currentTenancyId: string | null;
  readonly owners: readonly OwnerShare[];
}

export interface Agreement {
  readonly id: string;
  readonly propertyId: string;
  readonly commissionRate: number;
  readonly maintenanceApprovalLimit: number;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: string;
  readonly terminatedOn: string | null;
}

export interface NewProperty {
  readonly unit: string | null;
  readonly streetNumber: string;
  readonly street: string;
  readonly suburb: string;
  readonly state: string;
  readonly postcode: string;
  readonly type: string;
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly carSpaces: number;
  readonly features: readonly string[];
}

/** Commands only: the reads are httpResource in the screens that need them. */
@Injectable({ providedIn: 'root' })
export class PropertiesService {
  private readonly http = inject(HttpClient);

  create(property: NewProperty): Observable<Property> {
    return this.http.post<Property>(apiUrl('/api/v1/properties'), property);
  }

  assignOwners(propertyId: string, owners: readonly OwnerShare[]): Observable<Property> {
    return this.http.put<Property>(apiUrl(`/api/v1/properties/${propertyId}/owners`), { owners });
  }

  archive(propertyId: string): Observable<void> {
    return this.http.post<void>(apiUrl(`/api/v1/properties/${propertyId}/archive`), {});
  }

  signAgreement(
    propertyId: string,
    terms: { commissionRate: number; maintenanceApprovalLimit: number; startDate: string; endDate: string | null },
  ): Observable<Agreement> {
    return this.http.post<Agreement>(apiUrl(`/api/v1/properties/${propertyId}/agreement`), terms);
  }

  amendAgreement(
    propertyId: string,
    terms: { commissionRate: number; maintenanceApprovalLimit: number },
  ): Observable<Agreement> {
    return this.http.put<Agreement>(apiUrl(`/api/v1/properties/${propertyId}/agreement`), terms);
  }

  terminateAgreement(propertyId: string, terminatedOn: string, reason: string | null): Observable<void> {
    return this.http.post<void>(apiUrl(`/api/v1/properties/${propertyId}/agreement/terminate`), {
      terminatedOn,
      reason,
    });
  }
}

export const propertyTypes = ['House', 'Unit', 'Apartment', 'Townhouse', 'Villa', 'Duplex', 'Studio'] as const;

export const australianStates = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
