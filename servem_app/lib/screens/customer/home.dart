import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../servmate/setup.dart';
import 'categories.dart';
import 'search_results.dart';
import 'widgets.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(V.pad, 6, V.pad, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Home', style: T.h1),
            gap20,
            SearchBox(
              hint: 'What do you need help with?',
              onTap: () => go(context, const SearchResultsScreen()),
            ),
            gap24,
            Text('What needs doing?', style: T.section),
            gap16,
            CategoryStrip(
              items: AppState.instance.categories.value,
              onTap: (item) => go(context, CategoryScreen(category: item.name)),
            ),
            gap24,
            SectionHeader(
              title: 'Great help nearby',
              action: 'See all',
              onAction: () => Session.openTab(context, 1),
            ),
            ValueListenableBuilder<List<Service>>(
              valueListenable: AppState.instance.services,
              builder: (context, services, _) {
                if (services.isEmpty && Session.status.value == SessionStatus.connecting) {
                  return const SkeletonList(rows: 3, padding: EdgeInsets.zero);
                }
                final display = services.take(3).toList();
                if (display.isEmpty) {
                  return StateBlock(
                    icon: Icons.search,
                    title: 'No services near you yet',
                    body:
                        'We are still adding ServMates in your area. Browse the full list or check back soon.',
                    children: [
                      gap18,
                      PrimaryButton(
                        label: 'Browse services',
                        onPressed: () => Session.openTab(context, 1),
                      ),
                    ],
                  );
                }
                return Column(
                  children: [
                    for (final s in display)
                      ServiceTile(service: s, showFavorite: true),
                  ],
                );
              },
            ),
            gap14,
            _ServMatePromo(),
          ],
        ),
      ),
    );
  }
}

class _ServMatePromo extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Material(
      color: V.tint,
      borderRadius: BorderRadius.circular(V.cardRadius),
      child: InkWell(
        borderRadius: BorderRadius.circular(V.cardRadius),
        onTap: () => go(context, const BecomeServMateScreen()),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 16, 20),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your skills. Someone’s day made.',
                      style: T.cardTitle.copyWith(color: V.brandDeep),
                    ),
                    gap8,
                    Text(
                      'Become a ServMate',
                      style: T.small.copyWith(fontSize: 15, color: V.ink),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              const Icon(LucideIcons.arrowUpRight, size: 21, color: V.brand),
            ],
          ),
        ),
      ),
    );
  }
}
