import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/errors.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import '../messages/customer_messages.dart';
import 'jobs.dart';

class DashboardTab extends StatelessWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ListenableBuilder(
        listenable: Listenable.merge([
          Session.availableForWork,
          AppState.instance.todayEarnings,
          AppState.instance.historyJobs,
          AppState.instance.jobRequests,
          AppState.instance.upcomingJobs,
          AppState.instance.activeJobs,
        ]),
        builder: (context, _) {
          final available = Session.availableForWork.value;
          final todayEarnings = AppState.instance.todayEarnings.value;
          final completedJobsCount = AppState.instance.historyJobs.value.length;
          final requests = AppState.instance.jobRequests.value;
          final scheduleJobs = [
            ...AppState.instance.activeJobs.value,
            ...AppState.instance.upcomingJobs.value,
          ];

          // First load: keep the page's shape instead of showing an empty day.
          if (Session.status.value == SessionStatus.connecting &&
              requests.isEmpty &&
              scheduleJobs.isEmpty) {
            return const SafeArea(
              bottom: false,
              child: SingleChildScrollView(child: SkeletonList(rows: 4)),
            );
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(V.pad, 6, V.pad, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Home', style: T.h1),
                gap20,
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Available for work',
                        style: T.cardTitle.copyWith(fontSize: 17),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Switch(
                      value: available,
                      onChanged: (v) => performAction(
                        context,
                        () => AppState.instance.setAvailableForWork(v),
                        successMessage: v
                            ? 'You are now visible to customers nearby.'
                            : 'You are set to unavailable for work.',
                      ),
                    ),
                  ],
                ),
                gap12,
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: V.tint,
                    borderRadius: BorderRadius.circular(V.cardRadius),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 3,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Today’s earnings',
                              style: T.small.copyWith(fontSize: 15),
                            ),
                            gap8,
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Text(
                                formatPeso(todayEarnings, showCents: true),
                                style: T.h1.copyWith(color: V.brandDeep),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 2,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Text(
                                '$completedJobsCount jobs completed',
                                style: T.small.copyWith(fontSize: 14.5),
                              ),
                            ),
                            gap10,
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Text(
                                '${requests.length} new request${requests.length == 1 ? '' : 's'}',
                                style: T.small.copyWith(fontSize: 14.5),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                gap20,
                SectionHeader(
                  title: 'New requests',
                  action: '${requests.length} new',
                  padding: const EdgeInsets.only(bottom: 12),
                  onAction: () => Session.openTab(context, 1),
                ),
                if (requests.isNotEmpty)
                  _RequestCard(request: requests.first)
                else
                  ServCard(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.checkCircle2, color: V.brand, size: 24),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            'All caught up! No pending requests.',
                            style: T.bodyMuted.copyWith(fontSize: 15),
                          ),
                        ),
                      ],
                    ),
                  ),
                gap20,
                Text('Next on your schedule', style: T.section),
                gap12,
                if (scheduleJobs.isEmpty)
                  ServCard(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.calendar, color: V.muted, size: 22),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            'No jobs on your schedule right now.',
                            style: T.bodyMuted.copyWith(fontSize: 15),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  for (final job in scheduleJobs) ...[
                    _ScheduleRow(job: job),
                    gap10,
                  ],
                gap14,
                Text('Messages', style: T.section),
                gap10,
                SizedBox(
                  height: 54,
                  child: Material(
                    color: V.tint,
                    borderRadius: BorderRadius.circular(V.radius),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(V.radius),
                      onTap: () => go(context, const CustomerMessagesScreen()),
                      child: Center(
                        child: Text(
                          'Open messages',
                          style: T.button.copyWith(color: V.brand, fontSize: 16.5),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request});
  final JobRequest request;

  @override
  Widget build(BuildContext context) {
    return ServCard(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  request.title,
                  style: T.cardTitle.copyWith(fontSize: 17.5),
                ),
              ),
              Text(formatPeso(request.price), style: T.label.copyWith(fontSize: 17)),
            ],
          ),
          gap6,
          Text('${request.customer} · ${request.when}',
              style: T.small.copyWith(fontSize: 14.5)),
          gap14,
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 46,
                  child: Material(
                    color: V.brand,
                    borderRadius: BorderRadius.circular(10),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () {
                        performAction(
                          context,
                          () => AppState.instance.acceptRequest(request.id),
                          onSuccess: (_) {
                            if (!context.mounted) return;
                            go(context,
                                ConfirmedJobScreen(job: _jobForRequest(request)));
                          },
                        );
                      },
                      child: Center(
                        child: Text(
                          'Accept',
                          style: T.button.copyWith(fontSize: 16),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SizedBox(
                  height: 46,
                  child: Material(
                    color: V.surface,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: const BorderSide(color: V.line),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () {
                        performAction(
                          context,
                          () => AppState.instance.declineRequest(request.id),
                          successMessage: 'Request declined',
                        );
                      },
                      child: Center(
                        child: Text(
                          'Decline',
                          style: T.label.copyWith(
                            fontWeight: FontWeight.w400,
                            color: V.muted,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          gap12,
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              StatusBadge(request.status, tone: BadgeTone.warning),
              Text(
                '${request.area} · ${request.distance}',
                style: T.micro.copyWith(fontSize: 12.5),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// The job row the accept flow just produced, falling back to the request's
  /// own details until the Firestore stream lands.
  static Job _jobForRequest(JobRequest request) {
    final match = AppState.instance.upcomingJobs.value.where(
        (j) => j.docId == request.docId || (j.title == request.title && j.when == request.when));
    return match.isNotEmpty
        ? match.first
        : Job(
            docId: request.docId,
            title: request.title,
            customer: request.customer,
            when: request.when,
            price: request.price,
            area: request.area,
            distanceKm: request.distanceKm,
            status: BookingStatus.confirmed,
            asset: request.asset,
            address: request.area,
          );
  }
}

class _ScheduleRow extends StatelessWidget {
  const _ScheduleRow({required this.job});
  final Job job;

  @override
  Widget build(BuildContext context) {
    final slot = _ManilaSlot.parse(job.when);
    final status = BookingStatus.fromFirestore(job.status);
    final inProgress = status == BookingStatus.inProgress;
    final stage = job.status.toLowerCase();

    return InkWell(
      onTap: () => go(
        context,
        stage == 'in progress'
            ? JobUpdateScreen(job: job)
            : (stage == 'en route' || stage == 'arrived')
                ? EnRouteScreen(job: job)
                : ConfirmedJobScreen(job: job),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 60,
            decoration: BoxDecoration(
              color: V.soft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  slot.month.toUpperCase(),
                  style: T.micro.copyWith(fontSize: 11, letterSpacing: 1.2),
                ),
                gap4,
                Text(
                  slot.day,
                  style: T.h3.copyWith(fontSize: 22, color: V.brandDeep),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  job.title,
                  style: T.cardTitle.copyWith(fontSize: 16.5),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                gap4,
                Text(
                  '${job.customer} · ${slot.time}',
                  style: T.small.copyWith(fontSize: 14.5),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: StatusBadge(
              job.status,
              tone: inProgress ? BadgeTone.warning : BadgeTone.brand,
            ),
          ),
          const SizedBox(width: 4),
          const Icon(LucideIcons.chevronRight, size: 18, color: V.muted),
        ],
      ),
    );
  }
}

/// Day / month / time pieces of a Manila slot label such as
/// `Sun, 25 Oct · 9:00 AM – 11:00 AM`, so the schedule chip never shows a
/// hardcoded month.
class _ManilaSlot {
  const _ManilaSlot({
    required this.day,
    required this.month,
    required this.time,
  });

  final String day;
  final String month;
  final String time;

  static _ManilaSlot parse(String when) {
    final sections = when.split('·');
    final datePart = (sections.isNotEmpty ? sections.first : when).trim();
    final timePart = sections.length > 1
        ? sections.sublist(1).join('·').trim()
        : datePart;
    final match = RegExp(r'(\d{1,2})\s+([A-Za-z]{3})').firstMatch(datePart);
    if (match != null) {
      return _ManilaSlot(
        day: match.group(1)!,
        month: match.group(2)!,
        time: timePart.isEmpty ? datePart : timePart,
      );
    }
    final fallback = RegExp(r'([A-Za-z]{3})\w*\s+(\d{1,2})').firstMatch(datePart);
    return _ManilaSlot(
      day: fallback?.group(2) ?? '—',
      month: fallback?.group(1) ?? '—',
      time: timePart.isEmpty ? datePart : timePart,
    );
  }
}

class MateUpdatesScreen extends StatelessWidget {
  const MateUpdatesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ShellScreen(
      title: 'Your updates',
      navIndex: 0,
      items: mateNav,
      child: ValueListenableBuilder<List<AppNotification>>(
        valueListenable: AppState.instance.mateNotifications,
        builder: (context, notifs, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text('Today', style: T.section),
                const Spacer(),
                GestureDetector(
                  onTap: () {
                    performAction(
                      context,
                      () => AppState.instance
                          .markAllNotificationsRead(forServMate: true),
                      successMessage: 'All notifications marked as read.',
                    );
                  },
                  child: Text('Mark all as read', style: T.link),
                ),
              ],
            ),
            gap14,
            if (notifs.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 36),
                child: Center(
                  child: Text('No new updates.', style: T.bodyMuted),
                ),
              )
            else
              for (var i = 0; i < notifs.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: V.tint,
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: Icon(
                          notifs[i].icon,
                          size: 22,
                          color: V.brand,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              notifs[i].title,
                              style: T.cardTitle.copyWith(fontSize: 16.5),
                            ),
                            gap6,
                            Text(
                              notifs[i].body,
                              style: T.small.copyWith(fontSize: 14.5, height: 1.5),
                            ),
                            gap8,
                            Text(
                              notifs[i].when,
                              style: T.micro.copyWith(fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            gap16,
            const InfoBanner(
              title: 'Stay in the loop',
              body:
                  'We’ll notify you when a customer requests a service, confirms a time change, or sends a message.',
            ),
          ],
        ),
      ),
    );
  }
}
