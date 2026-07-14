# PhysioCare Roadmap

This document defines the high-level development roadmap for the PhysioCare SaaS platform.

Its purpose is to provide visibility into the planned implementation phases and overall project direction.

Implementation details, architecture, coding conventions, and engineering standards are defined in `AGENTS.md`.

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

# Phase 1 – Foundation ✅

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

# Phase 2 – Authentication ✅

Authentication and access control.

- Setup Authentication Flow
- Setup Login Screen
- Setup Protected Routes
- Setup User Session Management

---

# Phase 3 – Organization Onboarding ✅

Provisioning a new organization.

- Setup Organization Bootstrap Flow
- Setup Create Organization Flow
- Setup Create Organization Admin Flow
- Setup Organization Bootstrap API
- Setup Organization User Onboarding

---

# Phase 4 – Organization Administration ✅

Core administration modules.

- Setup User Management Module
- Setup Clinic Management Module
- Setup User-Clinic Assignment Module

---

# Phase 5 – Clinical Operations ✅

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

# Phase 6 – Shared Platform Features ✅

Cross-cutting infrastructure.

- Implement Role Guards
- Implement Organization Context
- Implement Clinic Context

---

# Phase 7 – Reporting & Analytics ✅

Business intelligence and reporting.

- Implement Billing Reports
- Implement Physiotherapist Reports
- Implement Dashboard Widgets
- Implement Excel Export APIs
- Implement PDF Generation

---

# Phase 8 – Advanced Business Logic

Domain-specific workflows.

- Implement Appointment Status Tracking
- Implement Package Session Consumption Logic
- Implement Commission Calculations
- Implement Monthly Commission Reports
- Implement Subscription Enforcement
- Implement Subscription Renewal Workflow
- Implement Organization Limits Enforcement

---

# Phase 9 – Operations & Deployment

Operational readiness.

- Setup Error Logging
- Setup Activity Monitoring
- Setup Backup Strategy
- Setup CI/CD
- Setup Staging Environment
- Setup Production Environment

---

# Phase 10 – Testing & Release

Release validation.

- End-to-End Testing
- UAT Testing
- Production Launch
- Post-Launch Monitoring

---

# Phase 11 – Documentation

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