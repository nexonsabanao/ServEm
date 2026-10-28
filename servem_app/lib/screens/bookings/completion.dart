import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../reviews/review_form.dart';

class JobCompleteScreen extends StatelessWidget {
  const JobCompleteScreen({super.key, this.provider});

  final Provider? provider;

  @override
  Widget build(BuildContext context) {
    final provider = this.provider;
    if (provider == null) {
      return StateScreen(
        title: 'Job complete',
        stateTitle: 'Open the booking for its summary',
        body: 'This screen belongs to a specific booking. Open it from your bookings list to see the details and leave a review.',
        icon: LucideIcons.calendarCheck,
        cta: 'Back to bookings',
        onCta: () => Session.openTab(context, 2),
      );
    }
    return ScreenScaffold(
      title: 'All taken care of',
      bottom: CtaBar(
        label: 'Leave a review',
        onPressed: () => go(context, ReviewFormScreen(provider: provider)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          gap10,
          Center(
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: V.tint,
                borderRadius: BorderRadius.circular(26),
              ),
              child: const Icon(
                LucideIcons.checkCircle2,
                size: 34,
                color: V.brand,
              ),
            ),
          ),
          gap20,
          Text('A job well done.', textAlign: TextAlign.center, style: T.h2),
          gap12,
          Text(
            'Alex marked your furniture assembly complete. How did it go?',
            textAlign: TextAlign.center,
            style: T.bodyMuted,
          ),
          gap20,
          const Align(
            alignment: Alignment.centerLeft,
            child: StatusBadge('Completed'),
          ),
          gap12,
          Row(
            children: [
              Avatar(provider.asset, size: 54),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      provider.name,
                      style: T.cardTitle.copyWith(fontSize: 18),
                    ),
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
          gap12,
          gap16,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Work summary', style: T.label.copyWith(fontSize: 16)),
                gap10,
                Text(
                  'Desk and bookshelf assembled. Packaging tidied and both items checked.',
                  style: T.bodyMuted.copyWith(fontSize: 15.5),
                ),
                gap8,
                const Divider(height: 26),

                const Divider(height: 1),

                const Divider(height: 1),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
