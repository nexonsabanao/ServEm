# Operations and Incident Runbooks

Create a named owner and test these runbooks in staging before production. Place exact vendor commands, console URLs, phone trees and escalation contacts in a restricted operational system—not in public documentation.

## 1. Minimum operational ownership

- **Incident commander:** coordinates a high-severity event and keeps a timeline.
- **Engineering responder:** diagnoses and mitigates app/API/database/infra faults.
- **Security/privacy lead:** handles suspected compromise, evidence preservation and breach-notification analysis.
- **Finance/payment owner:** handles settlement mismatches, refund/payout ambiguity, reconciliation and PSP escalation.
- **Customer support/safety owner:** responds to reports, account disputes, harassment and service safety issues.
- **Business/legal contact:** makes decisions requiring contract, regulator, insurer or external-counsel input.

During a small founder-led launch, one person may hold more than one role, but backup contacts and decision authority must still be written down.

## 2. Severity model (starting proposal)

- **SEV-1:** suspected unauthorized money movement, broad account/identity compromise, sensitive-data exposure, platform-wide unavailability, or user-safety incident needing urgent escalation.
- **SEV-2:** material degradation, repeated payment/reconciliation failures, key workflow unavailable to a cohort, or growing complaint/safety backlog.
- **SEV-3:** isolated defect with a safe workaround and no apparent sensitive-data or money integrity impact.
- **SEV-4:** minor defect/question with no meaningful production risk.

Severity definitions, response times and coverage must be ratified to match launch size and support coverage. Never promise 24/7 response unless someone is actually on call.

## 3. Suspected security/privacy incident

1. Open an incident record; assign incident commander and security/privacy owner.
2. Preserve relevant logs, access records and system timestamps; do not delete evidence or post PII/secrets in general chat.
3. Contain safely: revoke compromised credentials/tokens, disable affected integration or narrow access, isolate affected workloads if required. Coordinate before destructive actions.
4. Determine affected systems, data categories, users, time window, likely access/exfiltration and whether money/user safety are at risk.
5. Notify business/legal/privacy leadership promptly. The privacy lead/legal adviser determines applicable NPC/data-subject notification obligations and clocks for the facts at hand.
6. Notify vendors/PSP/cloud provider as contractually and legally required.
7. Remediate root cause, rotate compromised secrets through the approved secret manager, rebuild/redeploy clean artifacts and verify controls.
8. Communicate with affected people/regulators only through authorized, accurate channels.
9. Preserve an incident timeline, decisions and evidence; hold a blameless post-incident review with named corrective actions and dates.

## 4. Payment mismatch or suspicious payout

1. Pause the affected payout/transaction path using a controlled feature flag; do not disable users' access to support/refunds without a plan.
2. Record internal booking/payment/ledger IDs and PSP event/settlement references. Do not include full card details or secrets.
3. Compare the authoritative PSP API, verified event history, internal payment record, ledger journal and settlement/payout report.
4. Identify duplicate event, timeout, reversal, currency/fee mismatch, unauthorized change or data-pipeline issue.
5. Do not blindly retry an ambiguous payout/refund. Query PSP status and follow its idempotency/reconciliation procedure.
6. Require finance/security review for manual correction. Use compensating ledger entries with reason and approver; never alter historical journal rows to hide an error.
7. Notify PSP and counsel/accounting support if money has moved incorrectly or tax/reporting records may be affected.
8. Resume only after invariant tests, reconciliation and approvals pass; write a post-incident action list.

## 5. Database availability or suspected corruption

1. Declare incident and stop nonessential write operations if integrity is at risk.
2. Check provider status, connection saturation, storage, locks, migration history and recent deploys; avoid repeated unbounded retries.
3. Roll back the application if the fault correlates with a deploy and rollback is compatible with schema state.
4. Restore or fail over only under the approved recovery procedure; preserve current state for investigation if corruption is suspected.
5. Validate schema and critical invariants, including ledger balances and booking/payment references.
6. Reconcile transactions/webhooks created during the outage before reopening sensitive paths.
7. Record actual recovery-point/time results against the agreed RPO/RTO; update design and budget if missed.

## 6. Failed deploy or bad migration

- Stop further rollout and keep diagnostic artifacts.
- Determine whether the change is code/config only or schema/data-changing.
- Prefer rolling back the app if old code remains compatible; do not automatically run destructive down migrations in production.
- For backward-compatible expand/migrate/contract changes, roll forward using an approved patch if data state demands it.
- Verify `/health/ready`, key business flows, payment webhook lag, ledger invariants, logs and error rate.
- Resume rollout only after owner approval; record the exact image digest and migration revision.

## 7. External provider outage (PSP, IDV, SMS/email, object storage)

- Set provider-specific circuit breaker/timeouts and stop retry storms.
- Do not infer payment success from a callback redirect or client screenshot.
- Use durable outbox/queue with bounded retry/backoff and dead-letter review where applicable.
- Keep users informed with honest pending/failure statuses and safe next steps.
- Reconcile requests created during outage once service recovers before replaying money movement.
- If identity verification is unavailable, hold onboarding requiring it rather than silently bypassing the control.

## 8. Backup restore drill

1. Select an approved encrypted backup in an isolated recovery environment.
2. Verify integrity/authenticity and document selected backup time.
3. Restore database, required objects/configuration and key dependencies in documented order.
4. Run migration and domain invariants; verify sample user, booking and synthetic ledger consistency.
5. Measure achieved RPO and RTO; record gaps.
6. Keep restored data access restricted and delete the drill environment securely after sign-off.
7. Review drill failures and repeat until the business-approved target is met.

## 9. Account takeover and user safety

- Secure the account and terminate sessions using trusted support tooling.
- Verify the requester through an approved process that does not ask for passwords, OTPs or unnecessary ID images by email/chat.
- Review email/phone/payout/security changes and recent transactions, with least-privilege access.
- Freeze high-risk payout/booking operations where justified and proportionate; do not make irreversible decisions without review when avoidable.
- Preserve evidence, provide user communication, route potential money loss to finance/PSP, and route safety allegations to the designated team.
- Record action/reason, approver, expiry/review date and appeal path.

## 10. Runbook maintenance

- Every runbook has an owner, last-reviewed date, escalation contacts and prerequisites.
- Review after a relevant incident, vendor change or major release and at a regular cadence.
- Tabletop and restoration exercises should produce evidence and tracked corrective actions.
