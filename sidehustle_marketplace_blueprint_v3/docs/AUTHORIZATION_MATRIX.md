# Authorization Matrix and Sensitive Data Boundaries

This is the baseline policy map. The backend is the enforcement point. The UI may hide controls but that is not authorization. A qualified reviewer must approve the actual matrix when roles/flows are finalized.

Legend: **Own** = only the authenticated account's own record; **Participants** = users who are current parties to the record; **Scoped** = only the minimum fields/actions required for assigned cases; **Approval** = explicit second-person approval/step-up for high-risk action; `—` = denied by default.

| Resource/action | Customer | Provider | Support | Moderator | Finance | Compliance/Privacy | Security | Super-admin |
|---|---|---|---|---|---|---|---|---|
| Own profile/settings | Own | Own | Own | Own | Own | Own | Own | Own |
| Public provider profile/listing | Read public | Own; edit own draft | Scoped read | Scoped review; hide/restore under policy | — | Scoped review for compliance fields | Scoped incident review | Break-glass only, audited |
| Private provider verification/tax data | — | Own status / submit data | — by default | — | Tax fields only if needed | Scoped | Scoped investigation with reason | Break-glass + audited |
| Booking details | Participants | Participants | Scoped for support case | Scoped for safety/moderation | Minimum financial fields | Scoped for complaint/compliance | Scoped incident access | Break-glass + audited |
| Private messages | Own conversations | Own conversations | Scoped to reported case; access logged | Only reported/safety content under policy | — | Only when necessary for legal/privacy case | Scoped incident access | Break-glass + audited |
| Create booking | Own as customer | — unless product later supports provider-side request | — | — | — | — | — | — |
| Accept/reject provider request | — | Own assigned/requested booking | No; support cannot impersonate participant | — | — | — | — | — |
| Change booking status | Own allowed customer transitions | Own allowed provider transitions | Escalation/cancel action only if explicit policy permits; never silently impersonate | — | — | — | Emergency freeze only if approved | Break-glass + audited |
| View own earnings/payout status | — | Own summary | — | — | Scoped | — | Scoped investigation | Break-glass |
| Initiate payout | — | Request own eligible payout | — | — | Authorized finance workflow | — | May freeze if incident policy authorizes, not initiate payout | Approval/break-glass only |
| Approve exceptional payout/refund | — | — | Below-limit refund only if separately delegated | — | Approval; dual control above configured limit | — | — | Second approver where configured; audit |
| View/modify ledger | — | Own derived statement only | — | — | Read + approved posting workflow; no history rewriting | Scoped audit view | Incident view | No direct edit; break-glass view only |
| Moderate listing/review | — | Appeal own listing | Report intake only | Scoped action, reason and history | — | Compliance hold/release only where policy permits | Evidence preservation | Break-glass |
| Restrict/suspend account | Own appeal only | Own appeal only | Escalate request | Policy-scoped for abuse/safety | — | Policy-scoped compliance hold | Incident-scoped emergency restriction | Final/exceptional action with reason and audit |
| Read security/audit logs | — | Own account security events only | No broad logs | Scoped moderation events | Finance events only | Compliance/privacy events | Security logs | Break-glass, audited |
| Export user data | Own approved export | Own approved export | — | — | Specific authorized financial records | Process approved access request | Incident only | Break-glass + audited |
| Change roles/policies | — | — | — | — | — | — | Security policy via reviewed process | Strong MFA, just-in-time, approval and audit |

## Mandatory enforcement rules

1. **Deny by default.** Unknown roles/fields/actions are denied.
2. Every request checks identity, role, resource ownership/participation, current account status, resource state and purpose/context.
3. Use separate read models/DTOs for public profile, participant view, support view, finance view and private evidence. Do not serialize an ORM entity wholesale.
4. Log sensitive administrative access and mutation with actor, target, reason, timestamp, request ID, outcome and approved scope. Never duplicate raw ID images/secrets into audit logs.
5. High-risk actions include role changes, identity verification override, sensitive export, payout destination change, large refund/payout, bulk suspension and changing security configuration. Require step-up/dual control according to approved thresholds.
6. Support cannot ask users for passwords or OTPs, and cannot impersonate a customer/provider to complete transactions.
7. Account restrictions need an action reason, review/expiry policy when appropriate, and user appeal/escalation where safe/legal.
8. Test role confusion, object-ID substitution, nested resources, list/search leakage, export endpoints and direct-object file URLs.
