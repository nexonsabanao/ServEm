import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import 'jobs.dart';

class RequestsTab extends StatefulWidget {
  const RequestsTab({super.key});

  @override
  State<RequestsTab> createState() => _RequestsTabState();
}

class _RequestsTabState extends State<RequestsTab> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ListenableBuilder(
        listenable: Listenable.merge([
          AppState.instance.jobRequests,
          AppState.instance.respondedRequests,
        ]),
        builder: (context, _) {
          final requests = AppState.instance.jobRequests.value;
          final responded = AppState.instance.respondedRequests.value;

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(V.pad, 6, V.pad, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('New requests', style: T.h1),
                gap20,
                ChipRow(
                  children: [
                    ServChip(
                      label: 'New (${requests.length})',
                      selected: _tab == 0,
                      onTap: () => setState(() => _tab = 0),
                    ),
                    ServChip(
                      label: 'Responded (${responded.length})',
                      selected: _tab == 1,
                      onTap: () => setState(() => _tab = 1),
                    ),
                  ],
                ),
                gap18,
                if (_tab == 0) ...[
                  if (requests.isEmpty)
                    const StateBlock(
                      icon: LucideIcons.inbox,
                      title: 'No pending requests',
                      body: 'New booking requests from customers will appear here.',
                    )
                  else
                    for (final request in requests) ...[
                      _RequestTile(request: request),
                      gap14,
                    ],
                ] else ...[
                  if (responded.isEmpty)
                    const StateBlock(
                      icon: LucideIcons.inbox,
                      title: 'No replies yet',
                      body: 'Requests you accept or decline show up here.',
                    )
                  else
                    for (final request in responded) ...[
                      _RespondedTile(request: request),
                      gap14,
                    ],
                ],
                gap8,
                const InfoBanner(
                  icon: LucideIcons.lock,
                  title: 'A little privacy, by design',
                  body:
                      'Only the general area is shown. Exact addresses unlock after you accept.',
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _RequestTile extends StatelessWidget {
  const _RequestTile({required this.request});
  final JobRequest request;

  @override
  Widget build(BuildContext context) {
    return ServCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      onTap: () => go(context, ReviewRequestScreen(request: request)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const StatusBadge('Awaiting provider', tone: BadgeTone.warning),
              const Spacer(),
              Text(formatPeso(request.price), style: T.label.copyWith(fontSize: 17, color: V.brand)),
            ],
          ),
          gap12,
          Text(request.title, style: T.cardTitle.copyWith(fontSize: 17.5)),
          gap6,
          Text('${request.customer} · Customer', style: T.bodyMuted.copyWith(fontSize: 15)),
          gap8,
          Text(request.when, style: T.body.copyWith(fontSize: 15.5)),
          gap6,
          Text('${request.area} · ${request.distance}', style: T.small.copyWith(fontSize: 14.5)),
          gap12,
          Text('Review request', style: T.link),
        ],
      ),
    );
  }
}

class _RespondedTile extends StatelessWidget {
  const _RespondedTile({required this.request});
  final JobRequest request;

  @override
  Widget build(BuildContext context) {
    final accepted = request.status.toLowerCase() == 'accepted';

    return ServCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      onTap: accepted
          ? () {
              final job = AppState.instance.upcomingJobs.value.firstWhere(
                (j) => j.title == request.title && j.customer == request.customer,
                orElse: () => Job(
                  title: request.title,
                  customer: request.customer,
                  when: request.when,
                  price: request.price,
                  area: request.area,
                  distanceKm: request.distanceKm,
                  status: 'Confirmed',
                  asset: request.asset,
                ),
              );
              go(context, ConfirmedJobScreen(job: job));
            }
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusBadge(
                request.status,
                tone: accepted ? BadgeTone.brand : BadgeTone.neutral,
              ),
              const Spacer(),
              Text(formatPeso(request.price), style: T.label.copyWith(fontSize: 17, color: V.brand)),
            ],
          ),
          gap12,
          Text(request.title, style: T.cardTitle.copyWith(fontSize: 17.5)),
          gap6,
          Text('${request.customer} · Customer', style: T.bodyMuted.copyWith(fontSize: 15)),
          gap8,
          Text(request.when, style: T.body.copyWith(fontSize: 15.5)),
          if (accepted) ...[
            gap12,
            Text('View confirmed job', style: T.link),
          ],
        ],
      ),
    );
  }
}

class ReviewRequestScreen extends StatelessWidget {
  const ReviewRequestScreen({super.key, required this.request});

  final JobRequest request;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Review request',
      bottom: CtaBar(
        label: 'Accept request',
        link: 'Decline request',
        onLink: () {
          AppState.instance.declineRequest(request.id);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Request declined'),
              backgroundColor: V.brandDeep,
            ),
          );
          Navigator.of(context).pop();
        },
        onPressed: () {
          AppState.instance.acceptRequest(request.id);
          final job = AppState.instance.upcomingJobs.value.firstWhere(
            (j) => j.title == request.title && j.customer == request.customer,
            orElse: () => Job(
              title: request.title,
              customer: request.customer,
              when: request.when,
              price: request.price,
              area: request.area,
              distanceKm: request.distanceKm,
              status: 'Confirmed',
              asset: request.asset,
            ),
          );
          go(context, ConfirmedJobScreen(job: job));
        },
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const StatusBadge('Awaiting provider', tone: BadgeTone.warning),
              const SizedBox(width: 10),
              Text(request.id, style: T.small.copyWith(fontSize: 14.5)),
            ],
          ),
          gap14,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Photo(request.asset.isNotEmpty ? request.asset : '',
                        width: 62, height: 62),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(request.title, style: T.cardTitle.copyWith(fontSize: 18)),
                          gap4,
                          Text(
                            '${request.customer} · Customer',
                            style: T.bodyMuted.copyWith(fontSize: 15),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                gap14,
                Text(request.when, style: T.body.copyWith(fontSize: 15.5)),
                gap8,
                Text('${formatPeso(request.price)} estimate', style: T.bodyMuted.copyWith(fontSize: 15)),
              ],
            ),
          ),
          gap14,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Customer notes', style: T.label.copyWith(fontSize: 16)),
                gap10,
                Text(
                  'Assemble an IKEA desk and bookshelf. All boxes are ready in the living room. Please bring tools.',
                  style: T.bodyMuted.copyWith(fontSize: 15.5),
                ),
              ],
            ),
          ),
          gap14,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(LucideIcons.mapPin, size: 22, color: V.muted),
                    const SizedBox(width: 14),
                    Text('General area', style: T.body.copyWith(fontSize: 16)),
                    const Spacer(),
                    Text('Park Slope',
                        style: T.body.copyWith(fontSize: 15.5, color: V.brand)),
                  ],
                ),
                const Divider(height: 26),
                Text('${request.area} · ${request.distance} away',
                    style: T.bodyMuted.copyWith(fontSize: 15)),
                gap8,
                Text(
                  'Exact address and contact details are hidden until you accept.',
                  style: T.small,
                ),
              ],
            ),
          ),
          gap14,
          Container(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
            decoration: BoxDecoration(
              color: V.tint,
              borderRadius: BorderRadius.circular(V.cardRadius),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Estimated earnings · 2 hours', style: T.body.copyWith(fontSize: 15)),
                gap8,
                Text(formatPeso(request.price),
                    style: T.h1.copyWith(color: V.brandDeep)),
                gap8,
                Text(
                  'Customer total is ${formatPeso((request.price * 1.1).round())}, including the 10% ServEm fee.',
                  style: T.small,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
