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
                        decoration: BoxDecoration(
                            color: AppPalette.graphite,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'S',
                          style: TextStyle(
                            color: AppPalette.paper,
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
                  const SizedBox(height: 26),
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
                  child: Center(child: CircularProgressIndicator()),
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
              return SliverPadding(
                padding: const EdgeInsets.fromLTRB(22, 14, 22, 28),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      if (index == 0) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 11),
                          child: Text(
                            'Showing ${items.length} ${items.length == 1 ? 'service' : 'services'}',
                            style: const TextStyle(
                              color: AppPalette.graphite,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.2,
                            ),
                          ),
                        );
                      }
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 11),
                        child: _ServiceCard(listing: items[index - 1]),
                      );
                    },
                    childCount: items.length + 1,
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
            Icon(
              isBookings ? Icons.receipt_long_outlined : Icons.person_outline,
              size: 33,
              color: AppPalette.slate,
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

class _DiscoveryHero extends StatelessWidget {
  const _DiscoveryHero();

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(23),
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
                    decoration: BoxDecoration(
                      color: AppPalette.paper,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'SERVICES, SIMPLIFIED',
                      style: TextStyle(
                        color: AppPalette.graphite,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                      ),
                    ),
                  ),
                  const SizedBox(height: 17),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 280),
                    child: const Text(
                      'Find the right help for your next project.',
                      style: TextStyle(
                        fontFamily: 'serif',
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
            Positioned(
              right: -45,
              bottom: -57,
              child: Container(
                width: 150,
                height: 150,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: AppPalette.paper, width: 1.2),
                ),
              ),
            ),
          ],
        ),
      );
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.listing});

  final ServiceListing listing;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppPalette.card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: AppPalette.mist),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: AppPalette.paleSlate,
                borderRadius: BorderRadius.circular(15),
              ),
              alignment: Alignment.center,
              child: Text(
                listing.title.isEmpty
                    ? 'S'
                    : String.fromCharCode(listing.title.runes.first).toUpperCase(),
                style: const TextStyle(
                  color: AppPalette.slate,
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
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          height: 1.25,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    listing.startingPriceCentavos == null
                        ? 'Request a quote'
                        : 'From ${_formatPrice(listing.startingPriceCentavos!)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppPalette.graphite,
                          fontWeight: FontWeight.w600,
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

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.search_off_rounded,
                  color: AppPalette.slate, size: 38),
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
            const Icon(Icons.wifi_off_rounded,
                color: AppPalette.slate, size: 38),
            const SizedBox(height: 14),
            Text(message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge),
            if (requestId != null) ...[
              const SizedBox(height: 8),
              SelectableText('Reference: $requestId',
                  style: Theme.of(context).textTheme.bodySmall),
            ],
            const SizedBox(height: 15),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
