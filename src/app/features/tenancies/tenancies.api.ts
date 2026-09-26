import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../../core/api/api';

export interface TenancyListItem {
  readonly id: string;
  readonly propertyId: string;
  readonly weeklyRent: number;
  readonly frequency: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paidToDate: string;
  readonly daysBehind: number;
  readonly amountOwing: number;
  readonly arrearsStage: string;
  readonly status: string;
}

export interface Bond {
  readonly amount: number;
  readonly receivedOn: string;
  readonly lodgementDueBy: string;
  readonly lodgedOn: string | null;
  readonly lodgementReference: string | null;
  readonly claimAmount: number | null;
  readonly refundedOn: string | null;
  readonly status: string;
}

export interface ScheduledIncrease {
  readonly newWeeklyRent: number;
  readonly effectiveFrom: string;
  readonly noticeGivenOn: string;
}

export interface NoticeToVacate {
  readonly receivedOn: string;
  readonly vacateDate: string;
  readonly givenBy: string;
}

export interface Tenancy {
  readonly id: string;
  readonly propertyId: string;
  readonly tenantUserIds: readonly string[];
  readonly startDate: string;
  readonly endDate: string;
  readonly term: string;
  readonly weeklyRent: number;
  readonly frequency: string;
  readonly amountPerCharge: number;
  readonly paidToDate: string;
  readonly daysBehind: number;
  readonly amountOwing: number;
  readonly arrearsStage: string;
  readonly status: string;
  readonly bond: Bond | null;
  readonly scheduledRentIncrease: ScheduledIncrease | null;
  readonly noticeToVacate: NoticeToVacate | null;
}

/** What the API will allow before a rent increase is even worth typing (BR-06). */
export interface RentIncreaseEligibility {
  readonly tenancyId: string;
  readonly currentWeeklyRent: number;
  readonly lastIncreaseOn: string | null;
  readonly earliestEffectiveDate: string;
  readonly noticeBy: string;
  readonly noticeDays: number;
  readonly minimumMonthsBetweenIncreases: number;
}

export interface NewTenancy {
  readonly propertyId: string;
  readonly tenantUserIds: readonly string[];
  readonly startDate: string;
  readonly endDate: string;
  readonly weeklyRent: number;
  readonly frequency: string;
}

@Injectable({ providedIn: 'root' })
export class TenanciesService {
  private readonly http = inject(HttpClient);

  create(tenancy: NewTenancy): Observable<Tenancy> {
    return this.http.post<Tenancy>(apiUrl('/api/v1/tenancies'), tenancy);
  }

  recordBond(tenancyId: string, amount: number, receivedOn: string): Observable<Tenancy> {
    return this.http.post<Tenancy>(apiUrl(`/api/v1/tenancies/${tenancyId}/bond`), { amount, receivedOn });
  }

  lodgeBond(tenancyId: string, lodgedOn: string, reference: string): Observable<Tenancy> {
    return this.http.post<Tenancy>(apiUrl(`/api/v1/tenancies/${tenancyId}/bond/lodged`), {
      lodgedOn,
      reference,
    });
  }

  activate(tenancyId: string): Observable<Tenancy> {
    return this.http.post<Tenancy>(apiUrl(`/api/v1/tenancies/${tenancyId}/activate`), {});
  }

  scheduleRentIncrease(tenancyId: string, newWeeklyRent: number, effectiveFrom: string): Observable<Tenancy> {
    return this.http.post<Tenancy>(apiUrl(`/api/v1/tenancies/${tenancyId}/rent-increase`), {
      newWeeklyRent,
      effectiveFrom,
    });
  }

  giveNotice(
    tenancyId: string,
    notice: { receivedOn: string; vacateDate: string; givenBy: string },
  ): Observable<Tenancy> {
    return this.http.post<Tenancy>(apiUrl(`/api/v1/tenancies/${tenancyId}/notice-to-vacate`), notice);
  }

  renew(tenancyId: string, newEndDate: string): Observable<Tenancy> {
    return this.http.post<Tenancy>(apiUrl(`/api/v1/tenancies/${tenancyId}/renew`), { newEndDate });
  }

  end(tenancyId: string, endedOn: string): Observable<void> {
    return this.http.post<void>(apiUrl(`/api/v1/tenancies/${tenancyId}/end`), { endedOn });
  }
}

export const paymentFrequencies = ['Weekly', 'Fortnightly', 'Monthly'] as const;
