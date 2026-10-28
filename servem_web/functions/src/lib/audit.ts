/**
 * Append-only audit log. Every privileged or money-adjacent action records an
 * entry here. Clients cannot write to auditLog (rules deny it); only these
 * admin-SDK functions can, and nothing deletes entries except the optional,
 * flag-gated retention sweep.
 */
import { db, serverTs } from './firestore';

export interface AuditInput {
  actorUid: string;
  actorLabel?: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await db.collection('auditLog').add({
      actorUid: input.actorUid,
      actorLabel: input.actorLabel ?? (input.actorUid === 'system' ? 'system' : 'unknown'),
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      detail: input.detail ?? {},
      createdAt: serverTs(),
    });
  } catch (err) {
    // Never fail a user-facing action solely because auditing could not be
    // written, but make a lot of noise in the logs so it is investigated.
    console.error('[audit] FAILED to write audit entry', input.action, input.targetId, err);
  }
}
