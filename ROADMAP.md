# PhysioCare Roadmap

This document defines the high-level development roadmap for the PhysioCare SaaS platform.

Its purpose is to provide visibility into the planned implementation phases and overall project direction.

Implementation details, architecture, coding conventions, and engineering standards are defined in `AGENTS.md`.

User experience conventions — information architecture, user flows, screen inventory, and interaction/state patterns — are defined in `UX.md`. Frontend (F-phase) implementation plans author their per-module UX spec and reference it.

Individual implementation plans are created separately for each module before development begins.

---

# Guiding Principles

Development follows an incremental, phase-based approach.

Each phase builds upon the previous one while preserving the existing architecture unless business requirements explicitly require a change.

Before implementing any module:

- Produce a detailed implementation plan.
- Follow Test-Driven Development (TDD).
- Update Architecture Decision Records (ADRs) when architectural decisions change.
- Update `AGENTS.md` when introducing new engineering conventions.
- Complete the Phase Completion Checklist before considering the module complete.

---

# Phase R1 – Foundation ✅

Infrastructure and platform setup.

- Setup Supabase
- Create Table Migrations
- Configure RLS
- RLS Policies for Tables
- Configure Supabase Storage Buckets
- Configure Storage RLS Policies
- Create Seed Data
- Generate TypeScript Types
- Setup Supabase Client (Browser)
- Setup Supabase Client (Server)
- Setup Supabase Middleware

---

# Phase R2 – Authentication ✅

Authentication and access control.

- Setup Authentication Flow
- Setup Login Screen
- Setup Protected Routes
- Setup User Session Management

---

# Phase R3 – Organization Onboarding ✅

Provisioning a new organization.

- Setup Organization Bootstrap Flow
- Setup Create Organization Flow
- Setup Create Organization Admin Flow
- Setup Organization Bootstrap API
- Setup Organization User Onboarding

---

# Phase R4 – Organization Administration ✅

Core administration modules.

- Setup User Management Module
- Setup Clinic Management Module
- Setup User-Clinic Assignment Module

---

# Phase R5 – Clinical Operations ✅

Core business modules.

- Setup Patient Management Module
- Setup Patient Records Upload Module
- Setup Package Management Module
- Setup Patient Package Assignment Module
- Setup Appointment Management Module
- Setup Consultation Module
- Setup Prescription Module
- Setup Invoice Module
- Setup Payment Module
- Setup Attendance Module
- Setup Notification Module
- Setup Audit Log Capture

---

# Phase R6 – Shared Platform Features ✅

Cross-cutting infrastructure.

- Implement Role Guards
- Implement Organization Context
- Implement Clinic Context

---

# Phase R7 – Reporting & Analytics ✅

Business intelligence and reporting.

- Implement Billing Reports
- Implement Physiotherapist Reports
- Implement Dashboard Widgets
- Implement Excel Export APIs
- Implement PDF Generation

---

# Phase R8 – Advanced Business Logic ✅

Domain-specific workflows.

- Implement Appointment Status Tracking
- Implement Package Session Consumption Logic
- Implement Commission Calculations
- Implement Monthly Commission Reports
- Implement Subscription Enforcement
- Implement Subscription Renewal Workflow
- Implement Organization Limits Enforcement

---

# Phase F0 – Foundation ✅

Shared UI groundwork.

- Add Current-User Endpoint (`GET /api/users/me`)
- Setup Component Library & Design System
- Setup Theme & Typography
- Establish Responsive Layout Foundations
- Establish Accessibility Foundations
- Build Role-Aware App Shell
- Setup Platform & Organization Namespaces
- Build Route Guards (Role Group)
- Build Current-User Contract
- Build Typed API Client
- Build Shared UI Primitives

---

# Phase F1 – Authentication & Session ✅

Entry and identity.

- Build Login Page (Username Login)
- Build Role-Aware Landing Resolver
- Setup Invitation Acceptance Flow
- Setup Password Reset Flow
- Setup Change Password
- Handle Unauthorized / Forbidden / Expired States

---

# Phase F2 – Platform API Tooling ✅

SUPER_ADMIN API explorer.

- Generate OpenAPI Spec from Validators
- Setup OpenAPI Spec Endpoint
- Build In-App API Explorer
- Setup Same-Origin Try-It-Out Auth
- Setup Role / Env Guard

---

# Phase F3 – Org: Users & Clinics ✅

People and locations.

- Build User Management Module
- Setup Reveal-Once Initial Password
- Build User Activation & Deactivation
- Build Role Change
- Build User Offboarding
- Build User Compensation View
- Build Clinic Management Module
- Build Clinic Activation & Deactivation
- Build User-Clinic Assignment Module

---

# Phase F4 – Org: Setup & Subscription ✅

Organization control surface.

- Build Organization Profile & Settings
- Build Subscription Plan Selection
- Build Subscription Activation & Renewal
- Build Plan Limits & Usage Display
- Handle Limit Enforcement States

---

*Prerequisite: Patient Package Status Redesign (backend correctness fix, see `AGENTS.md` → Project Decisions).*

*Prerequisite: Unsubscribed Organization Write Enforcement (backend correctness fix, see `AGENTS.md` → Project Decisions).*

# Phase F5 – Patients & Packages ✅

Patient records and the package catalog.

- Build Patient Management Module
- Build Patient Records Upload
- Build Package Management Module
- Build Package Activation & Deactivation
- Build Patient Package Assignment
- Build Package Session Usage View

---

*Prerequisite: Physiotherapist Availability (backend feature, see `AGENTS.md` → Project Decisions).*

# Phase F6 – Clinical Operations ✅

Day-to-day clinic.

- Build Appointment Management Module
- Build Appointment Status Workflow
- Build Consultation Module
- Build Prescription Module
- Build Attendance Module

---

# Phase F7 – Billing

Invoicing and payments.

- Build Invoice Management Module
- Build Invoice Line Items
- Build Payment Recording
- Build Payment Status Updates

---

# Phase F8 – Reporting & Analytics

Dashboards and reports.

- Build Dashboard Widgets
- Build Billing Report View
- Build Commission Report View
- Build Physiotherapist Report View
- Build Excel & PDF Export Triggers

---

# Phase F9 – Notifications & Audit

Visibility surfaces.

- Build Notification Center
- Build Audit Log Viewer
- Decide and fix `notifications_select_policy`, which admits `ORG_ADMIN` but not `ORG_OWNER` while `notification.service.ts` treats Owner as a manager. Surfaced by the Physiotherapist Availability phase (which works around it via `insertNotificationWithoutReturn`) and deliberately left to this phase: fixing it means deciding *who may read a patient notification row*, which belongs with the surface that reads them — F6 builds no notification surface, so a policy widened there would ship with nothing exercising it through a real session.

---

# Phase F10 – Polish & Release Readiness

Hardening before launch.

- Responsive & Mobile Hardening
- Accessibility Hardening
- Empty / Loading / Error States
- End-to-End Testing
- Performance & Bundle Budget
- Feature-boundary ESLint rule (deferred from F0: enforce that cross-feature imports go through each feature's `index.ts` barrel — `AGENTS.md` → Project Structure)
- API Tooling: SUPER_ADMIN organization context (deferred from F2)

---

# Phase R9 – Operations & Deployment

Operational readiness.

- Setup Error Logging
- Setup Activity Monitoring
- Setup Backup Strategy
- Setup CI/CD
- Setup Staging Environment
- Setup Production Environment
- Retrofit audit logging to the features still uncovered (see `AGENTS.md` → *Audit Logging*). F5 and F6 each covered their own surface area, so what remains is:
  - **Add coverage where none exists** — `user.service.ts`, `clinic.service.ts`, `user-clinic.service.ts`, `notification.service.ts`.
  - **Migrate the throwing call sites** in `invoice.service.ts`, `payment.service.ts`, `organization.service.ts` and `subscription.service.ts` from `recordAuditLog` onto `recordAuditLogSafe`, so a failed audit can no longer fail the operation it records.
  - *No longer owed:* appointments (create/update/every status transition/delete/auto-cancel), consultations, prescriptions, and attendance (record/correct/check-out) — covered by F6 and the availability phase.
- Work the soft-delete exemption list down to its legitimate entries — the ten `PENDING_R9` reads in `tests/unit/soft-delete-liveness.test.ts` each need a judgment: add the filter, or record why the read needs deleted rows

---

# Phase R10 – Testing & Release

Release validation.

- End-to-End Testing
- UAT Testing
- Production Launch
- Post-Launch Monitoring

---

# Phase R11 – Documentation

Project documentation.

- Data Retention & Audit Log Archival Strategy
- Technical Documentation
- Admin User Manual
- Clinic User Manual
- Deployment Runbook

---

# Development Workflow

Each module follows the same lifecycle:

1. Define implementation plan.
2. Review architecture.
3. Write automated tests.
4. Implement production code.
5. Verify:
   - TypeScript compilation
   - Production build
   - Unit tests
   - Integration tests
   - API tests
6. Update documentation if required.
7. Mark the module complete.

A phase is considered complete only when all modules within that phase have been completed.