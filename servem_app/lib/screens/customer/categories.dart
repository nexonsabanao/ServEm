import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import 'search_results.dart';
import 'widgets.dart';

class CategoriesScreen extends StatelessWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ShellScreen(
      title: 'What needs doing?',
      navIndex: 1,
      child: ValueListenableBuilder<List<CategoryItem>>(
        valueListenable: AppState.instance.categories,
        builder: (context, categories, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SearchBox(
              hint: 'Search categories',
              onTap: () => go(context, const SearchResultsScreen()),
            ),
            gap18,
            Text('Everyday tasks. Good people to help.', style: T.bodyMuted),
            gap18,
            ServCard(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
              child: Column(
                children: [
                  for (var i = 0; i < categories.length; i++) ...[
                    if (i > 0) const Divider(height: 1),
                    NavRow(
                      icon: categories[i].icon,
                      title: categories[i].name,
                      subtitle:
                          '${categories[i].blurb} · ${categories[i].count} services',
                      onTap: () => go(
                        context,
                        CategoryScreen(category: categories[i].name),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            gap18,
            Text(
              'Showing services near ${defaultPhilippineLocation.city}, '
              '${defaultPhilippineLocation.province}.',
              style: T.small,
            ),
          ],
        ),
      ),
    );
  }
}

class CategoryScreen extends StatefulWidget {
  const CategoryScreen({super.key, required this.category});
  final String category;

  @override
  State<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends State<CategoryScreen> {
  int _filter = 0;

  List<String> get _filters {
    if (widget.category.toLowerCase().contains('clean')) {
      return ['All cleaning', 'Deep clean', 'Regular'];
    }
    return ['All ${widget.category.toLowerCase()}', 'Popular', 'Regular'];
  }

  /// Live catalogue first, then anything else that exists.
  static Service? _pick(List<Service> services, String category) {
    final c = category.toLowerCase();
    for (final service in services) {
      if (service.category.toLowerCase() == c) return service;
    }
    for (final service in services) {
      if (service.category.toLowerCase().contains(c) ||
          c.contains(service.category.toLowerCase())) {
        return service;
      }
    }
    return services.isEmpty ? null : services.first;
  }

  String get _headline {
    final c = widget.category.toLowerCase();
    if (c.contains('clean')) return 'A fresh space, a lighter day.';
    if (c.contains('repair')) return 'Small fixes, done properly.';
    return 'From box to built.';
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<CategoryItem>>(
      valueListenable: AppState.instance.categories,
      builder: (context, categories, _) {
        final count = categories
            .where((e) => e.name == widget.category)
            .firstOrNull?.count;
        return ValueListenableBuilder<List<Service>>(
          valueListenable: AppState.instance.services,
          builder: (context, services, _) {
            final service = _pick(services, widget.category);
            return ShellScreen(
              title: widget.category,
              navIndex: 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SearchBox(
                    hint: 'Search ${widget.category.toLowerCase()}',
                    onTap: () => go(context, const SearchResultsScreen()),
                  ),
                  gap16,
                  ChipRow(
                    children: [
                      for (var i = 0; i < _filters.length; i++)
                        ServChip(
                          label: _filters[i],
                          selected: _filter == i,
                          onTap: () => setState(() => _filter = i),
                        ),
                    ],
                  ),
                  gap18,
                  ResultSummary(
                    left: '${count ?? services.length} services · '
                        '${defaultPhilippineLocation.city}',
                    action: 'Recommended',
                  ),
                  gap14,
                  const ChipRow(
                    children: [
                      ServChip(label: 'Price', trailingIcon: LucideIcons.chevronDown, height: 44),
                      ServChip(label: 'Rating', trailingIcon: LucideIcons.chevronDown, height: 44),
                      ServChip(label: 'Distance', trailingIcon: LucideIcons.chevronDown, height: 44),
                    ],
                  ),
                  gap18,
                  if (service == null)
                    StateBlock(
                      icon: LucideIcons.inbox,
                      title: 'Nothing listed yet',
                      body:
                          'No ${widget.category.toLowerCase()} services are live in ${defaultPhilippineLocation.city} right now. Try again shortly.',
                    )
                  else ...[
                    ServiceTile(service: service, card: true),
                    gap16,
                    FeatureServiceCard(service: service, headline: _headline),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }
}
