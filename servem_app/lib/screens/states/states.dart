import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../design/components.dart';

/// The designed empty, offline, error and permission states in one place, so
/// every list screen says the same thing when it has nothing to show — and
/// never a blank page or an invented row.
///
/// Loading is handled by `SkeletonList` in the same design language.

/// A filter or search that matched nothing. `onClear` puts the screen back to
/// its unfiltered list, which is the only useful next step.
class EmptyResults extends StatelessWidget {
  const EmptyResults({
    super.key,
    this.title = 'No matches just yet',
    this.body =
        'Nothing here fits that filter. Try a wider area or a different service.',
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String body;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: StateBlock(
        icon: LucideIcons.searchX,
        title: title,
        body: body,
        iconTone: BadgeTone.neutral,
        children: [
          if (actionLabel != null && onAction != null) ...[
            gap18,
            SecondaryButton(label: actionLabel!, onPressed: onAction),
          ],
        ],
      ),
    );
  }
}

/// No connection. Reads and writes queue up and resume, so the copy says what
/// the person can do rather than blaming the network.
class OfflineNotice extends StatelessWidget {
  const OfflineNotice({super.key, this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: StateBlock(
        icon: LucideIcons.wifiOff,
        title: 'You are offline',
        body:
            'ServEm needs a connection to load your jobs and messages. Reconnect and try again — nothing was lost.',
        iconTone: BadgeTone.warning,
        children: [
          if (onRetry != null) ...[
            gap18,
            SecondaryButton(label: 'Try again', onPressed: onRetry),
          ],
        ],
      ),
    );
  }
}

/// A read that failed for a reason other than permissions, with a retry.
class LoadFailed extends StatelessWidget {
  const LoadFailed({
    super.key,
    required this.onRetry,
    this.title = 'That did not load',
    this.body =
        'Something went wrong on the way to ServEm. Your data is safe — try again in a moment.',
  });

  final VoidCallback onRetry;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: StateBlock(
        icon: LucideIcons.triangleAlert,
        title: title,
        body: body,
        iconTone: BadgeTone.danger,
        children: [
          gap18,
          SecondaryButton(label: 'Try again', onPressed: onRetry),
        ],
      ),
    );
  }
}

/// A permission the flow needs but does not have, such as the location used to
/// sort services by distance.
class PermissionNotice extends StatelessWidget {
  const PermissionNotice({super.key, required this.permission, this.onOpen});

  final String permission;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: StateBlock(
        icon: LucideIcons.mapPinOff,
        title: '$permission is off',
        body:
            'ServEm only uses it to sort help near you. You can keep browsing without it.',
        iconTone: BadgeTone.warning,
        children: [
          if (onOpen != null) ...[
            gap18,
            SecondaryButton(label: 'Open settings', onPressed: onOpen),
          ],
        ],
      ),
    );
  }
}

/// A short confirmation line for an action that completed.
class DoneNotice extends StatelessWidget {
  const DoneNotice({super.key, required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: StateBlock(
        icon: LucideIcons.circleCheck,
        title: title,
        body: body,
      ),
    );
  }
}