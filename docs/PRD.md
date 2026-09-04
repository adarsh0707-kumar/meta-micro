# meta-micro — Product Requirements

## 1. Problem

A small coaching institute in Patna — typically 40 to 300 students across a
handful of batches — runs on a paper register and a personal WhatsApp account.
The owner spends the first week of every month chasing fee payments one message
at a time, attendance lives in a notebook nobody can query, and parents hear
from the institute only when something has gone wrong. Existing school ERPs are
priced and shaped for 1,000+ student schools: too many modules, English-only,
and too expensive to justify.

## 2. Users

| Role | In the product | What they need |
| --- | --- | --- |
| **Institute admin** (owner) | `UserRole.admin` | Enrols the institute, adds batches/students/templates, runs fee collection, sends broadcasts, configures automations, invites teachers |
| **Teacher** | `UserRole.teacher` | Marks attendance, enters test marks, looks up a student |
| **Parent** | not a user — a recipient | Receives fee reminders and progress updates on WhatsApp, in Hindi or English |

Parents never log in. That is deliberate: an app install is the single biggest
adoption barrier for this audience, so the product reaches them through WhatsApp,
which they already use.

Admin-only endpoints today: automations (read + write) and teacher invites.
Everything else is available to any authenticated user in the institute.

## 3. Scope

### In scope (built)

1. **Institute enrolment** — self-serve signup creates the institute and its
   first admin in one step, returning a session token immediately.
2. **Roster** — batches (name, subject, schedule days, timing, monthly fee) and
   students (contact details, parent details, admission date, per-student fee
   override, active flag). Students search by name and filter by batch.
3. **Fees** — one fee row per student per `YYYY-MM` period, with amount due,
   amount paid, status, and due date. Mark-paid records the paid amount and
   timestamp. A summary endpoint totals outstanding money and counts by status.
4. **Attendance** — per batch, per date, one of present/absent/late per student.
   Re-submitting the same date updates the existing rows rather than duplicating.
5. **Test scores** — marks obtained out of max marks per named test, plus a
   per-batch report that aggregates each student's percentage and ranks them.
6. **Message templates** — named, bilingual (`en`/`hi`) bodies in two categories,
   `fee_reminder` and `parent_update`, with `{placeholder}` substitution.
7. **Broadcasts** — pick a template and a set of students; each recipient gets a
   personalised WhatsApp message. Every attempt is logged with its status.
8. **Automations** — per category, an admin enables a day-of-month trigger bound
   to a template. A daily scheduler fires the matching ones.
9. **Bilingual UI** — the whole interface ships in English and Hindi; the
   institute's default language is chosen at signup and applied on login.

### Out of scope (deliberately not built)

- Parent-facing login, app, or portal.
- Online fee payment or payment-gateway integration — the app records payments
  the institute collects offline.
- Timetable generation, homework, study material, or video classes.
- Multi-branch institutes, or any hierarchy above a single institute.
- Inbound WhatsApp — messages are send-only; replies are not read or routed.

## 4. Core flows

1. **Enrolment** — admin signs up at `/signup` → institute + admin user created,
   JWT returned and stored → lands on `/app/setup`.
2. **Setup** — the Setup page shows a checklist driven by `GET /api/setup/status`
   (has batches / has students / has templates) so a new institute knows what is
   still missing. Students can be bulk-imported via `POST /api/setup/import-students`.
3. **Daily teaching** — a teacher opens Attendance, picks a batch and date, marks
   each student, submits. Later, Test Scores for marks entry.
4. **Monthly collection** — admin reviews Fees, marks payments as they arrive,
   then opens Fee Reminders, picks a Hindi or English template, selects the
   unpaid students, and sends.
5. **Hands-off reminders** — admin sets the fee-reminder automation to day 5 with
   a chosen template. Each day at 09:00 the scheduler checks for matching
   automations and messages every student with an unpaid fee.

## 5. Requirements that shaped the build

- **No WhatsApp credentials required to develop.** Messaging goes through a
  provider interface whose default implementation logs instead of sending, so
  the app runs end to end on a laptop with no Meta account.
- **Every send is auditable.** Manual and automated sends both write a
  `message_logs` row with the rendered body, recipient, status, and provider
  response — an institute must be able to prove what was sent to whom.
- **Hindi is a first-class language, not a translation afterthought.** Templates
  carry their own language field so an institute can keep parallel Hindi and
  English versions of the same message.
- **One tenant per institute.** Every domain table carries `institute_id` (or
  reaches one through its student), and queries filter on the caller's institute.

## 6. Success measures

- An institute completes setup — first batch, first student, first template —
  in one sitting without support.
- Fee reminders for a full month go out in under two minutes of admin time.
- Attendance for a batch is markable in under 30 seconds.
- Outstanding fees are visible as a single number at any moment.

## 7. Design direction

From the SRD's "muse" section: cream `#FAF3E0` ground, coral `#FF6F61` primary,
gold `#FFD700` accent, `#333333` ink, Sora for headings and Outfit for body,
chunky rounded cards with an offset drop shadow, and a character-led animated
landing hero. The tone is warm and approachable rather than corporate — the
audience is a teacher, not a CFO.
