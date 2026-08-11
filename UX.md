# PhysioCare UX Design

This document is the durable source of truth for the PhysioCare user experience. It defines the information architecture, user flows, screen inventory, and interaction conventions that the frontend implements.

It complements, and does not duplicate, the engineering documentation:

- `AGENTS.md` — Frontend Engineering Guidelines define the *architecture* (Mantine design system, TanStack Query, feature structure, capability gating). This document defines the *experience* that architecture serves.
- `ROADMAP.md` — phases F0–F10 sequence the delivery. Each F-phase implementation plan authors its per-module UX spec and references the relevant sections here.

## How to Use This Document

- Keep this document current as the single reference for what the product's screens are, how they connect, and how they behave. Per-module UX specs live in each F-phase implementation plan and point back here rather than restating it.
- This document is the design handbook. Significant UX decisions (navigation model, app-shell structure, primary interaction patterns) are also recorded as coded **ADRs in the *Frontend Decision Records* log in `AGENTS.md`**, with the full design detail kept here and referenced from the ADR. Do not relitigate settled decisions inline.
- Working design explorations and reviews stay in the session scratchpad (untracked) per `CLAUDE.md` until a decision is promoted here or into an ADR.
- Conventions here are advisory to the user experience. Authorization, validation, and business rules remain the backend's responsibility; UX gating exists only to improve the experience.

---

# Information Architecture

The sitemap and role-aware navigation model. Maps to the frontend route groups: `(auth)` (shared front door), `(platform)/platform/…` (SUPER_ADMIN API tooling), and `(org)/app/…` (organization experience).

## Navigation & Surface Model

Dedicated pages (routes) are a scarce resource. A surface earns a route only when it is an **independent destination** — somewhere users deliberately navigate to and do focused work. Reserving routes this way keeps breadcrumbs shallow, preserves the user's working context, and flattens the learning curve.

A surface earns a **route (Page)** only when all of the following hold:

- it is reachable as an independent destination from primary navigation or as a stable deep link;
- it is a workspace for focused, multi-step work;
- it does not primarily benefit from retaining the surface it was launched from.

Everything else renders as **contextual UI**, layered over its originating context:

- **Dialog** — create/edit forms, short self-contained tasks, confirmations, and frequent quick actions launched from elsewhere (e.g. "Create patient" from the dashboard).
- **Drawer** — quick entity detail / peek that keeps the list context; secondary side panels.
- **Tabs** — sections of a single workspace (e.g. a patient's records, packages, appointments).
- **Accordion / inline section** — child or grouped content within a page (e.g. a prescription inside a consultation).

Child resources that cannot exist without their parent and need no workspace of their own are never routes — they render inside the parent. A child that is itself a substantial workspace (e.g. a consultation) may still earn a route.

This model governs the Screen Inventory below and is recorded as **ADR-0001 (Navigation & Surface Model)** in `AGENTS.md`.

## Sitemap

The routable structure, by route group. Only **destinations** appear as nodes (per ADR-0001); contextual surfaces are noted under the destination that hosts them, and shell elements are listed once per shell. Paths are provisional.

### `(auth)` — shared front door (no shell)

```
/login                       Login
/reset-password              Reset Password — Request
/reset-password/confirm      Reset Password — Confirm
/invite                      Invitation Acceptance
```

The confirm screens carry no token in their path. `/auth/callback` exchanges the emailed token for a session before redirecting, so by the time the user arrives they are already signed in on a short-lived recovery or invitation session; repeating the token in the URL would add referrer and history exposure for nothing. What authorizes setting a password without the current one is the **password-setup ticket** issued by the callback (`AGENTS.md` → ADR-0007), and its absence is what an expired or already-used link looks like on these screens.

Non-navigable frames: Forbidden / Unauthorized, Session Expired. Technical: `/auth/callback`, landing resolver (post-auth redirect into the correct namespace).

### `(platform)/platform` — platform console (platform shell)

```
/platform/admin              API Explorer
```

Platform shell: user menu (My account, Change password, Log out). No primary nav in V1.

### `(org)/app` — organization app (org shell)

```
/app                         Dashboard            → widget: appointments (today/upcoming) → "view all" dialog
                                                    quick actions: create patient, schedule appointment, create invoice, mark attendance
/app/patients                Patients
  /app/patients/[id]         Patient Workspace    → tabs/split: overview, appointments, records, packages, invoices
                                                    hosts: edit patient, records upload, package assignment & usage
/app/appointments            Appointments (oversight, Owner/Admin)  → drawer: appointment detail & status
  /app/appointments/[id]/consultation  Consultation  → inline: prescription
                                                    reached from: dashboard appointments widget/dialog, patient workspace
/app/attendance              Attendance (board)   → dialog: mark attendance / availability (status)
/app/invoices                Invoices (list)      → dialog: invoice detail (line items, payments); dialog: create invoice
/app/packages                Packages             → dialog: create/edit, activate/deactivate
/app/users                   Users                → drawer: user detail & compensation; dialog: create, change role, activate/deactivate, offboard
/app/clinics                 Clinics              → drawer: clinic detail & assignment; dialog: create/edit
/app/reports                 Reports              → tabs: billing, commission, physiotherapist; action: export
/app/settings                Settings             → tabs: organization, subscription
/app/audit-logs              Audit Log
```

Org shell: header (notifications bell → drawer → dialog), user menu (My account, Change password, Log out), role-aware primary navigation (defined next).

## Navigation Model

How users move between destinations, and where each role lands. Navigation is **capability-gated, not role-gated** (per `AGENTS.md`): items are filtered by the capability map from `GET /api/users/me`, and the role columns below describe the *expected outcome* of that gating for design clarity — the client never compares role names.

### Primary navigation — organization app

The org shell exposes a role-aware primary nav. Only top-level destinations are nav items; child routes (Patient Workspace, Consultation) and contextual surfaces are reached from within, not from the nav.

Items sit in three groups — **Clinical**, **Billing & Catalog**, and **Administration** — with Dashboard ungrouped at the top. Group headers are omitted when capability filtering leaves a group with no items.

| Nav item | Group | Owner | Admin | Physio | Reception |
| --- | --- | :---: | :---: | :---: | :---: |
| Dashboard | — | ● | ● | ● | ● |
| Patients | Clinical | ● | ● | ● | ● |
| Appointments | Clinical | ● | ● | — | — |
| Attendance | Clinical | ● | ● | — | — |
| Invoices | Billing & Catalog | ● | ● | — | ● |
| Packages | Billing & Catalog | ● | ● | ● | ● |
| Reports | Administration | ● | ● | ●¹ | — |
| Users | Administration | ● | ● | — | — |
| Clinics | Administration | ● | ● | — | — |
| Settings | Administration | ● | ●² | — | — |
| Audit Log | Administration | ● | ● | — | — |

¹ Physiotherapists see only their own physiotherapist report tab; billing and commission tabs are gated out.
² The Subscription tab within Settings is Owner-only; Admin sees the Organization tab only, and read-only there -- only Owner (and SUPER_ADMIN) may edit the organization profile (F4).

Non-manager roles get a deliberately short nav: **Physio** — Dashboard, Patients, Packages, Reports; **Reception** — Dashboard, Patients, Invoices, Packages. Packages is view-only for both (catalog management is Owner/Admin). Their high-frequency work (a physio's day, reception's scheduling and billing) runs through the Dashboard widget/quick actions and the patient workspace, not extra nav items.

### Primary navigation — platform console

No primary nav in V1. The platform shell exposes only the API Explorer destination and the user menu (My account, Change password, Log out).

### Landing resolution

A landing resolver runs after authentication (it is not a screen) and routes the user to their home, keeping login role-agnostic:

- **Unauthenticated** → `/login`.
- **SUPER_ADMIN** → `/platform/admin` (API Explorer).
- **Organization roles** (Owner, Admin, Physio, Reception) → `/app` (Dashboard). The Dashboard is role-aware, so it is the single landing target for all org users.
- **Wrong namespace** → the route-group layout guard bounces the user to their own namespace (or a Forbidden frame); enforcement is at the layout, not per page.
- **Forced password change** (future — see the change-password dialog note) → intercepts before landing; the user completes the non-dismissible dialog, then resolves normally.
- **After invitation acceptance or a password reset** → the user already holds the session the emailed link created, so once their password is set they resolve per role on that session. They are not sent back to `/login`: a second sign-in would add a step without adding proof.

Gating continues inside a destination, not just at its entrance: actions a user cannot perform are hidden or disabled rather than shown and then failing, even on destinations they can otherwise reach.

---

# User Flows

The core journeys, one per goal. Each states its actor, entry trigger, the ordered steps as intent → system response, meaningful branches, and terminal states. Steps are written at the level of user *intent* and name only **destinations** (routed workspaces); which contextual surface hosts a step — dialog, drawer, tab — is owned by the Screen Inventory and finalized per module, not fixed here. Cross-cutting states (loading, empty, validation, forbidden, session-expired, conflicts, network) follow [Interaction & State Conventions](#interaction--state-conventions) and are not restated per flow — only goal-specific branches appear below. Roles use the Screen Inventory key.

## Access & identity

### 1. Sign in & landing — all roles + SUPER_ADMIN

- **Trigger:** an unauthenticated user opens the app.
- **Steps:**
  1. User submits username and password.
  2. System authenticates and resolves their home — SUPER_ADMIN to the platform console, organization roles to the org Dashboard.
- **Branches:** wrong-namespace access afterward is bounced to the user's own namespace.
- **End states:** *Success* — user on their role home. *Failure* — remains on sign-in with the credential error. Forgotten password → Flow 2.

### 2. Recover or change my password — all roles + SUPER_ADMIN

- **Trigger:** the user forgot their password, or wants to change a known one.
- **Steps:**
  1. **Self-service recovery** — roles with a real email (Owner, Admin, and platform users): from sign-in, the user requests a reset for their identifier, receives a link by email, opens it, and sets a new password.
  2. **Admin-mediated reset** — Physiotherapist and Receptionist, whose email may be a placeholder and so cannot receive a link: the user asks an Owner/Admin, who resets their password to a reveal-once temporary value shared securely out-of-band (see Flow 9); the user signs in with it.
  3. **Voluntary change** — an authenticated user opens change-password and sets a new one.
  4. System confirms; the user continues with the new credential.
- **Branches:** self-service (real email) vs. admin-mediated (placeholder email) vs. voluntary change.
- **End states:** *Success* — password updated. *Failure* — invalid/expired reset link → guidance to request a new one; a user without a usable email who attempts self-service is directed to their Owner/Admin.

### 3. Accept an invitation & set up my account — invited organization users

- **Trigger:** an invited user opens their invitation link.
- **Steps:**
  1. System validates the invitation and prompts the user to set a password.
  2. User sets it; system activates the account.
  3. The user lands per role on the session the invitation created (Flow 1).
- **End states:** *Success* — active account on the Dashboard. *Failure* — invalid/expired invitation → guidance to request a new invite.

## Clinical & billing

**Composite journey — intake → care → paid.** Flows 4–8 chain into one operational arc: register the patient (4), book them in (5), deliver and record the visit (6), draw on their package where applicable (7), and bill and collect (8). They are documented as separate goals because each has its own actor and trigger and can occur independently, but read together they are the clinic's end-to-end patient journey.

### 4. Manage a patient — Reception, Physio, Admin

- **Trigger:** a new patient presents, or an existing patient's details/records need updating.
- **Steps:**
  1. Actor creates a patient with their details; system validates and creates the record.
  2. Actor optionally attaches records (documents/scans); system stores them against the patient.
  3. Later, actor opens the patient to view or update details and records.
- **Branches:** new patient vs. editing existing; with/without records; a possible duplicate (same name/phone) warns before creating.
- **End states:** *Success* — an active patient record with any documents. *Failure* — the patient create is aborted with no partial record; attaching a record is a separate operation, so its failure leaves the created patient intact and simply doesn't add the record (failure atomicity per conventions).

### 5. Schedule an appointment — Reception (Admin/Owner)

- **Trigger:** a patient needs a visit booked (new or follow-up).
- **Steps:**
  1. Actor selects the patient, physiotherapist, clinic, and time.
  2. System validates and creates the appointment in **scheduled** status.
- **Branches:** existing patient vs. immediately after registering one (Flow 4); booking is rejected if the clinic is inactive, if the physiotherapist isn't assigned to that clinic, or if the organization has no active subscription. A physiotherapist marked absent/on-leave for the date (or within a half-day's unavailable window) is blocked from new bookings then — part of the physiotherapist-availability feature (Flow 14). V1 does **not** otherwise check slot availability or prevent double-booking.
- **End states:** *Success* — appointment created (scheduled), visible to relevant roles. *Failure* — none created.

### 6. Run a patient visit — Physio (Reception for check-in)

- **Trigger:** the patient arrives for a scheduled/confirmed appointment.
- **Steps:**
  1. The appointment is progressed to **checked-in**.
  2. The physiotherapist conducts the **Consultation** (one per appointment), recording notes and findings.
  3. The physiotherapist adds a prescription where needed.
  4. The physiotherapist completes the visit — the appointment moves to **completed**; if the visit draws on a chosen patient package, one session is consumed as part of completing.
- **Branches:** with/without prescription; completing against a patient package (session consumed) vs. a chargeable visit (no package); if the chosen package is expired or exhausted, or a session was already recorded for this appointment, completion is blocked — pick a valid package or complete without one; instead of completing, the appointment can end as **cancelled** or **no-show** (no session consumed); a completed appointment can later be **cancelled** as a correction, which reverses the consumed session.
- **End states:** *Success* — completed visit with a consultation record, optional prescription, and any consumed session. *Alternate* — cancelled or no-show, typically with no clinical record.

### 7. Assign a package & track usage — Reception, Admin, Owner (view: all)

- **Trigger:** a patient enrolls in a package, or someone checks remaining sessions.
- **Steps:**
  1. Actor assigns a package to the patient; system creates the patient-package with its session allotment and a validity period (an expiry date derived from the package's validity).
  2. As visits complete (Flow 6), sessions are consumed; system decrements the remaining count.
  3. Anyone with access views usage (consumed vs. remaining, and validity).
- **Branches:** multiple concurrent packages are allowed; consumption is blocked once no sessions remain or after the package has **expired**, and a session can't be recorded twice for the same appointment; an assignment can't be removed once it has consumed sessions or an invoice.
- **End states:** *Success* — active patient package with accurate tracked usage. *Failure* — assignment rejected.

### 8. Invoice & payment — Reception, Admin, Owner

- **Trigger:** charges are due (a completed visit, a package purchase, an outstanding balance).
- **Steps:**
  1. Actor creates an invoice for the patient with line items (quantity, unit price, GST, discount); system computes the totals.
  2. While unpaid, the actor may edit the invoice (items, discount, date).
  3. Actor records the payment — V1 allows **exactly one payment per invoice** (no split/partial), for an amount up to the invoice total. Recording it **finalizes** the invoice.
  4. Actor finds and reviews invoices to check status.
- **Branches:**
  - **Edit window** — editing is allowed only before a payment exists; once finalized, the invoice can't be edited.
  - **Rejected payments** — a second payment, or a payment exceeding the invoice total, is rejected.
  - **Refund / cancel** — a completed payment can be transitioned to *refunded* or *cancelled* (the only legal transitions, both terminal). Correcting a finalized invoice is done by **cancelling (soft-deleting) the invoice**, allowed regardless of payment state; reconciling the payment against a cancelled invoice is out of V1 scope.
- **End states:** *Success* — invoice issued and, once its single payment is recorded, finalized. *Failure* — not created, or an edit / second payment blocked (per conventions).

## Administration

### 9. Manage user lifecycle — Owner/Admin

- **Trigger:** a person joins, changes role, leaves, or their compensation needs review.
- **Steps:**
  1. **Onboard:** actor creates a user with a role; system generates a reveal-once initial password to share, and the account is created.
  2. Actor assigns the user to one or more clinics.
  3. **Maintain:** actor later changes the user's role, or deactivates/offboards them; system applies the change.
  4. **Reset password:** actor resets a user's password to a reveal-once temporary value, shared securely with the user — the recovery path for roles without a usable email (Physiotherapist, Reception; see Flow 2).
  5. **Compensation:** the Owner reviews and sets a user's compensation configuration; each set inserts a new time-versioned record rather than overwriting history, so past commission calculations remain stable after a rate change.
- **Branches:** onboard vs. role change vs. deactivate vs. offboard vs. password reset; compensation view **and set** are Owner-only (Administrators do not see or set compensation, even though they otherwise manage users); deactivate is reversible, offboard is terminal (per destructive-action conventions).
- **End states:** *Success* — the user is in the intended lifecycle state, clinic-assigned as needed. *Failure* — blocked (e.g. a uniqueness conflict on email/username).

### 10. Manage clinics & user assignments — Owner/Admin

- **Trigger:** the org adds or changes a clinic, or staff coverage across clinics changes.
- **Steps:**
  1. Actor creates or edits a clinic; system validates and saves.
  2. Actor activates or deactivates a clinic.
  3. Actor assigns users to clinics or adjusts memberships.
- **Branches:** new clinic vs. editing; activate vs. deactivate (reversible); assignment vs. removal.
- **End states:** *Success* — clinics and their staff assignments reflect the intended structure. *Failure* — blocked.

### 11. Manage the package catalog — Owner/Admin

- **Trigger:** the org offers a new package or changes an existing one.
- **Steps:**
  1. Actor creates or edits a package (sessions, pricing, terms); system validates and saves.
  2. Actor activates or deactivates a package.
- **Branches:** new vs. editing; activate vs. deactivate — deactivating a package with active assignments is blocked with an explanation; distinct from assigning a package to a patient (Flow 7).
- **End states:** *Success* — the catalog reflects the intended offerings. *Failure* — blocked.

## Organization & oversight

### 12. Set up the organization & manage subscription — Owner

- **Trigger:** initial org setup, or a subscription needs selecting, activating, or renewing.
- **Steps:**
  1. Owner reviews and updates organization settings.
  2. Owner selects a plan and activates the subscription; renews later, before or after expiry.
  3. Plan limits and current usage are visible throughout.
- **Branches:** first-time activation vs. renewal; as usage nears or reaches a plan limit, limit-enforcement states surface across affected areas (subscription-required / limit-exceeded).
- **End states:** *Success* — active subscription within limits. *Blocked* — an action prevented by a limit until the plan is renewed/upgraded.

### 13. Oversee activity — Owner/Admin; Physio (own report)

- **Trigger:** a manager needs insight into billing, staff activity, appointments, or the audit trail.
- **Steps:**
  1. Actor opens **Reports** and chooses a report — billing and commission (Owner/Admin), or physiotherapist (a Physio sees only their own).
  2. Actor filters by period/scope and optionally exports to Excel or PDF.
  3. For operational oversight, Owner/Admin review appointments across staff and clinics, or the audit log.
- **Branches:** which report; export vs. view-only; a report exceeding the row limit prompts narrowing the filters.
- **End states:** *Success* — the manager has the insight and any export.

## Attendance

### 14. Staff attendance & physiotherapist availability

- **Trigger:** daily attendance is recorded, or a physiotherapist reports themselves unavailable for a date.
- **Steps:**
  1. A user with the **self-attendance** capability marks their own attendance; a user with the **attendance-management** capability records it for other staff.
  2. When a physiotherapist marks themselves **unavailable** for a date — the whole day, or only part of it — their appointments in the affected window are auto-cancelled and new bookings for it are blocked, and affected patients are notified of the cancellation.
  3. Managers review attendance across staff over a period.
- **Branches:** attendance already recorded for a person on a date is a conflict (per conventions); half-day requires an unavailable window to know which appointments to cancel.
- **End states:** *Success* — attendance recorded; an unavailability marking leaves the physiotherapist's affected schedule cleared and blocked.

_SUPER_ADMIN's only V1 journey is Flow 1 landing into the API Explorer; there is no separate platform flow._

---

# Screen Inventory

Surfaces are split by the [Navigation & Surface Model](#navigation--surface-model): **Destinations** are the scarce routed pages; **Contextual surfaces** are dialogs, drawers, tabs, and sections hosted within a destination or the shell.

Reading these tables:

- **Routes are provisional.** Final paths are settled in the Sitemap and Navigation Model sections.
- **Role tags are advisory.** They indicate who a surface is primarily *for*, to guide navigation and layout — not an authorization spec. Access is enforced server-side and surfaced to the client as a capability map (`GET /api/users/me`) per the `AGENTS.md` client-authorization model. The same feature area renders and permits differently per role.

Role key: **SA** = Super Admin · **Owner** = Org Owner · **Admin** = Org Admin · **Physio** = Physiotherapist · **Reception** = Receptionist · **All** = all four org roles.

## Shared Front Door — `(auth)`

Role-agnostic entry. No shell; standalone centered layout. Auth flows are full-screen destinations by necessity. A landing resolver (not a screen) routes authenticated users into the correct namespace.

| Destination | Purpose | Roles | Route | Feature | Phase |
| --- | --- | --- | --- | --- | --- |
| Login | Username + password sign-in; single front door for all roles | All + SA | `/login` | `auth` | F1 |
| Reset Password — Request | Request a reset link by identifier | All + SA | `/reset-password` | `auth` | F1 |
| Reset Password — Confirm | Set a new password on the session the reset link created | All + SA | `/reset-password/confirm` | `auth` | F1 |
| Invitation Acceptance | Invited user sets their initial password and activates their account | All | `/invite` | `auth` | F1 |

Non-destination frames: **Forbidden / Unauthorized** (403 / wrong-namespace) and **Session Expired** (401) render as in-shell frames or standalone fallbacks, not navigable pages. Technical, non-screen endpoints: `/auth/callback` (session handoff) and the landing resolver (post-auth redirect).

Self-service reset (request + confirm) applies only to roles with a real email — Owner, Admin, and platform users. Physiotherapists and Receptionists, whose email may be a placeholder, are reset by an Owner/Admin via a reveal-once temporary password (a Users action, F3); see Flow 2 and Flow 9.

That distinction is **UI steering, not a backend rule**. The request-reset endpoint is uniform for every role and always answers generically ("if an account exists, we've sent a link"), because deciding whether to block a role would mean disclosing something about the account to the caller. The Physio/Reception guidance lives as copy on the request screen.

## Platform Console — `(platform)/platform/…`

V1 platform surface is intentionally minimal: Super Admin gets no operational UI, only in-app API tooling.

| Destination | Purpose | Roles | Route | Feature | Phase |
| --- | --- | --- | --- | --- | --- |
| API Explorer | OpenAPI spec (generated from validators and response contracts) with same-origin try-it-out; hard-disabled in production | SA | `/platform/admin` | `platform-api` | F2 ✅ |

## Organization App — `(org)/app/…`

### Destinations (routed pages)

The scarce set of independent navigational destinations. List destinations host their entity details and actions as contextual surfaces (next table); they are not separate routes.

| Destination | Purpose | Roles | Route | Feature | Phase |
| --- | --- | --- | --- | --- | --- |
| Dashboard | Role-aware landing with summary widgets and quick actions | All | `/app` | `dashboard` | F8 |
| Patients | Browse patients; open a patient workspace | All | `/app/patients` | `patients` | F6 |
| Patient Workspace | Focused workspace for one patient: overview, appointments, records, packages, invoices | All | `/app/patients/[id]` | `patients` | F6 |
| Appointments (oversight) | Owner/Admin oversight & audit of appointments across staff and clinics; filter and review by date range. Not an operational page — daily viewing lives in the dashboard widget | Owner, Admin | `/app/appointments` | `appointments` | F6 |
| Consultation | Clinical workspace for an appointment; hosts prescriptions | Physio | `/app/appointments/[id]/consultation` | `consultations` | F6 |
| Attendance | Review staff attendance; feeds compensation & commission | Owner, Admin | `/app/attendance` | `attendance` | F6 |
| Invoices | Browse invoices (list); Reception needs this operationally | Owner, Admin, Reception | `/app/invoices` | `invoices` | F7 |
| Packages | Package catalog | All | `/app/packages` | `packages` | F5 |
| Users | Browse org users | Owner, Admin | `/app/users` | `users` | F3 |
| Clinics | Browse clinics | Owner, Admin | `/app/clinics` | `clinics` | F3 |
| Reports | Billing, commission, and physiotherapist reports (tabs); export | Owner, Admin, Physio | `/app/reports` | `reports` | F8 |
| Settings | Organization profile and subscription (tabs) | Owner, Admin | `/app/settings` | `organization` | F4 |
| Audit Log | Browse the organization audit trail | Owner, Admin | `/app/audit-logs` | `audit` | F9 |

**Patient Workspace layout (candidate):** a flexible split-screen / multi-column layout — a persistent patient summary and section nav in one column alongside a resizable working pane — is the leading candidate over plain tabs, keeping patient context in view while the clinician works. To be settled in the F6 spec.

### Contextual surfaces (no route)

Hosted within a destination or the app shell, per the surface model.

| Surface | Type | Hosted on | Roles | Feature | Phase |
| --- | --- | --- | --- | --- | --- |
| Create / Edit patient | Dialog | Patients, Dashboard | All | `patients` | F6 |
| Patient records | Tab + upload Dialog | Patient Workspace | All | `patients` | F6 |
| Package assignment & session usage | Tab + assign Dialog | Patient Workspace | Owner, Admin, Reception | `patient-packages` | F5 |
| Appointments — today / upcoming | Dashboard widget + "view all" dialog; inline quick status actions on each row | Dashboard | All | `appointments` | F6 |
| Appointment detail & status workflow | Drawer (page-level) | Patient Workspace, Appointments (oversight) | All | `appointments` | F6 |
| Schedule / Edit appointment | Dialog | Dashboard, Patient Workspace | All | `appointments` | F6 |
| Prescription | Inline section | Consultation | Physio | `prescriptions` | F6 |
| Mark attendance | Dialog / quick action | Attendance, Dashboard | Physio (own), Owner/Admin | `attendance` | F6 |
| Create invoice | Dialog | Dashboard, Invoices, Patient Workspace | Owner, Admin, Reception | `invoices` | F7 |
| Invoice detail — line items, record payment, status | Dialog | Invoices, Patient Workspace, Appointment detail | Owner, Admin, Reception | `payments` | F7 |
| Create / Edit package · activate / deactivate | Dialog | Packages | Owner, Admin | `packages` | F5 |
| User detail & compensation | Drawer | Users | Owner, Admin (compensation view + set: Owner only) | `users` | F3 |
| Create user · reset password · change role · activate / deactivate · offboard | Dialog | Users | Owner, Admin | `users` | F3 |
| Clinic detail & user–clinic assignment | Drawer + Dialog | Clinics | Owner, Admin | `clinics` | F3 |
| Create / Edit clinic · activate / deactivate | Dialog | Clinics | Owner, Admin | `clinics` | F3 |
| My account · change password | Dialog | User menu (org + platform shell) | All + SA | `auth` | F1 |
| Notifications | Bell → drawer → "view all" dialog | Shell header | All | `notifications` | F9 |

**Attendance → availability:** a physiotherapist's attendance drives their bookable availability; see Flow 14.

**Appointment check-in & detail:** appointments surface in several places — the dashboard widget, the "view all" dialog, the patient workspace appointments tab, and the Owner/Admin oversight page. Direction: quick status actions are **inline controls on each appointment row**, so the common check-in is a single action wherever the appointment appears — no Appointments page needed. On the patient workspace and oversight page, fuller detail and reschedule open the **appointment detail drawer** over that page.

**Open — dashboard widget detail:** how the dashboard appointments widget exposes *fuller* detail (reschedule, cancel, full view) is **not finalized**. Opening the shared detail drawer over the dashboard is one option but is not yet settled; an alternative approach is to be worked out and will likely take a few iterations. To be resolved during F6 implementation. Constraint to respect either way: do not stack a drawer over the "view all" dialog.

**Change-password dialog (reusable):** the change-password dialog is a reusable surface owned by the `auth` feature, decoupled from My Account so it can be invoked from several triggers with the same content:

1. **Voluntary** — from My Account. Dismissible. Ships in F1.
2. **Forced, first login** — a user created with a system-generated (reveal-once) initial password must set their own on first sign-in. Non-dismissible; blocks the app until completed. Future — not built today.
3. **Forced, on expiry** — a pre-set password expiry prompts a change at login. Non-dismissible. Future — not built today.

Forced modes (2–3) are surfaced by the post-auth landing resolver rather than scattered interceptors, and the dialog takes a `mode` / `required` flag so only the voluntary mode ships now while 2–3 stay cheap to add. Distinct from **Invitation Acceptance**, which is a full-page `(auth)` flow for *invited* users setting an initial password.

---

# Interaction & State Conventions

The cross-cutting behaviors every screen honors, defined once here so flows and per-module specs reference them instead of restating. These are advisory UX: the server remains the source of truth, and these conventions decide how its responses are *presented*. They align with the capability-gating model and the `ErrorCodes` / response envelope in `AGENTS.md`.

## State model

Every data-driven surface moves through the same states, and each has a default treatment:

- **Loading** — skeletons that match the eventual layout (not a bare spinner) for initial loads; inline progress for in-place refreshes.
- **Empty** — a purposeful empty state: one line explaining what would appear here, plus the primary action to create the first item where the user is allowed to.
- **Error (load failed)** — an inline error block with a retry, scoped to the failed region rather than replacing the whole screen.
- **Content** — the loaded surface.
- **Restricted** — actions the user lacks capability for are hidden or disabled (never shown-then-failing), gated from the capability map.

## Feedback channels

How an outcome is communicated depends on whether it is field-attributable, transient, or navigational:

- **Toast** — transient success confirmations and non-field errors.
- **Inline (field)** — validation and uniqueness problems mapped to the offending form field(s); focus the first error.
- **Blocking message** — an in-context explanation (in the form/dialog or a confirm) when an action can't proceed due to record state, with no single field to blame.
- **Full-frame / redirect** — session, permission, and not-found outcomes that replace the surface or move the user.

## Error → default behavior

The API returns `{ error, code }` for coded errors, `{ error, details }` for 400 validation, and `{ error }` for 401/500; the client parses this once into a typed error and applies the defaults below. Each default is overridable per screen where showing-then-failing would be a poor experience.

| Behavior | Triggers (status · code) | Treatment |
| --- | --- | --- |
| Redirect to sign-in | 401 unauthorized / expired session | Bounce to `/login`, preserving the return path; resume after re-auth. Handled globally (cache-level). |
| Forbidden state | 403 · `FORBIDDEN` | Safety net — actions are already capability-hidden. On a destination: forbidden frame with a way back. On an action: toast + refresh capabilities. |
| Not-found state | 404 · `NOT_FOUND`, `SUBSCRIPTION_PLAN_NOT_FOUND` | On a destination: not-found view with a way back. On an action: toast. |
| Inline field error | 400 validation (`details`); 409 uniqueness · `EMAIL_ALREADY_EXISTS`, `USERNAME_ALREADY_EXISTS`, `ORGANIZATION_NAME_ALREADY_EXISTS`, `PACKAGE_NAME_ALREADY_EXISTS` | Map to the offending field(s) via the form; "already in use" messaging for uniqueness. |
| Blocking message + resync | 409 state/transition · `INVALID_APPOINTMENT_STATUS_TRANSITION`, `INVALID_PAYMENT_STATUS_TRANSITION`, `INVALID_SUBSCRIPTION_TRANSITION`, `INVOICE_ALREADY_FINALIZED`, `PAYMENT_EXCEEDS_INVOICE_TOTAL`, `PAYMENT_ALREADY_EXISTS_FOR_INVOICE`, `PACKAGE_SESSIONS_EXHAUSTED`, `PACKAGE_EXPIRED`, `PACKAGE_CANCELLED`, `PACKAGE_SESSION_ALREADY_RECORDED`, `CONSULTATION_ALREADY_EXISTS`, `ATTENDANCE_ALREADY_RECORDED`, `ATTENDANCE_CHECK_IN_REQUIRED`, `PATIENT_HAS_DEPENDENT_RECORDS`, `PACKAGE_HAS_ACTIVE_ASSIGNMENTS`, `PATIENT_PACKAGE_HAS_REFERENCES` | Explain why the action can't proceed in context, then refetch so the now-stale UI reflects current state. No field to blame. |
| Limit / subscription enforcement | 402 · `SUBSCRIPTION_REQUIRED`; 403 · `ORGANIZATION_LIMIT_EXCEEDED` | Dedicated enforcement state: state the limit and its resolution (renew / upgrade) for the Owner; other roles see a softer "ask your owner" message. |
| Non-field request error | 400 · invalid payload, `REPORT_ROW_LIMIT_EXCEEDED` | Toast; for the row limit, guidance to narrow the filters / date range. |
| Unexpected error | 500 · internal, network failure | Toast "Something went wrong" with a retry; error logged. Handled globally. |

**F3 note:** the create-user and create-clinic dialogs do not yet build the dedicated enforcement state above — they use the generic 402/403 toast (this table's default), with no per-screen message and no Owner/other-role distinction, and the dialog simply stays open with input intact. This is a deliberate interim, not an oversight: F4 owns *Subscription Plan Selection*, *Activation & Renewal*, and *Limit Enforcement States*, and replaces this generic toast with the role-varying dedicated state described above.

**F4 note:** the dedicated enforcement state above is built and adopted at exactly two of the seven call sites that can throw `SUBSCRIPTION_REQUIRED` — create-user and create-clinic (`organization.service.ts`), which are also the only two `ORGANIZATION_LIMIT_EXCEEDED` sites. The remaining five `SUBSCRIPTION_REQUIRED` sites (`appointment.service.ts`, `invoice.service.ts`, `payment.service.ts`, `patient-package.service.ts` ×2) still use the F3-era generic toast, unchanged. This is a deliberate scope boundary, not an oversight: F4 owns the component and its first adoption; F5–F7 adopt it at the appointment, invoice/payment, and patient-package surfaces they each build.

## Mutation feedback

Default is **pessimistic**: the action shows progress, awaits the server, then confirms with a toast and refetches (invalidates) the affected data. Optimistic updates are a deliberate per-action promotion, decided in the relevant module's F-phase spec — not the baseline — because they depend on the specific operation's failure cost.

## Destructive & irreversible actions

Actions that remove access, remove data, or can't be casually undone (delete, deactivate, offboard, cancel) require explicit confirmation before they run — never a single unguarded click.

- **Confirm with consequence, not "Are you sure?".** The confirmation names the specific target and the effect ("Deactivate Dr. Menon? They lose access until reactivated."), and its confirm button carries the action's verb and danger styling.
- **Weight matches reversibility.** Most removals are soft (deactivate / archive via soft-delete) and reversible — a standard confirm suffices, and the success toast may offer **Undo**. Truly irreversible or high-blast-radius actions (hard delete, user offboarding, cancelling an appointment with downstream effects) use a stronger confirmation and do not offer Undo.
- **Dependency-blocked removals are explained, not hidden.** When a record can't be removed because it has dependents (`PATIENT_HAS_DEPENDENT_RECORDS`, `PACKAGE_HAS_ACTIVE_ASSIGNMENTS`, `PATIENT_PACKAGE_HAS_REFERENCES`), show the blocking message from the error table and offer the safe alternative where one exists (e.g. deactivate instead of delete).
- **Placement & styling.** Destructive controls use the danger role color and are separated from primary/confirm affordances so they are not triggered by accident; they remain capability-gated like any action.
- **Feedback.** Pessimistic — await the server, then confirm via toast and reflect the new state (the item leaves the list or shows as inactive).

## Unsaved changes

A surface with unsaved edits guards against losing them. "Unsaved" means the form is **dirty** — a value has changed from its initial state; an untouched or already-saved form closes freely.

- **In-app dismissal** — closing a create/edit dialog or drawer (close button, backdrop click, Esc) or navigating to another destination while dirty prompts a **"Discard changes?"** confirm offering *Keep editing* / *Discard*. Discarding drops the edits; keeping returns to the surface with input intact.
- **Hard browser events** — a page refresh, tab/window close, or browser back on a dirty surface triggers the browser's native leave-site prompt as a last-resort guard. Its wording is browser-controlled and deliberately generic, so it backstops rather than replaces the in-app confirm.
- **After a successful save** — the surface is no longer dirty and closes without a guard.
- **Scope** — applies to create/edit forms and other multi-field input surfaces. Read-only views and single-tap actions don't need it; destructive actions are already guarded by their own confirm. Any autosaving surface is exempt and settled per module.

## Concurrency & stale data

Reads are cached, so a surface can show data that has moved on since it loaded. The server is the source of truth and already guards state transitions, so the client does not run its own optimistic concurrency by default.

- **The server rejects stale writes.** When a write lands on data that has changed — a status already advanced, an invoice already finalized, a session already recorded — the backend returns a state/transition conflict (the 409 codes in the error table). These use **blocking message + resync**: tell the user the record changed, refetch to show the current state, and let them retry against fresh data. Never silently retry a rejected write.
- **Freshness after mutations.** Every successful mutation invalidates the affected queries so lists and detail reflect the change immediately. High-churn surfaces (the appointments board, invoices) may additionally refetch on window refocus — decided per module.
- **Acting on state that can move.** Where a surface shows an item whose state can change under the user (appointment status, payment status, remaining package sessions), the action is gated on current state and, on conflict, resyncs rather than forcing through.
- **Last-write-wins vs. versioned.** The baseline is last-write-wins for simple field edits, relying on the server's state guards for the operations that matter. Optimistic concurrency (a version / `updated_at` check) for a specific high-contention or high-value edit is a per-module promotion, settled in its F-phase spec — not the baseline.

## Failure atomicity & compensation

A failed action never leaves partial state, but atomicity is scoped to a single command — not to a multi-step flow.

- **Within one command.** The backend applies each state-changing operation atomically (multi-row writes via database functions) and compensates effects on external systems that can't share a transaction — auth, file storage — surfacing the failure only after compensation. In the UI: after a failed action, the surface reflects the pre-action state and the user can safely retry.
- **Across steps.** Independent steps are separate commands, not one transaction. Attaching a record after creating a patient is its own operation; its failure does not unwind the created patient — the patient stands and the record simply isn't added. Flows call out where a step's failure leaves earlier steps intact.
- Grounded in `AGENTS.md` — *Database Functions for Atomic Operations* and *External System Consistency*.

## Scope note

This is the baseline catalog. Per-screen refinements (which fields a specific form validates, whether a specific mutation is optimistic, bespoke empty-state copy) are settled in each module's F-phase spec and may override these defaults, but not silently diverge from them.

---

# Content & Layout Conventions

The UX layer above Mantine: app-shell regions, page and collection patterns, form and dialog norms, and copy conventions. Structure and pattern live here; the design language they draw on is the Visual Foundation below, implemented as the single Mantine theme per `AGENTS.md`. Per-module refinements are settled in each F-phase spec and may extend these, not silently diverge.

## Visual Foundation

The design language: **calm and clinical** — a muted teal on cool neutrals, generous whitespace, restrained accents, so long shifts in the app stay low-stress. These are the decisions; the single Mantine theme is their implementation, and components consume theme tokens rather than literal values.

**Primary — teal.** A desaturated blue-green: trustworthy and clinical without feeling cold. Base `#158B81` — AA for UI components and large text on white (4.17:1); **filled controls use shade 7 (`#0F7168`, 5.86:1)** to meet AA for normal text, since a button label is body-sized text. Darker steps also serve hover/active and text-on-light; lighter steps serve tints and selected states.

**Neutrals — cool gray.** Tuned slightly cool to sit with the teal. Page `#F7F9F9`, cards and panels white, primary text `#2A3333`, secondary `#5F6C6C`, borders `#DCE3E3`.

**Semantic roles.** Success `#1F7A4D` · Warning `#B26A00` · Danger `#B3261E` · Info `#1F6FA8`, plus a neutral drawn from the gray scale. Each is a full scale, so badges and banners take a light tint. Domain statuses (appointment, payment, package) map onto these roles rather than inventing new colors, and always pair color with text (per Accessibility).

Badges render the **light** pairing — dark role text (shade 9) on a pale role surface (shade 1) — which measures 9.5:1 to 11.6:1, comfortably above AA for normal text. Filled usage puts white text on shade 7 (5.9:1 to 8.5:1). The shade-6 base values above are the palette's identity, not its text-on-color values: white on Warning `#B26A00` is 4.24:1 and would fail AA for normal text, so filled controls never use shade 6. These ratios are asserted in `tests/unit/semantic-contrast.test.ts`, which fails the build if a palette or theme change drops any role below AA.

**Typography — Inter.** Page title 24 · section 18 · body 14 · caption 12, with two weights (regular 400, medium 500). Body 14 is the default for tables, forms, and detail; long-form text uses generous line height.

**Shape & spacing.** Radii 4 / 8 / 12 for inputs, cards, and dialogs — soft but not playful. Spacing on a 4px base, favouring whitespace over density.

**Color scheme.** V1 ships **light mode only**. The theme is structured so a dark scheme can be added later without reworking components — surfaces, text, and borders are referenced as semantic tokens, never as literal colors.

## App-shell regions

Three shells, matching the route groups:

- **Organization shell** (`(org)/app`) — a persistent left **primary navigation** (role-aware, capability-filtered), **expanded by default and collapsible** to an icon rail so the user can reclaim width, with the choice remembered per device; a **top bar** carrying the working context on the left and global affordances on the right (notifications bell, user menu); and the **content region** below.
- **Platform shell** (`(platform)/platform`) — top bar with the user menu only; no primary navigation in V1.
- **Auth** (`(auth)`) — no shell; a centered, single-column layout on a plain background.

The shell is stable furniture: navigating between destinations swaps the content region, never the shell. Contextual surfaces (dialogs, drawers) layer over the content region without disturbing it.

### Working context & user menu

Organization users work within an organization and a current clinic, and both stay discoverable:

- **Desktop top bar** shows the working context as **Org (Clinic)**. On narrow widths the bar keeps only the page title, and the context moves into the user menu — never dropped.
- **The user menu** is identical on every device: the user's name and role, the organization as a label, a **clinic dropdown**, then account actions (My account, Change password) and Log out.
- **Clinic switching** happens in that dropdown. It lists the clinics the user may work in — for Owner/Admin, all of the organization's. The current clinic reads as the field's value, so the menu keeps a fixed height however many clinics exist. Selecting one re-scopes the app and returns the user to the destination they were on.
- On **desktop** the dropdown supports type-to-filter with keyboard selection; on **mobile** it stays a plain list, since an on-screen keyboard would cover the options.

## Page structure

Every destination shares a predictable frame:

- **Header** — the destination title, optional one-line context, and at most one **primary action** aligned top-right ("New patient", "Create invoice"); further actions are secondary.
- **Nested destinations offer a clear way back** — a destination reached from another (e.g. a patient from Patients) shows its parent and a return path.

## Collections

Destinations that browse records (Patients, Invoices, Users, Clinics, Packages) share a common shape:

- A collection is rendered in whatever form best suits its content and the viewport — table, cards, calendar, gallery, timeline — adapting responsively (per Responsive behavior).
- A **toolbar** provides search, filtering, sorting, and pagination.
- Opening an item preserves the user's working context wherever practical, using the contextual surface or destination defined by the Screen Inventory.
- Loading, empty, and error states follow the Interaction & State Conventions; the empty state names what would appear and offers the primary create action where permitted.

**F3 note:** the Users collection's role-filter dropdown is sourced from the same server-supplied `assignableRoles` list the create-user and change-role pickers use (client never hardcodes role names). This is a deliberate interim that avoided adding a dedicated roles endpoint: an Administrator's filter therefore offers only the roles they may assign (Physiotherapist, Receptionist), not every role that exists in the organization — the collection itself still lists every user regardless of role, so this only narrows the filter's own options, not what's visible. The underlying conflation is that `assignableRoles` answers "which roles may I assign," and F3 is reusing it to answer a different question, "which roles exist to filter by." A later phase should decide this deliberately — e.g. a role list scoped to "roles present among visible rows," independent of assignment permission — rather than silently inheriting today's shortcut.

## Forms

- **Single column by default**, labels above inputs, related fields grouped into titled sections for longer forms.
- Required fields are marked; helper and error text sit beneath the field (inline validation per conventions).
- **Actions in a footer**, primary on the right; the primary is disabled while submitting and shows progress (pessimistic per conventions).
- Create/edit forms are hosted in **dialogs**; a long or multi-step form may promote to a drawer or its own section — decided per module.

## Dialogs & drawers

- **Dialogs** are centered, modal, sized to their content — used for create/edit and short focused tasks. Titled header with a close affordance; footer action row.
- **Drawers** slide from the right over the content region — used for entity detail/peek that keeps the list in view. Same header/close pattern.
- Both trap focus, close on explicit action or Esc, and honor the unsaved-changes guard (conventions). Do not stack a drawer over a dialog.

## Responsive behavior

PhysioCare is **fully responsive** — desktop, tablet, and smartphone are all first-class, supported targets. Responsive behavior is built into the app shell and every surface from F0 onward; F10's responsive/mobile pass is final hardening and QA, not where mobile support begins.

Adaptation conventions:

- **App shell** — the persistent left navigation collapses behind a menu on narrow widths; the top bar and its affordances remain, with the working context moving into the user menu.
- **Primary action** — a destination's primary action sits top-right in the page header on wider screens; on narrow widths it becomes a **floating action button**, so it stays reachable one-handed while scrolling. Collections leave bottom padding so it never covers the last item.
- **Dialogs & drawers** — on small screens, dialogs go full-screen and drawers become full-width or a bottom sheet; the same content and actions, adapted to the width.
- **Tables** — the primary reflow challenge: on narrow widths a table keeps its essential columns and either scrolls horizontally or collapses each row into a stacked card; per-list priority columns are decided in the module spec.
- **Split layouts** — the patient workspace's multi-column layout stacks (or becomes tabbed) below its breakpoint, keeping the patient context on top.
- **Forms** — already single-column, so they adapt with minimal change; controls and touch targets stay comfortably tappable on touch devices.

Breakpoints and spacing come from the Mantine theme, not restated here.

## Accessibility

Accessibility is founded from the start, not deferred: **WCAG 2.2 AA** is the target, built into the app shell and every surface from F0 onward; F10's accessibility pass is audit and hardening, not where accessibility begins.

- **Keyboard** — every interaction is reachable and operable by keyboard, with a visible focus indicator and a logical focus order. Dialogs and drawers trap focus and return it to the trigger on close.
- **Semantics & labels** — surfaces use meaningful structure and roles so assistive technology can announce them; every form field has an associated label, and validation errors are announced, not conveyed by color alone.
- **Contrast & color** — text and essential UI meet contrast minimums, and color is never the only cue for meaning (status carries text or an icon too).
- **Motion** — the user's reduced-motion preference is honored for transitions and animation.

Contrast-safe color and focus tokens come from the Mantine theme, not restated here.

## Copy & formatting

- **Sentence case** for labels, headings, and buttons; buttons name the action ("Save changes", not "OK").
- Use the domain's terms consistently — patient, appointment, consultation, prescription, invoice, package, clinic — and role **display names** (Owner, Administrator, Physiotherapist), never system role codes, in the UI.
- Dates, times, and currency follow the organization's locale; amounts always show their currency.
- Copy is concise and specific; empty states and confirmations state the consequence (per conventions), not generic boilerplate.
- **Write for clinic users, not engineers.** Use plain, everyday language; avoid technical or internal jargon, abbreviations, and system terms the staff wouldn't use.
- **Human messages, never codes.** Users see plain, actionable messages (what happened and what to do), never raw error codes or system errors — the internal `ErrorCodes` are mapped to user-facing copy.
