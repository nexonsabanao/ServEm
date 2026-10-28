import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import 'widgets.dart';

class SearchResultsScreen extends StatefulWidget {
  const SearchResultsScreen({super.key, this.initialQuery = 'Furniture assembly'});

  final String initialQuery;

  @override
  State<SearchResultsScreen> createState() => _SearchResultsScreenState();
}

class _SearchResultsScreenState extends State<SearchResultsScreen> {
  /// Hourly-rate ceiling for the budget filter, in Philippine pesos.
  static const _budgetRate = 400.0;

  late final TextEditingController _search;
  bool _underBudget = false;
  bool _minRating45 = true;
  String _sort = 'Top rated';

  @override
  void initState() {
    super.initState();
    _search = TextEditingController(text: widget.initialQuery);
    _search.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _clearFilters() {
    setState(() {
      _search.clear();
      _underBudget = false;
      _minRating45 = false;
      _sort = 'Recommended';
    });
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<Service>>(
      valueListenable: AppState.instance.services,
      builder: (context, allServices, _) {
        final query = _search.text.trim().toLowerCase();

        var filtered = allServices.where((s) {
          if (query.isNotEmpty) {
            final match = s.title.toLowerCase().contains(query) ||
                s.category.toLowerCase().contains(query) ||
                s.provider.name.toLowerCase().contains(query) ||
                s.description.toLowerCase().contains(query);
            if (!match) return false;
          }
          if (_underBudget && s.price >= _budgetRate) return false;
          if (_minRating45) {
            final r = double.tryParse(s.rating) ?? 0.0;
            if (r < 4.5) return false;
          }
          return true;
        }).toList();

        // Sort
        if (_sort == 'Top rated') {
          filtered.sort((a, b) => (double.tryParse(b.rating) ?? 0)
              .compareTo(double.tryParse(a.rating) ?? 0));
        } else if (_sort == 'Price: Low') {
          filtered.sort((a, b) => a.price.compareTo(b.price));
        }

        final activeFilterCount = (_underBudget ? 1 : 0) + (_minRating45 ? 1 : 0);

        return ShellScreen(
          title: 'Search results',
          navIndex: 1,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SearchBox(
                hint: 'Search services',
                controller: _search,
                onChanged: (_) => setState(() {}),
              ),
              gap14,
              Text(
                '${defaultPhilippineLocation.city}, Metro Manila · '
                '${formatCoverageKm(5)}',
                style: T.bodyMuted.copyWith(fontSize: 15),
              ),
              gap16,
              ChipRow(
                children: [
                  ServChip(
                    label: 'Filters · $activeFilterCount',
                    selected: activeFilterCount > 0,
                    onTap: () {
                      if (activeFilterCount > 0) {
                        _clearFilters();
                      } else {
                        setState(() {
                          _underBudget = true;
                          _minRating45 = true;
                        });
                      }
                    },
                  ),
                  ServChip(
                    label: 'Under ${formatPeso(_budgetRate)} / hr',
                    selected: _underBudget,
                    onTap: () => setState(() => _underBudget = !_underBudget),
                  ),
                  ServChip(
                    label: '4.5+ stars',
                    selected: _minRating45,
                    onTap: () => setState(() => _minRating45 = !_minRating45),
                  ),
                ],
              ),
              gap20,
              if (filtered.isEmpty) ...[
                gap20,
                const StateBlock(
                  icon: LucideIcons.searchX,
                  title: 'No matches just yet',
                  body:
                      'No services match these filters in Metro Manila. Try a different search term or clear your filters.',
                ),
                gap24,
                PrimaryButton(
                  label: 'Clear filters',
                  onPressed: _clearFilters,
                ),
              ] else ...[
                ResultSummary(
                  left: '${filtered.length} services found',
                  action: _sort,
                  onAction: () {
                    setState(() {
                      _sort = _sort == 'Top rated' ? 'Price: Low' : 'Top rated';
                    });
                  },
                ),
                gap10,
                for (final s in filtered) ...[
                  ServiceTile(service: s, card: true, showFavorite: true),
                  gap14,
                ],
                gap8,
                const InfoBanner(
                  title: 'Carefully built, close to home.',
                  body: 'Compare reviews, skills and availability before you book.',
                ),
              ],
              gap8,
            ],
          ),
        );
      },
    );
  }
}
