import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ToastStore } from '../../core/notifications/toast.store';
import { PageHeader } from '../../shared/page';
import { PropertiesService, australianStates, propertyTypes } from './properties.api';

/** PRP-01. Adding a property to the portfolio. Owners and terms come next, on the detail screen. */
@Component({
  selector: 'app-new-property',
  imports: [ReactiveFormsModule, RouterLink, PageHeader],
  templateUrl: './new-property.html',
  styles: `
    form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0 20px;
    }

    .actions {
      grid-column: 1 / -1;
      justify-content: flex-end;
    }
  `,
})
export class NewProperty {
  private readonly properties = inject(PropertiesService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastStore);

  protected readonly types = propertyTypes;
  protected readonly states = australianStates;
  protected readonly saving = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    unit: [''],
    streetNumber: ['', [Validators.required]],
    street: ['', [Validators.required]],
    suburb: ['', [Validators.required]],
    // v1 ships New South Wales rules, so that is the sensible default.
    state: ['NSW', [Validators.required]],
    postcode: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    type: ['House', [Validators.required]],
    bedrooms: [3, [Validators.required, Validators.min(0)]],
    bathrooms: [1, [Validators.required, Validators.min(0)]],
    carSpaces: [1, [Validators.required, Validators.min(0)]],
    features: [''],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();

    try {
      const created = await firstValueFrom(
        this.properties.create({
          ...value,
          unit: value.unit.trim() || null,
          features: value.features
            .split(',')
            .map((feature) => feature.trim())
            .filter(Boolean),
        }),
      );

      this.toasts.success('Property added. Record the owners and sign the agreement next.');
      await this.router.navigate(['/properties', created.id]);
    } catch {
      // Announced by the error interceptor.
    } finally {
      this.saving.set(false);
    }
  }
}
