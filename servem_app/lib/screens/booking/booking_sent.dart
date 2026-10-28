import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/payment_icons.dart';
import '../../design/theme.dart';
import '../bookings/booking_detail.dart';

/// Confirmation screen for a booking that the `createBooking` Cloud Function
/// actually wrote. [booking] is required: there is no sample booking to fall
/// back to when nothing was created.
class BookingSentScreen extends StatelessWidget {
  const BookingSentScreen({super.key, required this.booking});

  final Booking booking;

  @override
  Widget build(BuildContext context) {
    final service = booking.service;
    final firstName = service.provider.name.split(' ').first;

    return ScreenScaffold(
      title: 'Booking sent',
      bottom: CtaBar(
        label: 'View booking',
        onPressed: () {
          Session.justBooked = booking.id;
          go(context, BookingDetailScreen(booking: booking));
        },
      ),
      padding: const EdgeInsets.fromLTRB(V.pad, 16, V.pad, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: V.tint,
                borderRadius: BorderRadius.circular(26),
              ),
              child: const Icon(LucideIcons.check, size: 34, color: V.brand),
            ),
          ),
          gap20,
          Text('You’re one step closer.',
              textAlign: TextAlign.center, style: T.h2),
          gap12,
          Text(
            'Your request is with $firstName. We’ll let you know when your '
            'ServMate accepts.',
            textAlign: TextAlign.center,
            style: T.bodyMuted,
          ),
          gap20,
          const Center(
            child: StatusBadge(BookingStatus.awaitingProvider,
                tone: BadgeTone.warning),
          ),
          gap14,
          Center(
            child: Text(
              booking.docId.isEmpty
                  ? 'Booking reference ${booking.id}'
                  : 'Booking reference ${booking.id} · ${booking.docId}',
              style: T.small,
            ),
          ),
          gap14,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Photo(service.asset, width: 62, height: 62),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(service.title,
                              style: T.cardTitle.copyWith(fontSize: 18)),
                          gap4,
                          Text(
                            '${service.provider.name} · Your ServMate',
                            style: T.bodyMuted.copyWith(fontSize: 15),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                gap14,
                Text(booking.when, style: T.body.copyWith(fontSize: 15.5)),
                gap8,
                Text(
                  '${booking.hours} hours · ${service.priceLabel}',
                  style: T.bodyMuted.copyWith(fontSize: 15),
                ),
              ],
            ),
          ),
          gap14,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Service address', style: T.label.copyWith(fontSize: 16)),
                gap10,
                Text(booking.address, style: T.body.copyWith(fontSize: 15.5)),
                gap16,
                KeyValueRow(
                  label: 'Labour subtotal',
                  value: booking.subtotalLabel,
                ),
                KeyValueRow(
                  label: 'Platform service fee',
                  value: booking.feeLabel,
                ),
                KeyValueRow(
                  label: 'Payment',
                  value: booking.paymentLabel,
                ),
                const Divider(height: 24),
                Row(
                  children: [
                    Text('Customer total', style: T.body.copyWith(fontSize: 15.5)),
                    const Spacer(),
                    Text(
                      booking.totalLabel,
                      style: T.label.copyWith(fontSize: 20, color: V.brand),
                    ),
                  ],
                ),
                gap14,
                const PaymentRailRow(),
              ],
            ),
          ),
          gap14,
          Text(
            'Prices were computed by ServEm’s booking service in Philippine '
            'peso. Nothing is charged until the job is completed, and your '
            'exact address stays hidden from $firstName until they accept.',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

/// Status label constants used by the customer-facing screens.
class BookingStatusLabels {
  BookingStatusLabels._();

  static const awaiting = BookingStatus.awaitingProvider;
  static const confirmed = BookingStatus.confirmed;
  static const inProgress = BookingStatus.inProgress;
  static const completed = BookingStatus.completed;
  static const cancelled = BookingStatus.cancelled;
}
