import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import 'review_form.dart';

class ReviewSubmittedScreen extends StatelessWidget {
  const ReviewSubmittedScreen({
    super.key,
    this.provider,
    this.rating = 5,
    this.text = '',
    this.author = '',
  });

  final Provider? provider;
  final int rating;
  final String text;
  final String author;

  @override
  Widget build(BuildContext context) {
    final effectiveProvider = provider;
    if (effectiveProvider == null) {
      return StateScreen(
        title: 'Review submitted',
        stateTitle: 'Review saved to your account',
        body: 'Open a completed booking to see its review, or write another one from there.',
        icon: LucideIcons.star,
        cta: 'Back to bookings',
        onCta: () => Session.openTab(context, 2),
      );
    }
    final reviewer = author.trim().isEmpty
        ? AppState.instance.userProfile.value.name
        : author;

    return ScreenScaffold(
      title: 'Review submitted',
      bottom: CtaBar(
        label: 'Back to bookings',
        onPressed: () => Session.openTab(context, 2),
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
              child: const Center(
                child: _BubbleHeart(),
              ),
            ),
          ),
          gap20,
          Text(
            'Thanks for sharing${reviewer.isEmpty ? '' : ', $reviewer'}.',
            textAlign: TextAlign.center,
            style: T.h2,
          ),
          gap12,
          Text(
            'Your review helps good local work get noticed.',
            textAlign: TextAlign.center,
            style: T.bodyMuted,
          ),
          gap20,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Avatar(effectiveProvider.asset, size: 54),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(effectiveProvider.name,
                              style: T.cardTitle.copyWith(fontSize: 18)),
                          gap4,
                          Text(
                            '★ ${effectiveProvider.rating} · ${effectiveProvider.reviews} reviews · ${effectiveProvider.jobs} jobs',
                            style: T.small,
                          ),
                        ],
                      ),
                    ),
                    const Icon(LucideIcons.chevronRight, size: 20, color: V.brand),
                  ],
                ),
                gap12,
                StarRow(rating: rating, size: 26),
                gap12,
                Text(
                  text.startsWith('“') ? text : '“$text”',
                  style: T.body.copyWith(fontSize: 15.5),
                ),
                gap10,
                Text('$author · Oct 25, 2026', style: T.small),
                gap12,
                const StatusBadge('Review published'),
              ],
            ),
          ),
          gap14,
          GestureDetector(
            onTap: () => go(
              context,
              ReviewFormScreen(provider: effectiveProvider),
            ),
            behavior: HitTestBehavior.opaque,
            child: Text('Edit your review', style: T.link),
          ),
        ],
      ),
    );
  }
}

class _BubbleHeart extends StatelessWidget {
  const _BubbleHeart();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 38,
      height: 38,
      child: Stack(
        alignment: Alignment.center,
        children: [
          const Icon(LucideIcons.messageCircle, size: 34, color: V.brand),
          Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Icon(Icons.favorite, size: 13, color: V.brand.withValues(alpha: 0.95)),
          ),
        ],
      ),
    );
  }
}
