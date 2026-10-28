import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/errors.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import '../../firebase/firestore_sync.dart';

/// Admin surface for ServEm.
///
/// It renders **only** when the signed-in user's ID token carries
/// `claims['admin'] == true`; the root gate checks the same claim, and this
/// screen re-checks it so a stale route can never expose the queue.
/// Every decision is sent through the `adminDecision` Cloud Function in
/// `asia-southeast1` — the app never writes a status field itself.
class AdminConsoleScreen extends StatefulWidget {
  const AdminConsoleScreen({super.key});

  @override
  State<AdminConsoleScreen> createState() => _AdminConsoleScreenState();
}

class _AdminConsoleScreenState extends State<AdminConsoleScreen> {
  int _tab = 0;
  String? _busyId;

  Future<void> _decide(
    String targetType,
    String targetId,
    String decision,
    String note,
  ) async {
    setState(() => _busyId = '$targetType:$targetId');
    await performAction<void>(
      context,
      () => FirestoreSync.adminDecision(
        kind: targetType,
        id: targetId,
        decision: decision,
        reason: note,
      ),
      successMessage: '${_titleCase(decision)} for $targetId.',
    );
    if (mounted) setState(() => _busyId = null);
  }

  static String _titleCase(String value) =>
      value.isEmpty ? value : '${value[0].toUpperCase()}${value.substring(1)}';

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: Session.isAdmin,
      builder: (context, isAdmin, _) {
        if (!isAdmin) return const _AdminClaimRequired();
        return ScreenScaffold(
          title: 'Admin console',
          showBack: false,
          scrollable: false,
          actions: [
            IconButton(
              tooltip: 'Sign out',
              onPressed: () => Session.signOut(context),
              icon: const Icon(LucideIcons.logOut, size: 21),
            ),
          ],
          padding: const EdgeInsets.fromLTRB(V.pad, 8, V.pad, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const InfoBanner(
                icon: LucideIcons.shieldCheck,
                title: 'Admin claim verified',
                body: 'Decisions below are written by the adminDecision Cloud '
                    'Function and recorded in the audit collection.',
              ),
              gap16,
              Text(
                'Locale $appLocale · time zone $appTimeZone · amounts in '
                'Philippine peso',
                style: T.small,
              ),
              gap16,
              Segmented(
                labels: const ['Verifications', 'Cases'],
                index: _tab,
                onChanged: (index) => setState(() => _tab = index),
              ),
              gap18,
              Expanded(
                child: _tab == 0 ? _verificationQueue() : _caseQueue(),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _verificationQueue() {
    return StreamBuilder<List<VerificationRequest>>(
      stream: FirestoreSync.verificationRequestsStream(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return _QueueFailure(
            message: describeFailure(snapshot.error!).message,
            onRetry: () => setState(() {}),
          );
        }
        if (!snapshot.hasData) return const _QueueLoading();
        final requests = snapshot.data!;
        if (requests.isEmpty) {
          return const SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: StateBlock(
                icon: LucideIcons.badgeCheck,
                title: 'No pending verifications',
                body: 'ServMate identity checks appear here as soon as a '
                    'provider submits their PhilSys or government ID.',
              ),
            ),
          );
        }
        return ListView.separated(
          itemCount: requests.length,
          separatorBuilder: (_, _) => gap14,
          itemBuilder: (context, index) {
            final request = requests[index];
            final busy = _busyId == 'verification:${request.id}';
            return ServCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          request.servmateName,
                          style: T.cardTitle.copyWith(fontSize: 17),
                        ),
                      ),
                      StatusBadge(
                        request.status,
                        tone: request.status == 'pending'
                            ? BadgeTone.warning
                            : BadgeTone.brand,
                      ),
                    ],
                  ),
                  gap8,
                  Text('${request.idType} · submitted ${request.submittedAt}',
                      style: T.bodyMuted),
                  gap14,
                  Row(
                    children: [
                      Expanded(
                        child: PrimaryButton(
                          label: busy ? 'Working…' : 'Approve',
                          height: 44,
                          onPressed: busy
                              ? null
                              : () => _decide(
                                  'verification',
                                  request.id,
                                  'approve',
                                  'Identity document verified by admin',
                                ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlineButton(
                          label: 'Reject',
                          height: 44,
                          onPressed: busy
                              ? null
                              : () => _decide(
                                  'verification',
                                  request.id,
                                  'reject',
                                  'Identity document rejected by admin',
                                ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _caseQueue() {
    return StreamBuilder<List<CaseRecord>>(
      stream: FirestoreSync.adminCasesStream(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return _QueueFailure(
            message: describeFailure(snapshot.error!).message,
            onRetry: () => setState(() {}),
          );
        }
        if (!snapshot.hasData) return const _QueueLoading();
        final cases = snapshot.data!;
        if (cases.isEmpty) {
          return const SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: StateBlock(
                icon: LucideIcons.inbox,
                title: 'Nothing to review',
                body: 'Customer disputes and support tickets open in Metro '
                    'Manila, Cebu and Davao land here.',
              ),
            ),
          );
        }
        return ListView.separated(
          itemCount: cases.length,
          separatorBuilder: (_, _) => gap14,
          itemBuilder: (context, index) {
            final record = cases[index];
            final busy = _busyId == '${record.kind}:${record.id}';
            return ServCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        record.kind == 'dispute'
                            ? LucideIcons.triangleAlert
                            : LucideIcons.lifeBuoy,
                        size: 18,
                        color: record.kind == 'dispute'
                            ? V.dangerFg
                            : V.muted,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(record.subject, style: T.cardTitle),
                      ),
                      StatusBadge(_titleCase(record.status)),
                    ],
                  ),
                  gap8,
                  KeyValueRow(
                    label: 'Type',
                    value: _caseLabel(record.kind),
                  ),
                  KeyValueRow(label: 'Reference', value: record.id),
                  if (record.parties.isNotEmpty)
                    KeyValueRow(label: 'Parties', value: record.parties),
                  KeyValueRow(
                    label: 'Amount in dispute',
                    value: record.amountLabel,
                  ),
                  KeyValueRow(label: 'Opened', value: record.updatedAt),
                  gap14,
                  Row(
                    children: [
                      Expanded(
                        child: PrimaryButton(
                          label: busy ? 'Working…' : 'Resolve',
                          height: 44,
                          onPressed: busy
                              ? null
                              : () => _decide(
                                  record.kind,
                                  record.id,
                                  'resolve',
                                  'Case resolved by admin',
                                ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlineButton(
                          label: 'Close without refund',
                          height: 44,
                          onPressed: busy
                              ? null
                              : () => _decide(
                                  record.kind,
                                  record.id,
                                  'dismiss',
                                  'Case dismissed by admin',
                                ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  static String _caseLabel(String kind) => switch (kind) {
        'dispute' => 'Booking dispute',
        _ => 'Support ticket',
      };
}

class _QueueLoading extends StatelessWidget {
  const _QueueLoading();

  @override
  Widget build(BuildContext context) {
    return const SkeletonList(
      rows: 4,
      padding: EdgeInsets.symmetric(vertical: 24),
    );
  }
}

class _QueueFailure extends StatelessWidget {
  const _QueueFailure({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: StateBlock(
          icon: LucideIcons.cloudOff,
          title: 'The queue could not load',
          body: message,
          iconTone: BadgeTone.danger,
          children: [
            gap20,
            OutlineButton(label: 'Retry', onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}

/// Rendered when the token no longer carries the admin claim.
class _AdminClaimRequired extends StatelessWidget {
  const _AdminClaimRequired();

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Admin access required',
      showBack: false,
      bottom: CtaBar(
        label: 'Sign out',
        onPressed: () => Session.signOut(context),
      ),
      child: const StateBlock(
        icon: LucideIcons.lock,
        title: 'This account is not an admin',
        body: 'ServEm reads the admin claim from your Firebase ID token. '
            'Ask a project owner to grant the "admin" claim for servem-ph, '
            'then sign in again.',
        iconTone: BadgeTone.danger,
      ),
    );
  }
}
