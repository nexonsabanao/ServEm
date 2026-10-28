import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import 'servmate_profile.dart';
import 'widgets.dart';

class SavedHelpScreen extends StatefulWidget {
  const SavedHelpScreen({super.key});

  @override
  State<SavedHelpScreen> createState() => _SavedHelpScreenState();
}

class _SavedHelpScreenState extends State<SavedHelpScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<Set<String>>(
      valueListenable: AppState.instance.savedServices,
      builder: (context, savedServiceTitles, _) {
        return ValueListenableBuilder<Set<String>>(
          valueListenable: AppState.instance.savedMates,
          builder: (context, savedMateNames, _) {
            return ValueListenableBuilder<List<Provider>>(
              valueListenable: AppState.instance.providers,
              builder: (context, allMateList, _) {
                final savedServicesList = AppState.instance.services.value
                    .where((s) => savedServiceTitles.contains(s.title))
                    .toList();

                final savedMatesList =
                    allMateList.where((m) => savedMateNames.contains(m.name)).toList();

                return ShellScreen(
                  title: 'Your saved help',
                  navIndex: 4,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ChipRow(
                        children: [
                          ServChip(
                            label: 'Services (${savedServicesList.length})',
                            selected: _tab == 0,
                            onTap: () => setState(() => _tab = 0),
                          ),
                          ServChip(
                            label: 'ServMates (${savedMatesList.length})',
                            selected: _tab == 1,
                            onTap: () => setState(() => _tab = 1),
                          ),
                        ],
                      ),
                      gap18,
                      if (_tab == 0) ...[
                        if (savedServicesList.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: StateBlock(
                              icon: LucideIcons.heart,
                              title: 'No saved services yet',
                              body:
                                  'Tap the heart on any service to save it here for quick access later.',
                            ),
                          )
                        else
                          for (final service in savedServicesList) ...[
                            ServiceTile(
                              service: service,
                              card: true,
                              trailing: InkWell(
                                onTap: () => AppState.instance
                                    .toggleSavedService(service.title),
                                child: const Padding(
                                  padding: EdgeInsets.all(6),
                                  child: Icon(Icons.favorite,
                                      size: 22, color: V.brand),
                                ),
                              ),
                            ),
                            gap14,
                          ],
                        if (savedMatesList.isNotEmpty) ...[
                          gap6,
                          Text('Saved ServMates', style: T.section),
                          gap12,
                          for (final mate in savedMatesList) ...[
                            _SavedMate(provider: mate),
                            gap10,
                          ],
                        ],
                      ] else ...[
                        if (savedMatesList.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: StateBlock(
                              icon: LucideIcons.user2,
                              title: 'No saved ServMates yet',
                              body:
                                  'Explore local providers and bookmark the ones you trust.',
                            ),
                          )
                        else
                          for (final mate in savedMatesList) ...[
                            _SavedMate(provider: mate),
                            gap14,
                          ],
                      ],
                      gap18,
                      Text(
                        'Tap the heart on a service or ServMate to keep them here for another day.',
                        style: T.bodyMuted.copyWith(fontSize: 15),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }
}

class _SavedMate extends StatelessWidget {
  const _SavedMate({required this.provider});
  final Provider provider;

  @override
  Widget build(BuildContext context) {
    return ServCard(
      onTap: () => go(context, ServMateProfileScreen(provider: provider)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Avatar(provider.asset, size: 62),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(provider.name, style: T.cardTitle.copyWith(fontSize: 18)),
                    gap6,
                    Text(
                      '★ ${provider.rating} · ${provider.reviews} reviews · ${provider.jobs} jobs',
                      style: T.small,
                    ),
                    gap4,
                    Text(
                      '${provider.area} · ${provider.distance}',
                      style: T.small.copyWith(color: V.muted),
                    ),
                  ],
                ),
              ),
              InkWell(
                onTap: () => AppState.instance.toggleSavedMate(provider.name),
                child: const Padding(
                  padding: EdgeInsets.all(6),
                  child: Icon(Icons.favorite, size: 22, color: V.brand),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
