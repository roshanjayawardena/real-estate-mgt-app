import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ProblemDetails, apiUrl, describeProblem } from '../../core/api/api';
import { skipAuth } from '../../core/auth/auth.service';

interface AcceptedInvitation {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
  readonly agencyId: string;
}

/**
 * IDN-04. Where an invitation link lands: the person picks a name and a password, and the token
 * in the URL is the only credential they have.
 *
 * Anonymous by design — there is no session yet, and no agency header either. The token tells the
 * server which agency this is, so nothing here can be pointed at a different one.
 */
@Component({
  selector: 'app-accept-invitation',
  imports: [ReactiveFormsModule],
  templateUrl: './accept-invitation.html',
  styleUrl: './sign-in.scss',
})
export class AcceptInvitation {
  /** From the route: /invitations/:token */
  readonly token = input.required<string>();

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly accepted = signal<AcceptedInvitation | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      // Ten characters is what the server asks for; saying so here saves a round trip.
      password: ['', [Validators.required, Validators.minLength(10)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();

      return;
    }

    this.submitting.set(true);
    this.failure.set(null);

    const { firstName, lastName, password } = this.form.getRawValue();

    try {
      const result = await firstValueFrom(
        this.http.post<AcceptedInvitation>(
          apiUrl(`/api/v1/invitations/${encodeURIComponent(this.token())}/accept`),
          { firstName, lastName, password },
          { context: skipAuth() },
        ),
      );

      this.accepted.set(result);
    } catch (error) {
      this.failure.set(this.explain(error));
    } finally {
      this.submitting.set(false);
    }
  }

  /** Straight to sign-in with the email and agency already filled in, since we know both. */
  protected async goToSignIn(): Promise<void> {
    const result = this.accepted();

    await this.router.navigate(['/sign-in'], {
      queryParams: result ? { email: result.email, agencyId: result.agencyId } : {},
    });
  }

  private explain(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'That did not work. Try the link again.';
    }

    if (error.status === 0) {
      return 'The API did not respond. Check that it is running.';
    }

    if (error.status === 404) {
      return 'This invitation link is not valid. Ask for a new one.';
    }

    if (error.status === 409 || error.status === 422) {
      return describeProblem(
        error.error as ProblemDetails,
        'This invitation has already been used or has expired.',
      );
    }

    return describeProblem(error.error as ProblemDetails, 'That did not work. Check the password and try again.');
  }
}

/** A mistyped password nobody can see is worth catching before it becomes a support call. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmation = group.get('confirmPassword')?.value;

  return !confirmation || password === confirmation ? null : { passwordsDiffer: true };
}
