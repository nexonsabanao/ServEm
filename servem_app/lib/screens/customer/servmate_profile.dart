import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import 'service_detail.dart';

class ServMateProfileScreen extends StatelessWidget {
  const ServMateProfileScreen({super.key, required this.provider});

  final Provider provider;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<Service>>(
      valueListenable: AppState.instance.services,
      builder: (context, allServices, _) {
        final providerServices = allServices
            .where((s) => s.provider.name == provider.name)
            .toList();
        final firstService = providerServices.firstOrNull;

        return ScreenScaffold(
          title: 'Meet your ServMate',
          bottom: CtaBar(
            label: 'View available service',
            onPressed: firstService == null
                ? null
                : () => go(context, ServiceDetailScreen(service: firstService)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Avatar(provider.asset, size: 84),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(provider.name, style: T.h3.copyWith(fontSize: 23)),
                        gap6,
                        Text(
                          '${provider.area} · ${provider.distance}',
                          style: T.bodyMuted.copyWith(fontSize: 15),
                        ),
                        gap8,
                        const StatusBadge('Verified ServMate'),
                      ],
                    ),
                  ),
                ],
              ),
              gap20,
              Row(
                children: [
                  _StatTile(value: provider.rating, label: 'Average rating'),
                  const SizedBox(width: 10),
                  _StatTile(value: '${provider.jobs}', label: 'Completed jobs'),
                  const SizedBox(width: 10),
                  _StatTile(value: '${provider.reviews}', label: 'Reviews'),
                ],
              ),
              gap18,
              Text(provider.bio, style: T.bodyMuted),
              gap16,
              ChipRow(
                children: [
                  for (final tag in provider.tags) ServChip(label: tag, height: 44),
                ],
              ),
              gap18,
              Text(
                'Service area · ${provider.area}, ${formatCoverageKm(5)}.',
                style: T.body.copyWith(fontSize: 15, height: 1.5),
              ),
              gap18,
              ValueListenableBuilder<Map<String, List<ReviewRecord>>>(
                valueListenable: AppState.instance.reviews,
                builder: (context, allReviews, _) {
                  final providerRevList = allReviews[provider.name] ?? const [];

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (providerRevList.isEmpty) ...[
                        Text(
                          'No written reviews yet for ${provider.name}.',
                          style: T.bodyMuted.copyWith(fontSize: 15),
                        ),
                        gap14,
                      ],
                      for (final rev in providerRevList.take(2)) ...[
                        ServCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(rev.author,
                                      style: T.label.copyWith(fontSize: 16)),
                                  const SizedBox(width: 8),
                                  StarRow(rating: rev.rating, size: 19),
                                ],
                              ),
                              gap10,
                              Text(
                                rev.text,
                                style: T.body.copyWith(fontSize: 15.5),
                              ),
                              gap10,
                              Text('${rev.date} · ${rev.serviceTitle}',
                                  style: T.small),
                            ],
                          ),
                        ),
                        gap14,
                      ],
                    ],
                  );
                },
              ),
              gap12,
              Text('Available services', style: T.section),
              gap10,
              for (final s in providerServices) ...[
                InkWell(
                  onTap: () => go(context, ServiceDetailScreen(service: s)),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            s.title,
                            style: T.label.copyWith(fontSize: 16),
                          ),
                        ),
                        Text(s.priceLabel,
                            style: T.link.copyWith(fontSize: 15.5)),
                        const SizedBox(width: 6),
                        const Icon(LucideIcons.arrowRight, size: 18, color: V.brand),
                      ],
                    ),
                  ),
                ),
                const Divider(height: 1),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
        decoration: BoxDecoration(
          color: V.tint,
          borderRadius: BorderRadius.circular(V.cardRadius),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                style: T.h3.copyWith(color: V.brandDeep, fontSize: 26),
              ),
            ),
            gap6,
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                style: T.micro.copyWith(fontSize: 12.5),
                maxLines: 1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
