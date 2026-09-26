import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ProblemDetails, describeProblem } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { homeRouteFor } from '../../core/auth/auth.model';
import { SessionStore } from '../../core/auth/session.store';

/**
 * IDN-01. One sign-in for all five roles: the token says which, and the app arranges itself
 * around that.
 *
 * The agency field is here because an anonymous request has no token to read the agency from. A
 * platform admin leaves it blank; everyone else is signing in to one agency. In a deployment with
 * a subdomain per agency this would be read from the host instead.
 */
@Component({
  selector: 'app-sign-in',
  imports: [ReactiveFormsModule],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.scss',
})
export class SignIn {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly submitting = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    agencyId: [''],
  });

  constructor() {
    // Someone arriving from an accepted invitation already told us who they are and which agency
    // they joined, so they should not have to find an agency id to type in.
    const parameters = this.route.snapshot.queryParamMap;

    this.form.patchValue({
      email: parameters.get('email') ?? '',
      agencyId: parameters.get('agencyId') ?? '',
    });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();

      return;
    }

    this.submitting.set(true);
    this.failure.set(null);

    const { email, password, agencyId } = this.form.getRawValue();

    try {
      await firstValueFrom(this.auth.login(email, password, agencyId.trim() || null));

      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const role = this.session.role();

      await this.router.navigateByUrl(returnUrl ?? (role ? homeRouteFor(role) : '/'));
    } catch (error) {
      // Sign-in failures are shown on the form, not as a toast: the person is looking right here.
      this.failure.set(this.explain(error));
    } finally {
      this.submitting.set(false);
    }
  }

  private explain(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Sign-in failed. Try again.';
    }

    if (error.status === 0) {
      return 'The API did not respond. Check that it is running on http://localhost:5125.';
    }

    if (error.status === 429) {
      return 'Too many attempts. Wait a minute and try again.';
    }

    return describeProblem(error.error as ProblemDetails, 'That email and password did not match.');
  }
}
