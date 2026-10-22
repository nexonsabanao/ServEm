import 'package:flutter/material.dart';

import '../../../app/theme/app_palette.dart';
import '../../../core/api/api_exception.dart';
import '../data/service_listing.dart';
import '../data/services_repository.dart';

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({required this.repository, super.key});

  final ServicesRepository repository;

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  late Future<List<ServiceListing>> _listings;
  String _query = '';
  int _selectedTab = 0;

  @override
  void initState() {
    super.initState();
    _listings = widget.repository.listPublished();
  }

  void _reload() {
    setState(() => _listings = widget.repository.listPublished());
  }

  @override
  Widget build(BuildContext context) {
    final isDiscover = _selectedTab == 0;
    return Scaffold(
      body: SafeArea(
        child: isDiscover ? _buildDiscover(context) : _buildAccountPlaceholder(),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedTab,
        onDestinationSelected: (index) => setState(() => _selectedTab = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore),
            label: 'Discover',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Bookings',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Account',
          ),
        ],
      ),
    );
  }

  Widget _buildDiscover(BuildContext context) {
    final theme = Theme.of(context);
    return RefreshIndicator(
      color: AppPalette.slateDeep,
      backgroundColor: AppPalette.card,
      onRefresh: () async => _reload(),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(22, 24, 22, 18),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: const BoxDecoration(
                          color: AppPalette.graphite,
                          borderRadius: BorderRadius.all(Radius.circular(14)),
                          boxShadow: _tileShadow,
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'S',
                          style: TextStyle(
                            color: AppPalette.paper,
                            fontFamily: AppType.display,
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -1,
                          ),
                        ),
                      ),
                      const SizedBox(width: 11),
                      Text(
                        'servem',
                        style: theme.textTheme.titleLarge?.copyWith(
                          letterSpacing: -0.7,
                          fontSize: 22,
                        ),
                      ),
                      const Spacer(),
                      Material(
                        color: AppPalette.card,
                        shape: const CircleBorder(
                          side: BorderSide(color: AppPalette.mist),
                        ),
                        child: IconButton(
                          tooltip: 'Refresh services',
                          onPressed: _reload,
                          icon: const Icon(Icons.refresh_rounded),
                          color: AppPalette.graphite,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const _DiscoveryHero(),
                  const SizedBox(height: 18),
                  _DiscoverySearch(
                    value: _query,
                    onChanged: (value) => setState(() => _query = value),
                  ),
                  const SizedBox(height: 22),
                  Text('Published services', style: theme.textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Text(
                    'Offers from independent providers',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
          FutureBuilder<List<ServiceListing>>(
            future: _listings,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const SliverFillRemaining(
                  hasScrollBody: false,
                  child: _LoadingState(),
                );
              }
              if (snapshot.hasError) {
                return SliverFillRemaining(
                  hasScrollBody: false,
                  child: _ErrorState(
                    error: snapshot.error,
                    onRetry: _reload,
                  ),
                );
              }
              final items = snapshot.data ?? const <ServiceListing>[];
              if (items.isEmpty) {
                return const SliverFillRemaining(
                  hasScrollBody: false,
                  child: _EmptyState(),
                );
              }
              final trimmed = _query.trim().toLowerCase();
              final visible = trimmed.isEmpty
                  ? items
                  : items
                      .where((listing) =>
                          listing.title.toLowerCase().contains(trimmed))
                      .toList();
              if (visible.isEmpty) {
                return SliverFillRemaining(
                  hasScrollBody: false,
                  child: _NoMatchState(query: _query.trim()),
                );
              }
              return SliverPadding(
                padding: const EdgeInsets.fromLTRB(22, 14, 22, 28),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      if (index == 0) {
                        final counted = trimmed.isEmpty
                            ? '${visible.length} ${visible.length == 1 ? 'service' : 'services'}'
                            : '${visible.length} of ${items.length} for “${_query.trim()}”';
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 11),
                          child: Text(
                            counted.toUpperCase(),
                            style: AppType.eyebrow.copyWith(
                              color: AppPalette.slateDeep,
                            ),
                          ),
                        );
                      }
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 11),
                        child: _ServiceCard(listing: visible[index - 1]),
                      );
                    },
                    childCount: visible.length + 1,
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAccountPlaceholder() {
    final isBookings = _selectedTab == 1;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _StateMark(
              icon: isBookings
                  ? Icons.receipt_long_outlined
                  : Icons.person_outline,
            ),
            const SizedBox(height: 16),
            Text(
              isBookings ? 'Your bookings' : 'Your account',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Sign-in is being set up. Your bookings and account details will appear here once secure sign-in is available.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

const _tileShadow = [
  BoxShadow(
    color: AppPalette.shadowInk,
    offset: Offset(0, 1),
    blurRadius: 3,
  ),
];

class _DiscoveryHero extends StatelessWidget {
  const _DiscoveryHero();

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: const BoxDecoration(
          borderRadius: BorderRadius.all(Radius.circular(23)),
          boxShadow: [_heroShadow],
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.all(Radius.circular(23)),
          child: Stack(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(21, 22, 21, 23),
                decoration: const BoxDecoration(color: AppPalette.slateDeep),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: const BoxDecoration(
                        color: AppPalette.paper,
                        borderRadius: BorderRadius.all(Radius.circular(20)),
                      ),
                      child: const Text(
                        'SERVICES, SIMPLIFIED',
                        style: TextStyle(
                          color: AppPalette.graphite,
                          fontFamily: AppType.utility,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                        ),
                      ),
                    ),
                    const SizedBox(height: 17),
                    const ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: 280),
                      child: Text(
                        'Find the right help for your next project.',
                        style: TextStyle(
                          fontFamily: AppType.display,
                          fontFamilyFallback: AppType.displayFallback,
                          color: AppPalette.paper,
                          fontSize: 28,
                          height: 1.08,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.7,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Explore published offers from independent providers.',
                      style: TextStyle(
                        color: AppPalette.paper,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const Positioned(
                right: -45,
                bottom: -57,
                child: _HeroRing(width: 150, height: 150),
              ),
              const Positioned(
                right: -20,
                bottom: -35,
                child: _HeroRing(width: 100, height: 100),
              ),
            ],
          ),
        ),
      );
}

const _heroShadow = BoxShadow(
  color: AppPalette.shadowInk,
  offset: Offset(0, 8),
  blurRadius: 24,
);

class _HeroRing extends StatelessWidget {
  const _HeroRing({required this.width, required this.height});

  final double width;
  final double height;

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          border: Border.fromBorderSide(
            BorderSide(color: AppPalette.paper, width: 1.2),
          ),
        ),
      );
}

/// Search is the discover screen's one control: the same pill the web top bar
/// prints, filtering the loaded list in place.
class _DiscoverySearch extends StatefulWidget {
  const _DiscoverySearch({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  State<_DiscoverySearch> createState() => _DiscoverySearchState();
}

class _DiscoverySearchState extends State<_DiscoverySearch> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _clear() {
    _controller.clear();
    widget.onChanged('');
  }

  @override
  Widget build(BuildContext context) => TextField(
        controller: _controller,
        onChanged: widget.onChanged,
        textInputAction: TextInputAction.search,
        style: const TextStyle(
          color: AppPalette.graphite,
          fontFamily: AppType.utility,
          fontSize: 13.5,
        ),
        decoration: InputDecoration(
          filled: true,
          fillColor: AppPalette.card,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          hintText: 'Search services',
          hintStyle: const TextStyle(
            color: AppPalette.inkSoft,
            fontFamily: AppType.utility,
            fontSize: 13,
          ),
          prefixIcon: const Icon(Icons.search_rounded),
          prefixIconColor: AppPalette.inkSoft,
          suffixIcon: widget.value.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Clear search',
                  onPressed: _clear,
                  icon: const Icon(Icons.close_rounded, size: 20),
                  color: AppPalette.inkSoft,
                ),
          border: const OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(999)),
            borderSide: BorderSide(color: AppPalette.line),
          ),
          enabledBorder: const OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(999)),
            borderSide: BorderSide(color: AppPalette.line),
          ),
          focusedBorder: const OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(999)),
            borderSide: BorderSide(color: AppPalette.slateDeep, width: 1.6),
          ),
          isDense: true,
        ),
      );
}

/// The service card, in the receipt language: a slated letterhead tile for the
/// provider, a display-serif title, and the price set in the utility face the
/// same way the web prints it — FROM in small mono, money in serif slate.
class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.listing});

  final ServiceListing listing;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppPalette.card,
      elevation: 1,
      shadowColor: AppPalette.shadowInk,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(18)),
        side: BorderSide(color: AppPalette.line),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: const BoxDecoration(
                color: AppPalette.slateWash,
                borderRadius: BorderRadius.all(Radius.circular(15)),
              ),
              alignment: Alignment.center,
              child: Text(
                listing.title.isEmpty
                    ? 'S'
                    : String.fromCharCode(listing.title.runes.first)
                        .toUpperCase(),
                style: const TextStyle(
                  color: AppPalette.slateDeep,
                  fontFamily: AppType.display,
                  fontSize: 23,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.6,
                ),
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    listing.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 6),
                  Text.rich(
                    TextSpan(
                      children: [
                        if (listing.startingPriceCentavos == null)
                          TextSpan(
                            text: 'Request a quote',
                            style: Theme.of(context).textTheme.bodySmall,
                          )
                        else
                          TextSpan(
                            children: [
                              const TextSpan(
                                text: 'FROM ',
                                style: TextStyle(
                                  color: AppPalette.inkSoft,
                                  fontFamily: AppType.utility,
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.9,
                                ),
                              ),
                              TextSpan(
                                text: _formatPrice(
                                  listing.startingPriceCentavos!,
                                ),
                                style: const TextStyle(
                                  color: AppPalette.slateDeep,
                                  fontFamily: AppType.display,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatPrice(int centavos) {
    final pesos = centavos ~/ 100;
    final cents = centavos % 100;
    final groupedPesos = pesos.toString().replaceAllMapped(
          RegExp(r'\B(?=(\d{3})+(?!\d))'),
          (_) => ',',
        );
    return cents == 0
        ? '₱$groupedPesos'
        : '₱$groupedPesos.${cents.toString().padLeft(2, '0')}';
  }
}

/// Shared state-mark — the wash circle behind every empty, offline or teaser
/// icon, like the web's `.account-empty-mark`.
class _StateMark extends StatelessWidget {
  const _StateMark({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
        width: 46,
        height: 46,
        decoration: const BoxDecoration(
          color: AppPalette.slateWash,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Icon(icon, color: AppPalette.slateDeep, size: 23),
      );
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2.4,
                color: AppPalette.slateDeep,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'LOADING SERVICES',
              style: AppType.eyebrow.copyWith(color: AppPalette.inkSoft),
            ),
          ],
        ),
      );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _StateMark(icon: Icons.search_off_rounded),
              const SizedBox(height: 14),
              Text('No services yet',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(
                'Published provider services will show up here. Pull down to refresh.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      );
}

class _NoMatchState extends StatelessWidget {
  const _NoMatchState({required this.query});

  final String query;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _StateMark(icon: Icons.search_off_rounded),
              const SizedBox(height: 14),
              Text('No matches for “$query”',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(
                'Try a shorter word, or clear the search to see every service.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      );
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.error, required this.onRetry});

  final Object? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final message = switch (error) {
      ApiException exception => exception.message,
      _ => 'We could not load services right now. Please try again.',
    };
    final requestId = error is ApiResponseException
        ? (error as ApiResponseException).requestId
        : null;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _StateMark(icon: Icons.wifi_off_rounded),
            const SizedBox(height: 14),
            Text(message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge),
            if (requestId != null) ...[
              const SizedBox(height: 8),
              SelectableText(
                'Reference: $requestId',
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(fontFamily: AppType.utility),
              ),
            ],
            const SizedBox(height: 15),
            FilledButton.tonal(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 19),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
