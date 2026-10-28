import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import 'reschedule.dart';

class CancelBookingScreen extends StatefulWidget {
  const CancelBookingScreen({super.key, required this.booking});

  final Booking booking;

  @override
  State<CancelBookingScreen> createState() => _CancelBookingScreenState();
}

class _CancelBookingScreenState extends State<CancelBookingScreen> {
  int _reason = 0;

  static const _reasons = [
    'My plans changed',
    'I no longer need this service',
    'I booked the wrong time',
    'Something else',
  ];

  Future<void> _confirm() async {
    await showServEmSheet<void>(
      context,
      Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Cancel this booking?', style: T.h3),
          gap14,
          Text(
            '${widget.booking.service.title} with ${widget.booking.service.provider.name} on ${widget.booking.when} will be cancelled.',
            style: T.bodyMuted,
          ),
          gap16,
          const InfoBanner(
            title: 'No cancellation fee',
            body: 'Nothing has been charged for this booking.',
          ),
          gap20,
          PrimaryButton(
            label: 'Yes, cancel booking',
            onPressed: () {
              AppState.instance.cancelBooking(
                widget.booking.id,
                _reasons[_reason],
              );
              Navigator.of(context).pop();
              Session.openTab(context, 2);
            },
          ),
          gap12,
          SecondaryButton(
            label: 'Keep booking',
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Cancel booking',
      bottom: CtaBar(label: 'Continue to cancellation', onPressed: _confirm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BookingSummaryCard(booking: widget.booking),
          gap20,
          Text('Why are you cancelling?', style: T.section),
          gap14,
          for (var i = 0; i < _reasons.length; i++) ...[
            _ReasonTile(
              label: _reasons[i],
              selected: _reason == i,
              onTap: () => setState(() => _reason = i),
            ),
            gap12,
          ],
          gap8,
          const InfoBanner(
            title: 'Cancellation policy',
            body: 'Cancel at least 12 hours before the start for no fee.',
          ),
        ],
      ),
    );
  }
}

class _ReasonTile extends StatelessWidget {
  const _ReasonTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(V.cardRadius),
      side: BorderSide(color: selected ? V.brand : V.line),
    );
    return Material(
      color: selected ? V.tint : V.surface,
      shape: shape,
      child: InkWell(
        borderRadius: BorderRadius.circular(V.cardRadius),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
          child: Row(
            children: [
              Icon(
                selected ? LucideIcons.checkCircle2 : LucideIcons.circle,
                size: 24,
                color: V.brand,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  label,
                  style: T.body.copyWith(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
