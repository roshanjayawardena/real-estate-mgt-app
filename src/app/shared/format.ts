import { Pipe, PipeTransform } from '@angular/core';

/** Money is always AUD here, and always shown with cents: a ledger that rounds is a ledger nobody trusts. */
const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
});

const dayMonthYear = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : currency.format(value);
  }
}

/**
 * The API sends dates as plain `yyyy-MM-dd` (DateOnly), which must not be pushed through the
 * browser's time zone: a lease that starts on the 1st does not start on the 31st in Perth.
 */
@Pipe({ name: 'auDate' })
export class AuDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const [year, month, day] = value.slice(0, 10).split('-').map(Number);

    return dayMonthYear.format(new Date(year, month - 1, day));
  }
}

/** "Fortnightly" reads better than "Fortnightly (14 days)" in a table cell. */
@Pipe({ name: 'humanise' })
export class HumanisePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    return value
      .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
      .replace(/^./, (first) => first.toUpperCase());
  }
}

/** Today in the browser's zone, as the `yyyy-MM-dd` the API expects. */
export function today(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');

  return `${now.getFullYear()}-${month}-${day}`;
}
