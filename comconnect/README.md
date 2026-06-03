# ComConnect Phase 4.6: Fully Wired Dashboard Actions

This pack removes the placeholder dashboard actions from Phase 4 V3/4.5 and replaces them with real wired components.

## Built on

Apply these first:

```txt
Phase 1 V4
Phase 2 V3
Phase 3 V3
Phase 4 V3 Large-Scale Dashboard Operations
Phase 4.5 UI Polish
```

## What this adds

- Real server-side search
- Real server-side filters
- Real cursor pagination
- Real row selection
- Real select-all-visible
- Real bulk archive
- Real bulk status update
- Real row-level archive
- Real row-level status update
- Confirmation before destructive actions
- Parent-page navigation on module pages
- Compact horizontal card style retained
- No placeholder buttons

## Important

This phase does not change the database because Phase 4 V3 already added the required archive/index migration.

This pack replaces high-volume pages with client-powered large-table pages that call the Phase 4 V3 APIs.

## Pages wired

```txt
/participants
/participant-groups
/education-library
/questionnaires
/consent-forms
/health-checkins
/appointments
/referrals
/inbox
/chat
/push-queue
/fallback-rules
/voice-tasks
/audit-logs
```

## APIs used

These pages call:

```txt
/api/large-table/<module>
/api/large-table/<module>/bulk-action
```

Audit logs are read-only and do not have bulk actions.

## Copy instructions

Copy the `src` folder into your ComConnect project.

Do not overwrite your `.env.local`; merge missing values only.


## Phase 4.7 review fixes included

This reviewed pack includes fixes after checking Phase 4.6:

- Health observations now support `status` for archive/status dashboard actions.
- Fallback rules now support `status` for dashboard actions while retaining `enabled`.
- Search/filter submit no longer causes stale cursor reloads.
- The observations table now distinguishes `severity`, `alert_status`, and workflow `status`.

Run:

```txt
supabase/migrations/004b_dashboard_action_wiring_support.sql
```

after the Phase 4 V3 migration.
