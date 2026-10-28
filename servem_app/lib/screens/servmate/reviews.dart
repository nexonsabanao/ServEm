import 'package:flutter/material.dart';

import '../../app.dart';
import '../../design/theme.dart';

class MateReviewsScreen extends StatefulWidget {
  const MateReviewsScreen({super.key});

  @override
  State<MateReviewsScreen> createState() => _MateReviewsScreenState();
}

class _MateReviewsScreenState extends State<MateReviewsScreen> {
  int _filter = 0;
  final Map<int, String> _customResponses = {};

  @override
  Widget build(BuildContext context) {
    return ShellScreen(
      title: 'Kind words, well earned',
      navIndex: 4,
      items: mateNav,
      child: ValueListenableBuilder<Map<String, List<ReviewRecord>>>(
        valueListenable: AppState.instance.reviews,
        builder: (context, reviewsMap, _) {
          final listToUse =
              reviewsMap[AppState.instance.userProfile.value.name] ??
              const <ReviewRecord>[];

          final filteredReviews = listToUse.where((r) {
            if (_filter == 2) return r.rating >= 5;
            return true;
          }).toList();

          final double avg = listToUse.isNotEmpty
              ? listToUse.map((r) => r.rating).reduce((a, b) => a + b) /
                    listToUse.length
              : 0;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                decoration: BoxDecoration(
                  color: V.tint,
                  borderRadius: BorderRadius.circular(V.cardRadius),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      listToUse.isEmpty ? '—' : avg.toStringAsFixed(1),
                      style: T.h1.copyWith(fontSize: 40, color: V.brandDeep),
                    ),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        StarRow(rating: avg.round(), size: 20),
                        gap6,
                        Text(
                          '${listToUse.length} review${listToUse.length == 1 ? '' : 's'} from customers',
                          style: T.small.copyWith(fontSize: 14.5),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              gap16,
              ChipRow(
                children: [
                  for (var i = 0; i < 3; i++)
                    ServChip(
                      label: const ['All reviews', 'Latest', '5 stars'][i],
                      selected: _filter == i,
                      onTap: () => setState(() => _filter = i),
                    ),
                ],
              ),
              gap16,
              if (filteredReviews.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 30),
                  child: Center(
                    child: Text(
                      'No reviews found for this filter.',
                      style: T.bodyMuted,
                    ),
                  ),
                )
              else
                for (var i = 0; i < filteredReviews.length; i++) ...[
                  if (i > 0) gap14,
                  _ReviewCard(
                    review: filteredReviews[i],
                    response:
                        _customResponses[i] ??
                        (i == 0
                            ? 'Thanks, ${filteredReviews[i].author.split(' ').first}! It was a pleasure helping you get settled.'
                            : null),
                    onReply: (replyText) {
                      setState(() {
                        _customResponses[i] = replyText;
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Response saved!'),
                          backgroundColor: V.brandDeep,
                        ),
                      );
                    },
                  ),
                ],
            ],
          );
        },
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({
    required this.review,
    this.response,
    required this.onReply,
  });

  final ReviewRecord review;
  final String? response;
  final ValueChanged<String> onReply;

  @override
  Widget build(BuildContext context) {
    return ServCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(review.author, style: T.label.copyWith(fontSize: 16)),
              const SizedBox(width: 8),
              StarRow(rating: review.rating, size: 18),
            ],
          ),
          gap8,
          Text('${review.date} · ${review.serviceTitle}', style: T.small),
          gap10,
          Text(
            review.text.startsWith('“') ? review.text : '“${review.text}”',
            style: T.body.copyWith(fontSize: 15.5),
          ),
          if (response != null) ...[
            gap12,
            Text('Your public response', style: T.label.copyWith(fontSize: 15)),
            gap10,
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border.all(color: V.line),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(response!, style: T.body.copyWith(fontSize: 15)),
            ),
          ] else ...[
            gap10,
            GestureDetector(
              onTap: () {
                onReply(
                  'Thank you for the kind review, ${review.author.split(' ').first}!',
                );
              },
              child: Text(
                'Reply to ${review.author.split(' ').first}',
                style: T.link,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
