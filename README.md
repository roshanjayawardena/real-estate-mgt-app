# Keyhouse — web

The Angular front end for **Keyhouse**, a multi-tenant SaaS for Australian residential property
management. One application serves five logins — platform administrator, property manager, owner,
tenant and service supplier — and arranges itself around whichever one is signed in.

The API lives in its own repository: [real-estate-mgt-api](https://github.com/roshanjayawardena/real-estate-mgt-api)
(.NET 10, modular monolith, DDD and vertical slices). That repository also holds the requirements
specification, the domain model and the architecture decision records; this one is the client.

---

## Running it

You need Node 22.12 or later, and the API running locally.

```bash
npm install
```

> If `npm install` fails with `Cannot read properties of null (reading 'edgesOut')`, you are on
> npm 10.9.0, which cannot resolve this dependency graph. Run `npx npm@11 install` instead. The
> `packageManager` field pins npm 11 so this only bites once.

```bash
npm start
```

That serves the app on `http://localhost:4200` and proxies `/api` to the API on
`http://localhost:5125` (see `proxy.conf.json`). Going through a proxy rather than calling the API
directly keeps requests same-origin in development: no CORS pre-flight, and no certificate warning.

| Command | What it does |
| --- | --- |
| `npm start` | Dev server with the API proxy |
| `npm run build` | Production build, with `environment.production.ts` swapped in |
| `npm test` | Vitest (see *Known gaps* — there are no specs yet) |

### Signing in

Everyone except the platform administrator belongs to an agency, and an anonymous request carries
no token to say which — so the sign-in form asks for an **agency id**, which it sends as the
`X-Tenant` header. The platform administrator leaves that field blank. In a deployment with a
subdomain per agency the host would supply it instead.

New people arrive by invitation rather than registration. The invitation link lands on
`/invitations/:token`, where the token in the URL is the only credential; setting a password
activates the account, and the page then hands you to sign-in with the email and agency already
filled in.

---

## The stack, and why

**Angular 21, zoneless.** Change detection follows signals rather than patched browser APIs, so
there is no `zone.js` in the bundle and no `NgZone` in the mental model.

**Signals for state, `httpResource` for reads.** A screen declares the URL it needs as a function
of signals, and the resource refetches whenever those change — the properties list re-queries when
the search box or page number moves, without a subscription or a manual reload. Writes go through
small injectable services that return observables, because a command is a one-shot thing, not a
piece of state.

**No state-management library.** The session is a signal store of about eighty lines; everything
else is server state, which the resources already own. Adding NgRx here would be ceremony around
data that has a single source of truth on the other side of an HTTP call.

**Standalone components and lazy routes.** Every route behind the shell is loaded on demand, so a
renter signing in to check their balance never downloads the agency screens.

**Hand-written SCSS.** A small set of design tokens in `styles.scss` and component styles beside
each component. No UI library: the surface here is tables, forms and badges, and owning the CSS is
cheaper than theming somebody else's.

---

## How it is organised

```
src/app/
  core/                  what every feature depends on
    api/                 base URL, problem details, the error interceptor
    auth/                session store, sign-in service, bearer/tenant interceptor, route guards
    layout/              the signed-in shell and its role-aware navigation
    notifications/       toasts
  features/              one folder per area, each owning its screens and its API types
    agencies/  auth/  dashboard/  payments/  people/  portal/  properties/  tenancies/
  shared/                money and date formatting, status badge, page header
```

Features do not import from each other. Anything two features both need is in `shared/` or
`core/`, which mirrors how the API keeps its modules apart.

---

## Talking to the API

**Two interceptors, in order.** The error interceptor is outermost and turns an RFC 9457
`ProblemDetails` response into a sentence worth showing someone. Inside it, the auth interceptor
attaches the bearer token and the `X-Tenant` header, and on a `401` performs a single shared
refresh and retries once — a burst of expired requests produces one refresh, not five. A `400` is
left alone for the form that caused it, so validation messages land on fields.

**The tenant header is a convenience, never a key.** The server treats the token's tenant claim as
the authority and refuses a header that disagrees with it, so nothing typed here reaches another
agency's data.

**Route guards mirror the API's permissions** (`properties.view`, `payments.record`, and so on) and
decide what a role can open. They are not the security boundary: the server authorizes every
request again, and a guard that was wrong would change what a person sees, not what they can do.

**Recording rent sends an `Idempotency-Key`.** The key is minted once per attempt and kept if the
request fails, so pressing the button again retries that payment rather than taking the rent twice.

---

## What this app deliberately does not decide

Tenancy law is state law, and it lives on the server. This client shows what the rules allow — the
earliest date a rent increase may take effect, the notice deadline, the arrears stage, the balance
of a ledger — and lets the API refuse anything else. There is no second copy of the four-week bond
cap or the twelve-month rule in TypeScript to drift out of step with the real one.

---

## Screens

| Area | Screens |
| --- | --- |
| Auth | Sign in, accept invitation |
| Property manager | Dashboard, properties and detail, add property, management agreement, tenancies, arrears board, tenancy detail, rent ledger, record and reverse payments, people and invitations |
| Tenant portal | My tenancy, my rent ledger |
| Owner portal | My properties and their statements |
| Platform admin | Agencies: onboard, suspend, activate |

---

## Known gaps

- **No tests yet.** Vitest is configured and nothing uses it. The session store, the auth
  interceptor's refresh, and the guards are the three things worth covering first.
- **User ids are pasted, not picked.** Assigning owners to a property and renters to a tenancy
  asks for ids; the People screen exists to make them copyable. Both forms want a picker.
- **Phase 2 screens are missing**: maintenance, documents, notifications, owner statements. The
  platform administrator's audit log is missing too.
- **Angular 22** needs Node 22.22.3; this is on 21 until that upgrade.
- **No accessibility or performance pass** has been done beyond labelled controls, focus styles
  and a reduced-motion rule.
