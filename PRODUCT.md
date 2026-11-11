# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **College Students (Primary Consumer):** Undergraduate and graduate students submitting academic coursework, research papers, lab reports, and flyers remotely without flash drives or standing in physical counter queues.
- **Print Center Operators & Shop Staff:** Student-workers and campus staff processing the incoming FIFO queue, printing verified jobs on connected physical printers, and placing printouts in pickup trays.
- **Campus Administrators:** IT and facilities managers monitoring print volumes, printer usage reports, user accounts, and security audit logs.

## Product Purpose

PrintEasy replaces unorganized walk-up print queues, USB thumb-drive malware vectors, and lost print orders with a centralized, browser-based printing management system for college print centers.

Success means:
1. Students upload and configure print jobs from mobile or desktop in under 60 seconds.
2. Staff manage a live, FIFO-sequenced queue with single-click PDF downloads and instant status transitions.
3. Students receive immediate in-app pickup notifications and collect printouts via shop self-service.

## Positioning

Unlike commercial enterprise print management software that requires heavy proprietary client drivers and deep campus Active Directory infrastructure, PrintEasy is a zero-install, lightweight modular monolith designed specifically for single-college print centers with manual staff-controlled printing (Option A).

## Operating Context

- **Submission:** Responsive web application running on student laptops and mobile devices over campus Wi-Fi.
- **Production:** Dedicated print-center workstation connected to physical high-volume laser printers.
- **Pickup Ritual:** Hybrid self-service counter and designated pickup trays in the campus print center.
- **Economics:** Staff-managed courtesy campus service for initial rollout with zero credit card gateways.

## Capabilities and Constraints

- **Confirmed Functionality:**
  - Role-based access control across Student, Staff, and Administrator roles.
  - Strict PDF validation: `%PDF-` magic bytes header check, terminal `%%EOF` verification, and active scripting rejection (`/JavaScript`, `/Launch`).
  - Private filesystem storage with randomized UUID keys; zero direct public URLs.
  - Print configuration: copies (1-100), color mode (`bw`, `color`), duplex (`single`, `double`), page ranges, and paper size.
  - Deterministic state machine: `PENDING` → `PROCESSING` → `READY` → `COLLECTED`, with failure and cancellation paths.
  - In-app notification center for pickup alerts and job state changes.
  - Forensic audit logging for security compliance and incident review.
- **Technical Constraints:**
  - Strict 10 MB file size upload ceiling.
  - Restricted exclusively to PDF format (`.pdf`).
  - Single college print center scope for initial release.

## Brand Commitments

- **Name:** PrintEasy
- **Personality:** Dependable, academic, efficient, restrained, and trustworthy.
- **Visual Identity:** Clean institutional utility — high contrast, legible typography, clear state signaling, and zero superfluous decoration.

## Evidence on Hand

- **Architecture:** Documented in `ARCHITECTURE.md` with module boundaries and ADRs.
- **Database Schema:** Documented in `DATABASE_SCHEMA.md` with 7 core tables and Alembic migrations.
- **Security & Threat Model:** Documented in `SECURITY_REVIEW.md` with STRIDE threat matrix and IDOR mitigation policies.
- **Automated Verification:** 24 passing automated tests in `backend/tests/` covering end-to-end lifecycle, PDF validation, and access control.

## Product Principles

1. **Protect Student Privacy First:** Student coursework, personal files, and research documents must never be accessible across accounts or exposed via predictable URLs.
2. **Software Respects Physical Reality:** A print request is only `READY` when physical ink is on paper and staged for student pickup. Software status must never assume printer hardware success without human or operator verification.
3. **Frictionless Submission, Clear Expectations:** Eliminate friction at upload time, validate immediately, and keep students informed of exact job status so they never wait in line guessing.
4. **Resilient Simplicity Over Infrastructure Bloat:** Build for dependable operation on modest hardware; avoid microservices and external message brokers where atomic database transactions solve the problem cleanly.

## Accessibility & Inclusion

- Adherence to WCAG 2.1 AA standards for color contrast across all badge and status indicators.
- Keyboard-navigable forms and tables with visible focus rings.
- Semantic HTML tags, ARIA alert attributes on notifications, and clear textual descriptions alongside status colors.
