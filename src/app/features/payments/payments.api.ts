import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../../core/api/api';

export interface LedgerEntry {
  readonly id: string;
  readonly entryDate: string;
  readonly type: string;
  readonly reference: string;
  readonly description: string;
  readonly debit: number;
  readonly credit: number;
  readonly runningBalance: number;
  readonly isReversed: boolean;
  readonly isReversal: boolean;
}

export interface LedgerStatement {
  readonly ledgerId: string;
  readonly type: string;
  readonly partyId: string;
  readonly propertyId: string | null;
  readonly balance: number;
  readonly entries: readonly LedgerEntry[];
}

export interface Receipt {
  readonly paymentId: string;
  readonly receiptNumber: string;
  readonly amount: number;
  readonly paidOn: string;
  readonly renterBalance: number;
  readonly commission: number;
  readonly gst: number;
  readonly netToOwners: number;
}

export interface Reversal {
  readonly paymentId: string;
  readonly receiptNumber: string;
  readonly amount: number;
  readonly reason: string;
  readonly entriesReversed: number;
  readonly renterBalance: number;
}

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly http = inject(HttpClient);

  /**
   * PAY-09. The key makes a retry safe: if the first attempt reached the server, the same key
   * returns the receipt it already issued instead of taking the rent twice.
   */
  recordRent(
    payment: { tenancyId: string; amount: number; method: string; paidOn: string },
    idempotencyKey: string,
  ): Observable<Receipt> {
    return this.http.post<Receipt>(apiUrl('/api/v1/payments/rent'), payment, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  reverse(paymentId: string, reason: string): Observable<Reversal> {
    return this.http.post<Reversal>(apiUrl(`/api/v1/payments/${paymentId}/reverse`), { reason });
  }
}

export const paymentMethods = ['BankTransfer', 'Card', 'Cash', 'DirectDebit'] as const;
