import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../account/help.dart';
import '../customer/servmate_profile.dart';
import '../messages/chat.dart';
import '../reviews/review_form.dart';
import 'cancel.dart';
import 'reschedule.dart';

class BookingDetailScreen extends StatelessWidget {
  const BookingDetailScreen({super.key, required this.booking});

  final Booking booking;

  int _stepIndex(String status) {
    final s = status.toLowerCase();
    if (s.contains('awaiting')) return 0;
    if (s.contains('confirm') || s.contains('accept')) return 1;
    if (s.contains('active') || s.contains('route') || s.contains('progress')) return 2;
    if (s.contains('complete')) return 3;
    return 1;
  }

  @override
  Widget build(BuildContext context) {
    final provider = booking.service.provider;
    final isCancelled = booking.status.toLowerCase().contains('cancel');
    final isCompleted = booking.status.toLowerCase().contains('complete');

    return ScreenScaffold(
      title: 'Your booking',
      bottom: isCompleted
          ? CtaBar(
              label: 'Leave a review',
              onPressed: () => go(context, const ReviewFormScreen()),
            )
          : (!isCancelled
              ? CtaBar(
                  label: 'Message ${provider.name.split(' ').first}',
                  onPressed: () => go(
                    context,
                    ChatScreen(
                      name: provider.name,
                      avatar: provider.asset,
                      roleLabel: 'Your ServMate',
                      service: booking.service.title,
                    ),
                  ),
                )
              : null),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              StatusBadge(
                booking.status,
                tone: isCancelled
                    ? BadgeTone.danger
                    : (isCompleted
                        ? BadgeTone.neutral
                        : (booking.status.contains('Awaiting')
                            ? BadgeTone.warning
                            : BadgeTone.brand)),
              ),
              const Spacer(),
              Text(booking.id, style: T.small),
            ],
          ),
          gap16,
          InkWell(
            onTap: () => go(context, ServMateProfileScreen(provider: provider)),
            child: Row(
              children: [
                Avatar(provider.asset, size: 54),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(provider.name, style: T.cardTitle.copyWith(fontSize: 18)),
                      gap4,
                      Text(
                        '★ ${provider.rating} · ${provider.reviews} reviews · ${provider.jobs} jobs',
                        style: T.small,
                      ),
                    ],
                  ),
                ),
                const Icon(LucideIcons.chevronRight, size: 20, color: V.brand),
              ],
            ),
          ),
          gap16,
          Text(
            '${booking.service.title} · ${booking.totalLabel} total',
            style: T.label.copyWith(fontSize: 16.5),
          ),
          gap10,
          Text(booking.when, style: T.body.copyWith(fontSize: 15.5)),
          gap16,
          if (!isCancelled) ...[
            StatusSteps(
              steps: const ['Awaiting provider', 'Accepted / confirmed', 'Active', 'Completed'],
              current: _stepIndex(booking.status),
            ),
            gap16,
          ],
          MapAddressCard(address: booking.address),
          gap16,
          Row(
            children: [
              Text(
                'Keep contact and payments inside ServEm so both sides stay protected.',
                style: T.small,
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => go(context, const HelpScreen()),
                child: Text('Get help', style: T.link),
              ),
            ],
          ),
          if (!isCancelled && !isCompleted) ...[
            gap16,
            Row(
              children: [
                GestureDetector(
                  onTap: () => go(context, RescheduleScreen(booking: booking)),
                  child: Text('Reschedule', style: T.link),
                ),
                Text('  ·  ', style: T.link),
                GestureDetector(
                  onTap: () => go(context, CancelBookingScreen(booking: booking)),
                  child: Text('Cancel booking', style: T.link),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
