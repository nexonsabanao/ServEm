import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import '../booking/book_service.dart';
import 'servmate_profile.dart';

class ServiceDetailScreen extends StatelessWidget {
  const ServiceDetailScreen({super.key, required this.service});

  final Service service;

  static const _extraGallery = [
    'assets/images/service_assembly.jpg',
    'assets/images/service_assembly_b.jpg',
    'assets/images/service_assembly_c.jpg',
    'assets/images/assembly_scene.jpg',
  ];

  /// Short display headline per catalogue category.
  static String _headlineFor(String category) {
    final c = category.toLowerCase();
    if (c.contains('clean')) return 'A fresh space, a lighter day.';
    if (c.contains('repair')) return 'Small fixes, done properly.';
    if (c.contains('errand')) return 'Out the door, sorted.';
    if (c.contains('tech')) return 'Sorted, no jargon.';
    if (c.contains('yard')) return 'A helping hand outdoors.';
    return 'From box to built.';
  }

  @override
  Widget build(BuildContext context) {
    final gallery = [
      if (service.asset.isNotEmpty) service.asset,
      ..._extraGallery,
    ];
    return ScreenScaffold(
      title: 'Service details',
      bottom: CtaBar(
        label: 'Book Now',
        onPressed: () => go(context, BookServiceScreen(service: service)),
      ),
      padding: const EdgeInsets.fromLTRB(V.pad, 4, V.pad, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 130,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: gallery.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, i) => Photo(
                gallery[i],
                width: i == 0 ? 220 : 57,
                height: 130,
              ),
            ),
          ),
          gap14,
          Text(service.title.toUpperCase(), style: T.eyebrow),
          gap6,
          Text(_headlineFor(service.category), style: T.h2),
          gap12,
          Text(service.description, style: T.bodyMuted),
          gap16,
          InkWell(
            onTap: () => go(context, ServMateProfileScreen(provider: service.provider)),
            child: Row(
              children: [
                Avatar(service.provider.asset, size: 54),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(service.provider.name, style: T.cardTitle.copyWith(fontSize: 18)),
                      gap4,
                      Row(
                        children: [
                          const Icon(Icons.star_rounded, size: 16, color: V.ink),
                          const SizedBox(width: 4),
                          Text(
                            '${service.provider.rating} · ${service.provider.reviews} reviews · ${service.provider.jobs} tasks',
                            style: T.small,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const Icon(LucideIcons.badgeCheck, size: 24, color: V.brand),
              ],
            ),
          ),
          gap16,
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
            decoration: BoxDecoration(
              color: V.tint,
              borderRadius: BorderRadius.circular(V.cardRadius),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Next available · Tomorrow',
                  style: T.label.copyWith(fontSize: 15.5, color: V.brandDeep),
                ),
                gap6,
                Text(
                  '${formatManilaDateTime(upcomingManilaDays().first, withTime: false)}'
                  ' · from ${AppState.instance.timeSlots.first}',
                  style: T.body,
                ),
              ],
            ),
          ),
          gap16,
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(service.priceLabel, style: T.price),
              const Spacer(),
              Text('2-hour minimum', style: T.small),
            ],
          ),
          gap6,
          Row(
            children: [
              Text('Approximate distance', style: T.bodyMuted),
              const Spacer(),
              Text(service.distance, style: T.body.copyWith(fontWeight: FontWeight.w600)),
            ],
          ),
          gap16,
          Center(child: Text('Service area', style: T.small)),
          Text(
            '${service.provider.area} & nearby, ${formatCoverageKm(5).toLowerCase()}.',
            style: T.body.copyWith(fontWeight: FontWeight.w600, height: 1.4),
          ),
          gap18,
          Text('Reviews', style: T.section),
          gap12,
          ValueListenableBuilder<Map<String, List<ReviewRecord>>>(
            valueListenable: AppState.instance.reviews,
            builder: (context, allReviews, _) {
              final review = allReviews[service.provider.name]?.firstOrNull;
              if (review == null) {
                return Text(
                  'No written reviews for ${service.provider.name} yet.',
                  style: T.bodyMuted,
                );
              }
              return ServCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(review.author, style: T.label.copyWith(fontSize: 16)),
                        const SizedBox(width: 8),
                        StarRow(rating: review.rating, size: 19),
                      ],
                    ),
                    gap10,
                    Text(
                      review.text,
                      style: T.body.copyWith(fontSize: 15.5),
                    ),
                    gap10,
                    Text(
                      '${review.date} · ${review.serviceTitle}',
                      style: T.small,
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
