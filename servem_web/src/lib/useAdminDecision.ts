import { useCallback, useState } from 'react';
import {
  adminDecision,
  callableErrorMessage,
  type AdminDecisionInput,
  type AdminDecisionKind,
  type AdminDecisionValue,
  type AdminDecisionValueFor,
} from './functions';

/** `adminDecisionSchema.reason` is `sanitizedText(5, 500)`. */
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

export interface AdminDecisionState {
  reason: string;
  setReason: (value: string) => void;
  pending: boolean;
  message: string | null;
  error: string | null;
  clear: () => void;
  /**
   * Sends the decision to the `adminDecision` callable and reports the real
   * outcome. `kind` and `decision` are tied together by `AdminDecisionValueFor`,
   * so a pairing the server would reject cannot be written.
   */
  submit: <K extends AdminDecisionKind>(
    kind: K,
    id: string,
    decision: AdminDecisionValueFor<K>,
  ) => Promise<boolean>;
}

/**
 * Runs an admin decision through the `adminDecision` callable and reports the
 * real outcome. Nothing is shown as done unless the server said so, and a
 * reason is required (5-500 characters) so the audit trail always has one.
 */
export function useAdminDecision(): AdminDecisionState {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async <K extends AdminDecisionKind>(kind: K, id: string, decision: AdminDecisionValueFor<K>) => {
      const trimmed = reason.trim().slice(0, MAX_REASON_LENGTH);
      if (trimmed.length < MIN_REASON_LENGTH) {
        setMessage(null);
        setError('Kailangan ng reason. Write a short reason (at least 5 characters) before recording this decision.');
        return false;
      }
      setPending(true);
      setMessage(null);
      setError(null);
      try {
        // `kind` and `decision` are already tied together by `AdminDecisionValueFor`
        // at every call site; TypeScript cannot re-narrow a mapped union through an
        // unresolved generic, so the pairing is stated once here instead of at each
        // button. The server re-checks it in `adminDecisionSchema`'s superRefine.
        const input = { kind, id, decision, reason: trimmed } as AdminDecisionInput;
        await adminDecision(input);
        setMessage('Naitala ang desisyon. The record was updated and the decision logged.');
        return true;
      } catch (reason_) {
        setError(callableErrorMessage(reason_));
        return false;
      } finally {
        setPending(false);
      }
    },
    [reason],
  );

  const clear = useCallback(() => {
    setMessage(null);
    setError(null);
  }, []);

  return { reason, setReason, pending, message, error, clear, submit };
}

/** The button copy for each decision value the `adminDecision` callable accepts. */
export const decisionLabel: Record<AdminDecisionValue, string> = {
  approved: 'Approve',
  rejected: 'Reject',
  live: 'Publish listing',
  paused: 'Pause listing',
  refunded: 'Approve refund',
  resolved: 'Mark resolved',
  published: 'Publish review',
  flagged: 'Flag review',
  removed: 'Remove review',
  active: 'Reinstate account',
  suspended: 'Suspend account',
};
