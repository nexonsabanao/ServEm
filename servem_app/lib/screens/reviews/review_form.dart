import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import 'review_submitted.dart';

/// Quick tags a customer can attach to a review.
const _reviewTags = <String>[
  'On time',
  'Careful with my things',
  'Friendly',
  'Left it tidy',
  'Great value',
];

class ReviewFormScreen extends StatefulWidget {  const ReviewFormScreen({super.key, this.provider});

  final Provider? provider;

  @override
  State<ReviewFormScreen> createState() => _ReviewFormScreenState();
}

class _ReviewFormScreenState extends State<ReviewFormScreen> {
  int _rating = 5;
  final Set<String> _tags = {'On time'};
  final _review = TextEditingController(
    text:
        'Alex was on time, careful with our furniture, and left everything tidy. Would happily book again!',
  );

  static const _words = [
    'Poor',
    'Fair',
    'Good',
    'Great',
    'Excellent',
  ];

  @override
  void dispose() {
    _review.dispose();
    super.dispose();
  }

  void _submit() {
    final prov = widget.provider;
    if (prov == null) return;
    final text = _review.text.trim();
    final reviewText = text.isNotEmpty
        ? text
        : 'Great service from ${prov.name.split(' ').first}.';

    AppState.instance.addReview(
      providerName: prov.name,
      servmateId: prov.id,
      rating: _rating,
      text: reviewText,
      serviceTitle: prov.tags.isNotEmpty ? prov.tags.first : 'ServEm booking',
    );

    go(
      context,
      ReviewSubmittedScreen(
        provider: prov,
        rating: _rating,
        text: reviewText,
        author: AppState.instance.userProfile.value.name,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = widget.provider;
    if (provider == null) {
      return StateScreen(
        title: 'Write a review',
        stateTitle: 'Open a booking to review',
        body:
            'Reviews are tied to a completed booking. Open that booking and tap “Leave a review”.',
        icon: LucideIcons.star,
        cta: 'Back',
        onCta: () => Navigator.of(context).pop(),
      );
    }
    return ScreenScaffold(
      title: 'How did ${provider.name.split(' ').first} do?',
      bottom: CtaBar(
        label: 'Submit review',
        onPressed: _submit,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Avatar(provider.asset, size: 58),
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
          gap16,
          Text(
            'Your feedback helps your neighbors find good help.',
            style: T.bodyMuted,
          ),
          gap24,
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < 5; i++)
                GestureDetector(
                  onTap: () => setState(() => _rating = i + 1),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    child: Icon(
                      i < _rating ? Icons.star_rounded : Icons.star_outline_rounded,
                      size: 40,
                      color: i < _rating ? V.brand : V.muted,
                    ),
                  ),
                ),
            ],
          ),
          gap14,
          Text(
            '$_rating out of 5 · ${_words[_rating - 1]}',
            textAlign: TextAlign.center,
            style: T.label.copyWith(fontSize: 17),
          ),
          gap24,
          const FieldLabel('Your review'),
          ServTextField(
            controller: _review,
            maxLines: 4,
            onChanged: (_) => setState(() {}),
          ),
          gap8,
          Text('${_review.text.length} / 500 characters', style: T.small),
          gap16,
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final tag in _reviewTags)
                ServChip(
                  label: tag,
                  height: 44,
                  selected: _tags.contains(tag),
                  onTap: () => setState(() {
                    if (!_tags.remove(tag)) _tags.add(tag);
                  }),
                ),
            ],
          ),
          gap18,
          InfoBanner(
            title: 'Share your experience',
            body:
                'Your name and review will appear on ${provider.name.split(' ').first}’s public profile. Please don’t include private details.',
          ),
          gap14,
          Text('Furniture assembly · Completed Oct 25, 2026', style: T.small),
        ],
      ),
    );
  }
}
