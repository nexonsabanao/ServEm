import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../messages/chat.dart';
import '../reviews/review_form.dart';
import 'booking_detail.dart';
import 'completion.dart';

class BookingsTab extends StatefulWidget {
  const BookingsTab({super.key});

  @override
  State<BookingsTab> createState() => _BookingsTabState();
}

class _BookingsTabState extends State<BookingsTab> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ListenableBuilder(
        listenable: Listenable.merge([
          AppState.instance.upcomingBookings,
          AppState.instance.activeBookings,
          AppState.instance.completedBookings,
          AppState.instance.cancelledBookings,
        ]),
        builder: (context, _) {
          final bookings = switch (_tab) {
            0 => AppState.instance.upcomingBookings.value,
            1 => AppState.instance.activeBookings.value,
            2 => AppState.instance.completedBookings.value,
            _ => AppState.instance.cancelledBookings.value,
          };

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(V.pad, 6, V.pad, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Your bookings', style: T.h1),
                gap20,
                Segmented(
                  labels: const ['Upcoming', 'Active', 'Completed', 'Cancelled'],
                  index: _tab,
                  onChanged: (i) => setState(() => _tab = i),
                ),
                gap18,
                if (bookings.isNotEmpty)
                  for (final booking in bookings) ...[
                    _BookingCard(booking: booking),
                    gap16,
                  ]
                else
                  _NoBookings(tabIndex: _tab),
                gap6,
                Text(
                  'Plans changed? Manage your booking or message your ServMate here.',
                  style: T.bodyMuted.copyWith(fontSize: 15),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  const _BookingCard({required this.booking});

  final Booking booking;

  @override
  Widget build(BuildContext context) {
    final isCompleted = booking.status.toLowerCase().contains('complete');
    final isCancelled = booking.status.toLowerCase().contains('cancel');

    return ServCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      onTap: () {
        if (isCompleted) {
          go(context, const JobCompleteScreen());
        } else {
          go(context, BookingDetailScreen(booking: booking));
        }
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusBadge(
                booking.status,
                tone: isCancelled
                    ? BadgeTone.danger
                    : (isCompleted ? BadgeTone.neutral : BadgeTone.brand),
              ),
              const Spacer(),
              Text(booking.totalLabel, style: T.label.copyWith(fontSize: 16.5)),
            ],
          ),
          gap16,
          Row(
            children: [
              Photo(booking.service.asset, width: 76, height: 76),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      booking.service.title,
                      style: T.cardTitle.copyWith(fontSize: 18),
                    ),
                    gap4,
                    Text(
                      booking.service.provider.name,
                      style: T.bodyMuted.copyWith(fontSize: 15),
                    ),
                  ],
                ),
              ),
            ],
          ),
          gap14,
          Text(booking.when, style: T.body.copyWith(fontSize: 15.5)),
          gap10,
          Row(
            children: [
              GestureDetector(
                onTap: () {
                  if (isCompleted) {
                    go(context, const JobCompleteScreen());
                  } else {
                    go(context, BookingDetailScreen(booking: booking));
                  }
                },
                child: Text('View booking', style: T.link),
              ),
              const Spacer(),
              if (isCompleted)
                GestureDetector(
                  onTap: () => go(context, const ReviewFormScreen()),
                  child: Text('Leave a review', style: T.link),
                )
              else if (!isCancelled)
                GestureDetector(
                  onTap: () => go(
                    context,
                    ChatScreen(
                      name: booking.service.provider.name,
                      avatar: booking.service.provider.asset,
                      roleLabel: 'Your ServMate',
                      service: booking.service.title,
                    ),
                  ),
                  child: Text('Message', style: T.link),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NoBookings extends StatelessWidget {
  const _NoBookings({this.tabIndex = 0});

  final int tabIndex;

  @override
  Widget build(BuildContext context) {
    final title = switch (tabIndex) {
      1 => 'No active jobs right now',
      2 => 'No completed jobs yet',
      3 => 'No cancelled bookings',
      _ => 'Your next helping hand awaits',
    };
    final body = switch (tabIndex) {
      1 => 'When a ServMate starts work on your booking, it will appear here.',
      2 => 'Bookings you complete and review will be kept here.',
      3 => 'Any cancelled bookings and refunded payments will show up here.',
      _ => 'You don’t have any upcoming bookings. Find local help for the things on your list.',
    };

    return ServCard(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: V.tint,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(LucideIcons.calendar, size: 26, color: V.brand),
          ),
          gap16,
          Text(title, textAlign: TextAlign.center, style: T.cardTitle.copyWith(fontSize: 18)),
          gap8,
          Text(
            body,
            textAlign: TextAlign.center,
            style: T.bodyMuted.copyWith(fontSize: 15),
          ),
          if (tabIndex == 0) ...[
            gap20,
            SizedBox(
              width: double.infinity,
              child: PrimaryButton(
                label: 'Explore services',
                onPressed: () => Session.openTab(context, 1),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
