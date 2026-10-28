import 'package:flutter/material.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../states/states.dart';
import 'search_results.dart';
import 'widgets.dart';

class ExploreTab extends StatefulWidget {
  const ExploreTab({super.key});

  @override
  State<ExploreTab> createState() => _ExploreTabState();
}

class _ExploreTabState extends State<ExploreTab> {
  int _filter = 0;

  @override
  Widget build(BuildContext context) {
    const filters = ['All services', 'Nearby', 'Top rated'];
    return SafeArea(
      bottom: false,
      child: ValueListenableBuilder<List<Service>>(
        valueListenable: AppState.instance.services,
        builder: (context, services, _) {
          var displayList = List<Service>.from(services);
          if (_filter == 1) {
            displayList = displayList.where((s) => s.distance.contains('0.')).toList();
          } else if (_filter == 2) {
            displayList.sort((a, b) => (double.tryParse(b.rating) ?? 0)
                .compareTo(double.tryParse(a.rating) ?? 0));
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(V.pad, 6, V.pad, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Explore', style: T.h1),
                gap20,
                SearchBox(
                  hint: 'Search services',
                  onTap: () => go(context, const SearchResultsScreen(initialQuery: '')),
                ),
                gap18,
                ChipRow(
                  children: [
                    for (var i = 0; i < filters.length; i++)
                      ServChip(
                        label: filters[i],
                        selected: _filter == i,
                        onTap: () => setState(() => _filter = i),
                      ),
                  ],
                ),
                gap20,
                ResultSummary(
                  left: '${displayList.length} services near '
                      '${AppState.instance.userProfile.value.city.trim().isEmpty ? 'Metro Manila' : AppState.instance.userProfile.value.city}',
                  action: _filter == 2 ? 'Top rated' : 'Recommended',
                ),
                gap6,
                if (displayList.isEmpty && Session.status.value == SessionStatus.connecting)
                  const SkeletonList(rows: 3, padding: EdgeInsets.zero)
                else if (displayList.isEmpty)
                  EmptyResults(
                    body: _filter == 0
                        ? 'No ServMates are listed near you yet. We are adding services in your area.'
                        : 'Nothing matches this filter right now. Show all services to see what is available.',
                    actionLabel: _filter == 0 ? null : 'Show all services',
                    onAction: _filter == 0 ? null : () => setState(() => _filter = 0),
                  )
                else
                  for (final s in displayList)
                    ServiceTile(service: s, showFavorite: true),
                gap12,
                Text(
                  'A little help goes a long way. Browse profiles and reviews before booking.',
                  style: T.bodyMuted.copyWith(fontSize: 15),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
