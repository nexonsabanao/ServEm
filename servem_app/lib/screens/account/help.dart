import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../auth/auth_common.dart';

class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  final _search = TextEditingController();

  static const _faqs = [
    (
      'How do payments work?',
      'Pay with GCash, Maya, bank transfer or cash on completion. Nothing is charged until the job is done.'
    ),
    (
      'Can I change my booking?',
      'Yes. Open your booking in the Bookings tab and tap "Reschedule" to request another available date or time slot.'
    ),
    (
      'When is my address shared?',
      'Your exact street address stays private until your ServMate accepts the booking request.'
    ),
    (
      'How do I become a ServMate?',
      'Go to your profile and tap "Switch to ServMate" or tap the promo banner on the Home screen to begin offering your skills.'
    ),
  ];

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _search.text.trim().toLowerCase();
    final matchingFaqs = _faqs.where((f) {
      if (query.isEmpty) return true;
      return f.$1.toLowerCase().contains(query) || f.$2.toLowerCase().contains(query);
    }).toList();

    return ScreenScaffold(
      title: 'A little help with ServEm',
      bottom: CtaBar(
        label: 'Contact support',
        onPressed: () => showServEmSheet<void>(
          context,
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('We’re here to help', style: T.h3),
              gap12,
              Text(
                'Send us a note at support@servem.example and we’ll reply within 1–2 days.',
                style: T.bodyMuted,
              ),
              gap20,
              SecondaryButton(
                label: 'Close',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SearchBox(
            hint: 'Search help articles',
            controller: _search,
            onChanged: (_) => setState(() {}),
          ),
          gap18,
          Text('Frequently asked questions', style: T.section),
          gap12,
          ServCard(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (matchingFaqs.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: Text('No articles found.', style: T.bodyMuted),
                    ),
                  )
                else
                  for (var i = 0; i < matchingFaqs.length; i++) ...[
                    if (i > 0) const Divider(height: 1),
                    _ExpandableFaqRow(
                      question: matchingFaqs[i].$1,
                      answer: matchingFaqs[i].$2,
                      initiallyExpanded: i == 0 && query.isEmpty,
                    ),
                  ],
              ],
            ),
          ),
          gap20,
          Text('Still need a hand?', style: T.section),
          gap6,
          NavRow(
            icon: LucideIcons.flag,
            title: 'Report a problem',
            subtitle: 'Tell us about an issue with a booking',
            onTap: () => openLegalUrl(
              context,
              'mailto:support@servem.ph?subject=Report%20a%20problem',
            ),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          const Divider(height: 1),
          NavRow(
            icon: LucideIcons.mail,
            title: 'Email our support team',
            subtitle: 'support@servem.ph · Reply in 1–2 days',
            onTap: () => openLegalUrl(
              context,
              'mailto:support@servem.ph',
            ),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          gap14,
          Text(
            'For urgent safety issues, contact local emergency services. ServEm support isn’t an emergency service.',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

class _ExpandableFaqRow extends StatefulWidget {
  const _ExpandableFaqRow({
    required this.question,
    required this.answer,
    this.initiallyExpanded = false,
  });

  final String question;
  final String answer;
  final bool initiallyExpanded;

  @override
  State<_ExpandableFaqRow> createState() => _ExpandableFaqRowState();
}

class _ExpandableFaqRowState extends State<_ExpandableFaqRow> {
  late bool _expanded = widget.initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => setState(() => _expanded = !_expanded),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.question,
                    style: T.label.copyWith(fontSize: 16),
                  ),
                ),
                Icon(
                  _expanded ? LucideIcons.chevronDown : LucideIcons.chevronRight,
                  size: 20,
                  color: V.muted,
                ),
              ],
            ),
            if (_expanded) ...[
              gap10,
              Text(
                widget.answer,
                style: T.bodyMuted.copyWith(fontSize: 14.5, height: 1.5),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
