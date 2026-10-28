import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import 'service_detail.dart';

/// The recurring "thumbnail + title + provider + price + rating" service row.
class ServiceTile extends StatelessWidget {
  const ServiceTile({
    super.key,
    required this.service,
    this.card = false,
    this.onTap,
    this.trailing,
    this.showFavorite = false,
  });

  final Service service;
  final bool card;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool showFavorite;

  @override
  Widget build(BuildContext context) {
    final thumb = card ? 76.0 : 86.0;
    return ValueListenableBuilder<Set<String>>(
      valueListenable: AppState.instance.savedServices,
      builder: (context, saved, _) {
        final isSaved = saved.contains(service.title);
        final effectiveTrailing = trailing ??
            (showFavorite
                ? InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: () => AppState.instance.toggleSavedService(service.title),
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: Icon(
                        isSaved ? Icons.favorite : Icons.favorite_border,
                        size: 22,
                        color: isSaved ? V.brand : V.muted,
                      ),
                    ),
                  )
                : null);

        final row = Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Photo(service.asset, width: thumb, height: thumb),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(service.title, style: T.cardTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
                  gap6,
                  Text(
                    '${service.provider.name} · ${service.distance}',
                    style: T.small.copyWith(fontSize: 14.5),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  gap8,
                  Row(
                    children: [
                      Flexible(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            service.priceLabel,
                            style: T.smallStrong.copyWith(
                              fontSize: 16,
                              color: V.brand,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: RatingInline(service.rating),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (effectiveTrailing != null) ...[
              const SizedBox(width: 6),
              effectiveTrailing,
            ],
          ],
        );

        if (!card) {
          return InkWell(
            onTap: onTap ?? () => go(context, ServiceDetailScreen(service: service)),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: row,
            ),
          );
        }
        return ServCard(
          padding: const EdgeInsets.all(14),
          onTap: onTap ?? () => go(context, ServiceDetailScreen(service: service)),
          child: row,
        );
      },
    );
  }
}

/// Wide promo card used inside a category list.
class FeatureServiceCard extends StatelessWidget {
  const FeatureServiceCard({super.key, required this.service, this.headline});

  final Service service;
  final String? headline;

  @override
  Widget build(BuildContext context) {
    return ServCard(
      padding: const EdgeInsets.all(14),
      onTap: () => go(context, ServiceDetailScreen(service: service)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.asset(
              service.asset,
              height: 172,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
          gap14,
          Text(
            headline ?? 'A fresh space, a lighter day.',
            style: T.cardTitle.copyWith(fontSize: 19),
          ),
          gap8,
          Row(
            children: [
              Flexible(
                child: Text(
                  '${service.provider.name} · Supplies included',
                  style: T.bodyMuted.copyWith(fontSize: 15),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 6),
              const Icon(Icons.star_rounded, size: 16, color: V.ink),
              const SizedBox(width: 4),
              Text(service.rating, style: T.smallStrong),
            ],
          ),
          gap12,
          Text(
            'From ${service.priceLabel} · View service',
            style: T.link.copyWith(fontSize: 15.5, color: V.brand),
          ),
        ],
      ),
    );
  }
}

/// Row of circular category shortcuts (home screen), responsive to screen width.
class CategoryStrip extends StatelessWidget {
  const CategoryStrip({super.key, required this.items, required this.onTap});

  final List<CategoryItem> items;
  final void Function(CategoryItem) onTap;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableWidth = constraints.maxWidth;
        // Total needed for 5 items with 62px icon + 8px gap = 62*5 + 32 = 342px
        final isNarrow = availableWidth < 345;
        if (isNarrow) {
          return SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            clipBehavior: Clip.none,
            child: Row(
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0) const SizedBox(width: 12),
                  SizedBox(
                    width: 66,
                    child: _buildItem(items[i], 58),
                  ),
                ],
              ],
            ),
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: _buildItem(items[i], 62),
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _buildItem(CategoryItem item, double size) {
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () => onTap(item),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            height: size,
            width: size,
            decoration: BoxDecoration(
              color: V.tint,
              borderRadius: BorderRadius.circular(size * 0.3),
            ),
            child: Icon(item.icon, size: size * 0.42, color: V.brand),
          ),
          const SizedBox(height: 8),
          Text(
            item.name,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: T.micro.copyWith(
              fontSize: 12.5,
              color: V.ink,
              fontWeight: FontWeight.w400,
            ),
          ),
        ],
      ),
    );
  }
}

/// Small "city · distance" header used above result lists.
class ResultSummary extends StatelessWidget {
  const ResultSummary({super.key, required this.left, this.action, this.onAction});

  final String left;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(left, style: T.bodyMuted.copyWith(fontSize: 15)),
        ),
        if (action != null)
          GestureDetector(
            onTap: onAction,
            child: Row(
              children: [
                Text(
                  action!,
                  style: T.link.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(width: 5),
                const Icon(LucideIcons.chevronDown, size: 16, color: V.brand),
              ],
            ),
          ),
      ],
    );
  }
}
