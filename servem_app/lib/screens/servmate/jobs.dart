import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import '../messages/chat.dart';

/// The job a screen should show: the one it was opened with, else the ServMate's
/// real active job. Null means there is none — screens then show
/// [MissingJobScreen] rather than inventing a booking.
Job? _activeJobOrNull(Job? job) =>
    job ??
    (AppState.instance.activeJobs.value.isNotEmpty
        ? AppState.instance.activeJobs.value.first
        : null);

/// Shown instead of a job when the route has none (stale link, hot restart).
class MissingJobScreen extends StatelessWidget {
  const MissingJobScreen({super.key});

  @override
  Widget build(BuildContext context) => StateScreen(
    title: 'Job not available',
    stateTitle: 'This job is no longer available',
    body: 'It may have been cancelled or completed, or the link is out of date. Open your jobs list to see the current schedule.',
    icon: LucideIcons.briefcase,
    cta: 'Back to my jobs',
    onCta: () => Navigator.of(context).pop(),
    showBack: false,
  );
}

class MyJobsTab extends StatefulWidget {
  const MyJobsTab({super.key});

  @override
  State<MyJobsTab> createState() => _MyJobsTabState();
}

class _MyJobsTabState extends State<MyJobsTab> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ListenableBuilder(
        listenable: Listenable.merge([
          AppState.instance.upcomingJobs,
          AppState.instance.activeJobs,
          AppState.instance.historyJobs,
        ]),
        builder: (context, _) {
          final upcoming = AppState.instance.upcomingJobs.value;
          final active = AppState.instance.activeJobs.value;
          final history = AppState.instance.historyJobs.value;

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(V.pad, 6, V.pad, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('My jobs', style: T.h1),
                gap20,
                ChipRow(
                  children: [
                    ServChip(
                      label: 'Upcoming (${upcoming.length})',
                      selected: _tab == 0,
                      onTap: () => setState(() => _tab = 0),
                    ),
                    ServChip(
                      label: 'Active (${active.length})',
                      selected: _tab == 1,
                      onTap: () => setState(() => _tab = 1),
                    ),
                    ServChip(
                      label: 'History (${history.length})',
                      selected: _tab == 2,
                      onTap: () => setState(() => _tab = 2),
                    ),
                  ],
                ),
                gap16,
                Text(
                  'Your next good day’s work.',
                  style: T.bodyMuted.copyWith(fontSize: 15),
                ),
                gap16,
                if (_tab == 0) ...[
                  if (upcoming.isEmpty)
                    const StateBlock(
                      icon: LucideIcons.calendarX,
                      title: 'No upcoming jobs',
                      body: 'Jobs you accept from customer requests will appear here.',
                    )
                  else
                    for (final job in upcoming) ...[_JobCard(job: job), gap14],
                ] else if (_tab == 1) ...[
                  if (active.isEmpty)
                    const StateBlock(
                      icon: LucideIcons.truck,
                      title: 'No active jobs right now',
                      body: 'Jobs move here when you start your journey to the job location.',
                    )
                  else
                    for (final job in active) ...[_JobCard(job: job), gap14],
                ] else ...[
                  if (history.isEmpty)
                    const StateBlock(
                      icon: LucideIcons.checkCircle2,
                      title: 'No completed jobs yet',
                      body: 'Jobs you finish and wrap up will show in your history.',
                    )
                  else
                    for (final job in history) ...[_JobCard(job: job), gap14],
                ],
                gap8,
                Text(
                  'Open a confirmed job for its address, contact details and arrival instructions.',
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

class _JobCard extends StatelessWidget {
  const _JobCard({required this.job});
  final Job job;

  @override
  Widget build(BuildContext context) {
    return ServCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      onTap: () {
        if (job.status == 'En Route' || job.status == 'Arrived') {
          go(context, EnRouteScreen(job: job));
        } else if (job.status == 'In progress' || job.status == 'In Progress') {
          go(context, JobUpdateScreen(job: job));
        } else if (job.status == 'Completed') {
          go(
            context,
            MateJobCompleteScreen(job: job, earnings: job.price.toDouble()),
          );
        } else if (job.status == 'Cancelled') {
          go(context, JobCancelledScreen(job: job));
        } else {
          go(context, ConfirmedJobScreen(job: job));
        }
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusBadge(
                job.status,
                tone: job.status == 'Completed'
                    ? BadgeTone.brand
                    : job.status == 'Cancelled'
                    ? BadgeTone.neutral
                    : BadgeTone.warning,
              ),
              const Spacer(),
              Text(
                formatPeso(job.price),
                style: T.label.copyWith(fontSize: 17, color: V.brand),
              ),
            ],
          ),
          gap12,
          Text(job.title, style: T.cardTitle.copyWith(fontSize: 17.5)),
          gap6,
          Text(
            '${job.customer} · Customer',
            style: T.bodyMuted.copyWith(fontSize: 15),
          ),
          gap8,
          Text(job.when, style: T.body.copyWith(fontSize: 15.5)),
          gap6,
          Text(
            '${job.area} · ${job.distance}',
            style: T.small.copyWith(fontSize: 14.5),
          ),
          gap12,
          Text('View job details', style: T.link),
        ],
      ),
    );
  }
}

class ConfirmedJobScreen extends StatelessWidget {
  const ConfirmedJobScreen({super.key, this.job});

  final Job? job;

  @override
  Widget build(BuildContext context) {
    final effectiveJob = _activeJobOrNull(job);
    if (effectiveJob == null) return const MissingJobScreen();

    return ScreenScaffold(
      title: 'Your confirmed job',
      bottom: CtaBar(
        label: 'Start journey',
        onPressed: () {
          AppState.instance.startJobJourney(effectiveJob);
          go(context, EnRouteScreen(job: effectiveJob));
        },
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Align(
            alignment: Alignment.centerLeft,
            child: StatusBadge('Accepted / confirmed'),
          ),
          gap12,
          Text(
            '${effectiveJob.title} · ${effectiveJob.customer}',
            style: T.label.copyWith(fontSize: 16.5),
          ),
          gap8,
          Text(
            '${effectiveJob.when} · ${formatPeso(effectiveJob.price)} earnings',
            style: T.bodyMuted.copyWith(fontSize: 15.5),
          ),
          gap16,
          const MapAddressCard(
            address: '12 Ayala Avenue, Bel-Air · Makati, Metro Manila 1209',
          ),
          gap14,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Arrival instructions',
                  style: T.label.copyWith(fontSize: 16),
                ),
                gap10,
                Text(
                  'Buzzer 2A. Desk and bookshelf boxes are in the living room. Street parking nearby.',
                  style: T.bodyMuted.copyWith(fontSize: 15.5),
                ),
              ],
            ),
          ),
          gap14,
          Text(
            'Contact · (718) 555-0166 · ${effectiveJob.customer}',
            style: T.body.copyWith(fontSize: 15),
          ),
          gap16,
          Row(
            children: [
              GestureDetector(
                onTap: () =>
                    go(context, RescheduleRequestedScreen(job: effectiveJob)),
                child: Text('Reschedule', style: T.link),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => go(context, JobCancelledScreen(job: effectiveJob)),
                child: Text('Cancel job', style: T.link),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Support requested'),
                      backgroundColor: V.brandDeep,
                    ),
                  );
                },
                child: Text('Get help', style: T.link),
              ),
            ],
          ),
          gap16,
          Row(
            children: [
              GestureDetector(
                onTap: () => go(
                  context,
                  ChatScreen(
                    name: effectiveJob.customer,
                    initials: effectiveJob.customer.isNotEmpty
                        ? effectiveJob.customer
                              .split(' ')
                              .map((p) => p.isNotEmpty ? p[0] : '')
                              .take(2)
                              .join()
                        : 'CU',
                    roleLabel: 'Customer',
                    service: effectiveJob.title,
                  ),
                ),
                child: Text(
                  'Message ${effectiveJob.customer.split(' ').first}',
                  style: T.link,
                ),
              ),
              Text('  ·  ', style: T.link),
              GestureDetector(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Calling ${effectiveJob.customer}'),
                      backgroundColor: V.brandDeep,
                    ),
                  );
                },
                child: Text(
                  'Call ${effectiveJob.customer.split(' ').first}',
                  style: T.link,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class EnRouteScreen extends StatefulWidget {
  const EnRouteScreen({super.key, this.job});

  final Job? job;

  @override
  State<EnRouteScreen> createState() => _EnRouteScreenState();
}

class _EnRouteScreenState extends State<EnRouteScreen> {
  int _stage = 1;

  static const _stages = [
    'Accepted',
    'En Route',
    'Arrived',
    'In Progress',
    'Completed',
  ];

  @override
  void initState() {
    super.initState();
    final st = widget.job?.status ?? 'En Route';
    final idx = _stages.indexWhere((s) => s.toLowerCase() == st.toLowerCase());
    if (idx != -1) _stage = idx;
  }

  void _onStageSelected(int idx) {
    setState(() => _stage = idx);
    final targetJob = _activeJobOrNull(widget.job);
    if (targetJob == null) return;
    AppState.instance.updateActiveJobStage(targetJob, _stages[idx]);
  }

  @override
  Widget build(BuildContext context) {
    final effectiveJob = _activeJobOrNull(widget.job);
    if (effectiveJob == null) return const MissingJobScreen();

    return ScreenScaffold(
      title: 'On your way',
      bottom: CtaBar(
        label: _stage < 2 ? 'Mark arrived' : 'Update job status',
        link: 'Message ${effectiveJob.customer.split(' ').first}',
        onLink: () => go(
          context,
          ChatScreen(
            name: effectiveJob.customer,
            initials: effectiveJob.customer.isNotEmpty
                ? effectiveJob.customer
                      .split(' ')
                      .map((p) => p.isNotEmpty ? p[0] : '')
                      .take(2)
                      .join()
                : 'CU',
            roleLabel: 'Customer',
            service: effectiveJob.title,
          ),
        ),
        onPressed: () {
          if (_stage < 2) {
            _onStageSelected(2);
          } else {
            go(context, JobUpdateScreen(job: effectiveJob));
          }
        },
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              StatusBadge('Active · ${_stages[_stage]}'),
              const Spacer(),
              Text('SM-1025-021', style: T.small),
            ],
          ),
          gap12,
          Text(
            '${effectiveJob.title} · ${effectiveJob.customer}',
            style: T.label.copyWith(fontSize: 16.5),
          ),
          gap8,
          Text(
            '${effectiveJob.when} · ${formatPeso(effectiveJob.price)} estimate',
            style: T.bodyMuted.copyWith(fontSize: 15.5),
          ),
          gap14,
          const MapPreview(height: 200),
          gap10,
          Text(
            'Illustrative map · sample pin, not live location',
            style: T.small,
          ),
          gap14,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '210 5th Ave, Apt 2A',
                  style: T.label.copyWith(fontSize: 16.5),
                ),
                gap8,
                Text(
                  effectiveJob.address.isEmpty
                      ? 'Address shared after acceptance'
                      : effectiveJob.address,
                  style: T.bodyMuted.copyWith(fontSize: 15),
                ),
                gap10,
                Text('View directions', style: T.link),
                gap10,
                Text(
                  'Accepted job only · Sample map, not live tracking.',
                  style: T.small,
                ),
              ],
            ),
          ),
          gap16,
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (var i = 0; i < _stages.length; i++)
                ServChip(
                  label: _stages[i],
                  selected: _stage == i,
                  height: 44,
                  onTap: () => _onStageSelected(i),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class JobUpdateScreen extends StatelessWidget {
  const JobUpdateScreen({super.key, this.job});

  final Job? job;

  @override
  Widget build(BuildContext context) {
    final effectiveJob = _activeJobOrNull(job);
    if (effectiveJob == null) return const MissingJobScreen();

    return ScreenScaffold(
      title: 'Keep ${effectiveJob.customer.split(' ').first} up to date',
      bottom: CtaBar(
        label: 'Finish work & review',
        link:
            'Message ${effectiveJob.customer.split(' ').first}  ·  Report an issue',
        onLink: () => go(
          context,
          ChatScreen(
            name: effectiveJob.customer,
            initials: effectiveJob.customer.isNotEmpty
                ? effectiveJob.customer
                      .split(' ')
                      .map((p) => p.isNotEmpty ? p[0] : '')
                      .take(2)
                      .join()
                : 'CU',
            roleLabel: 'Customer',
            service: effectiveJob.title,
          ),
        ),
        onPressed: () => go(context, WrapUpScreen(job: effectiveJob)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _JobSummaryCard(job: effectiveJob),
          gap16,
          const StatusSteps(
            steps: [
              'Accepted',
              'En Route',
              'Arrived',
              'In Progress',
              'Completed',
            ],
            current: 3,
          ),
          gap16,
          InfoBanner(
            icon: LucideIcons.wrench,
            title: 'In progress · Work started',
            body: 'Assemble the task with care, check stability, and tidy the workspace before completing.',
          ),
          gap14,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Need to stop the job?',
                  style: T.label.copyWith(fontSize: 16),
                ),
                gap10,
                Text(
                  'If you can’t continue, contact ${effectiveJob.customer.split(' ').first} and review the cancellation policy before cancelling.',
                  style: T.bodyMuted.copyWith(fontSize: 15),
                ),
                gap10,
                GestureDetector(
                  onTap: () =>
                      go(context, JobCancelledScreen(job: effectiveJob)),
                  child: Text('Cancel job → Cancelled state', style: T.link),
                ),
              ],
            ),
          ),
          gap14,
          Text(
            'Progress is updated manually. No live location is shared.',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

class WrapUpScreen extends StatefulWidget {
  const WrapUpScreen({super.key, this.job});

  final Job? job;

  @override
  State<WrapUpScreen> createState() => _WrapUpScreenState();
}

class _WrapUpScreenState extends State<WrapUpScreen> {
  late final TextEditingController _workSummary;
  late final TextEditingController _timeWorked;

  @override
  void initState() {
    super.initState();
    _workSummary = TextEditingController(
      text:
          'Completed ${widget.job?.title ?? 'the service'}, checked stability, and tidied all packaging.',
    );
    _timeWorked = TextEditingController(text: '2 hours · 9:00–11:00 AM');
  }

  @override
  void dispose() {
    _workSummary.dispose();
    _timeWorked.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final effectiveJob = _activeJobOrNull(widget.job);
    if (effectiveJob == null) return const MissingJobScreen();
    final earnings = effectiveJob.price > 0
        ? effectiveJob.price.toDouble()
        : 90.0;

    return ScreenScaffold(
      title: 'Wrap up the job',
      bottom: CtaBar(
        label: 'Mark job completed',
        link: 'Back to job',
        onLink: () => Navigator.of(context).pop(),
        onPressed: () {
          AppState.instance.completeJob(effectiveJob, earnings: earnings);
          go(
            context,
            MateJobCompleteScreen(job: effectiveJob, earnings: earnings),
          );
        },
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${effectiveJob.title} · ${effectiveJob.customer}',
                  style: T.label.copyWith(fontSize: 16),
                ),
                gap8,
                Text(
                  '${effectiveJob.when} · ${formatPeso(effectiveJob.price)} estimate',
                  style: T.bodyMuted.copyWith(fontSize: 15),
                ),
              ],
            ),
          ),
          gap18,
          const FieldLabel('Work summary'),
          ServTextField(controller: _workSummary, maxLines: 3),
          gap16,
          const FieldLabel('Time worked'),
          ServTextField(controller: _timeWorked),
          gap16,
          Container(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
            decoration: BoxDecoration(
              color: V.tint,
              borderRadius: BorderRadius.circular(V.cardRadius),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Text(
                      effectiveJob.when,
                      style: T.body.copyWith(fontSize: 15.5),
                    ),
                    const Spacer(),
                    Text(
                      formatPeso(earnings),
                      style: T.body.copyWith(fontSize: 15.5),
                    ),
                  ],
                ),
                const Divider(height: 24),
                Text(
                  'Estimated provider earnings. The customer’s service fee is separate.',
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
              border: Border.all(color: V.brand),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(LucideIcons.checkCircle2, size: 24, color: V.brand),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Work is complete',
                        style: T.label.copyWith(fontSize: 16),
                      ),
                      gap6,
                      Text(
                        'I’ve checked the work with ${effectiveJob.customer.split(' ').first} and left the space tidy.',
                        style: T.small.copyWith(fontSize: 14.5, height: 1.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          gap14,
          const InfoBanner(
            title: 'Job completion',
            body: 'This moves the job into your history and credits your balance.',
          ),
        ],
      ),
    );
  }
}

class MateJobCompleteScreen extends StatelessWidget {
  const MateJobCompleteScreen({super.key, this.job, this.earnings = 90.0});

  final Job? job;
  final double earnings;

  @override
  Widget build(BuildContext context) {
    final effectiveJob = _activeJobOrNull(job);
    if (effectiveJob == null) return const MissingJobScreen();

    return ScreenScaffold(
      title: 'Job completed',
      bottom: CtaBar(
        label: 'Back to dashboard',
        onPressed: () => Session.openTab(context, 0),
      ),
      padding: const EdgeInsets.fromLTRB(V.pad, 16, V.pad, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: V.tint,
                borderRadius: BorderRadius.circular(26),
              ),
              child: const Icon(LucideIcons.check, size: 34, color: V.brand),
            ),
          ),
          gap20,
          Text('Nice work, Alex.', textAlign: TextAlign.center, style: T.h2),
          gap12,
          Text(
            '${effectiveJob.customer} has been notified and your earnings are credited.',
            textAlign: TextAlign.center,
            style: T.bodyMuted,
          ),
          gap20,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const StatusBadge('Completed'),
                gap12,
                Row(
                  children: [
                    Avatar(
                      '',
                      size: 54,
                      initials: effectiveJob.customer.trim().isEmpty
                          ? 'C'
                          : effectiveJob.customer
                                .trim()
                                .split(RegExp(r'\s+'))
                                .take(2)
                                .map((word) => word[0])
                                .join()
                                .toUpperCase(),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            effectiveJob.customer,
                            style: T.cardTitle.copyWith(fontSize: 18),
                          ),
                          gap4,
                          Text(
                            'Customer · ${effectiveJob.title}',
                            style: T.small,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                gap12,
                Text(
                  effectiveJob.when,
                  style: T.small.copyWith(fontSize: 14.5),
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
            child: Row(
              children: [
                Text('For this job', style: T.body.copyWith(fontSize: 15.5)),
                const Spacer(),
                Text(
                  formatPeso(earnings),
                  style: T.h3.copyWith(color: V.brandDeep),
                ),
              ],
            ),
          ),
          gap14,
          Text(
            'Earnings update when the customer confirms the job.',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

class JobCancelledScreen extends StatelessWidget {
  const JobCancelledScreen({super.key, this.job});

  final Job? job;

  @override
  Widget build(BuildContext context) {
    final effectiveJob = _activeJobOrNull(job);
    if (effectiveJob == null) return const MissingJobScreen();

    return ScreenScaffold(
      title: 'Job cancelled',
      bottom: CtaBar(
        label: 'Back to my jobs',
        onPressed: () {
          AppState.instance.cancelJob(effectiveJob);
          Session.openTab(context, 2);
        },
      ),
      padding: const EdgeInsets.fromLTRB(V.pad, 16, V.pad, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: V.tint,
                borderRadius: BorderRadius.circular(26),
              ),
              child: const Icon(
                LucideIcons.calendarX,
                size: 32,
                color: V.brand,
              ),
            ),
          ),
          gap20,
          Text('Plans changed.', textAlign: TextAlign.center, style: T.h2),
          gap12,
          Text(
            '${effectiveJob.customer} cancelled the ${effectiveJob.title.toLowerCase()} booking. This time is available again.',
            textAlign: TextAlign.center,
            style: T.bodyMuted,
          ),
          gap20,
          const Align(
            alignment: Alignment.centerLeft,
            child: StatusBadge('Cancelled', tone: BadgeTone.neutral),
          ),
          gap12,
          _JobSummaryCard(job: effectiveJob),
          gap14,
          ServCard(
            child: Column(
              children: [
                KeyValueRow(
                  label: 'Reason',
                  value: 'Plans changed',
                  valueStyle: T.body.copyWith(color: V.brand),
                ),
                const Divider(height: 1),
                KeyValueRow(label: 'Cancellation fee', value: formatPeso(0)),
                const Divider(height: 1),
                KeyValueRow(
                  label: 'Earnings for this job',
                  value: formatPeso(0),
                ),
              ],
            ),
          ),
          gap14,
          Text(
            'No payment was processed. This cancelled job remains in your history.',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

class RescheduleRequestedScreen extends StatelessWidget {
  const RescheduleRequestedScreen({super.key, this.job});

  final Job? job;

  @override
  Widget build(BuildContext context) {
    final effectiveJob = _activeJobOrNull(job);
    if (effectiveJob == null) return const MissingJobScreen();

    return ScreenScaffold(
      title: 'A new time requested',
      bottom: CtaBar(
        label: 'Accept new time',
        link:
            'Keep original time & message ${effectiveJob.customer.split(' ').first}',
        onLink: () => go(
          context,
          ChatScreen(
            name: effectiveJob.customer,
            initials: effectiveJob.customer.isNotEmpty
                ? effectiveJob.customer
                      .split(' ')
                      .map((p) => p.isNotEmpty ? p[0] : '')
                      .take(2)
                      .join()
                : 'CU',
            roleLabel: 'Customer',
            service: effectiveJob.title,
          ),
        ),
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('New time accepted!'),
              backgroundColor: V.brandDeep,
            ),
          );
          Session.openTab(context, 2);
        },
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Align(
            alignment: Alignment.centerLeft,
            child: StatusBadge('Reschedule requested', tone: BadgeTone.warning),
          ),
          gap12,
          Text(
            '${effectiveJob.title} · ${effectiveJob.customer}',
            style: T.label.copyWith(fontSize: 16.5),
          ),
          gap14,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Original time · Still confirmed',
                  style: T.bodyMuted.copyWith(fontSize: 15),
                ),
                gap8,
                Text(effectiveJob.when, style: T.body.copyWith(fontSize: 15.5)),
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
                Text('Requested time', style: T.small.copyWith(fontSize: 15)),
                gap8,
                Text('Mon, Oct 26, 2026', style: T.h3),
                gap6,
                Text(
                  '11 AM–1 PM · 2 hours',
                  style: T.body.copyWith(fontSize: 15.5),
                ),
              ],
            ),
          ),
          gap14,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${effectiveJob.customer.split(' ').first}’s note',
                  style: T.label.copyWith(fontSize: 16),
                ),
                gap10,
                Text(
                  '“Something came up on Sunday. Could we move to Monday at 11? Thank you!”',
                  style: T.bodyMuted.copyWith(fontSize: 15.5),
                ),
              ],
            ),
          ),
          gap14,
          InfoBanner(
            title: 'Same work, same estimate',
            body:
                '${formatPeso(effectiveJob.price)} estimated earnings. The original time stays confirmed until you accept the change.',
          ),
          gap14,
          Text(
            'Your availability is open at the requested time.',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

class JobProgressScreen extends StatelessWidget {
  const JobProgressScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ShellScreen(
      title: 'Job progress states',
      navIndex: 2,
      items: mateNav,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ValueListenableBuilder<List<Job>>(
            valueListenable: AppState.instance.activeJobs,
            builder: (context, jobs, _) => Text(
              jobs.isEmpty
                  ? 'No active job right now'
                  : '${jobs.first.docId} · ${jobs.first.customer} · ${jobs.first.title}',
              style: T.small.copyWith(fontSize: 14.5),
            ),
          ),
          gap14,
          ServCard(
            child: StatusSteps(
              steps: const [
                'Accepted · Schedule confirmed',
                'En Route · Journey started',
                'Arrived · At confirmed address',
                'In Progress · Working on task',
                'Completed · Work summary sent',
              ],
              current: 3,
            ),
          ),
          gap14,
          const InfoBanner(
            title: 'Manual status updates',
            body: 'Use Start journey → Mark arrived → Start work → Finish work. The customer sees these updates; no location tracking is used.',
          ),
          gap14,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const StatusBadge('Cancelled', tone: BadgeTone.neutral),
                gap10,
                Text(
                  'Alternate terminal state. Notify the customer and keep the cancellation in job history.',
                  style: T.bodyMuted.copyWith(fontSize: 15),
                ),
              ],
            ),
          ),
          gap14,
          Text(
            'All six stages use the same status language in job details, notifications and earnings.',
            style: T.bodyMuted.copyWith(fontSize: 15),
          ),
        ],
      ),
    );
  }
}

class _JobSummaryCard extends StatelessWidget {
  const _JobSummaryCard({this.job});

  final Job? job;

  @override
  Widget build(BuildContext context) {
    final effectiveJob = _activeJobOrNull(job);
    if (effectiveJob == null) return const MissingJobScreen();

    return ServCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Photo(
                effectiveJob.asset.isNotEmpty ? effectiveJob.asset : '',
                width: 62,
                height: 62,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      effectiveJob.title,
                      style: T.cardTitle.copyWith(fontSize: 18),
                    ),
                    gap4,
                    Text(
                      '${effectiveJob.customer} · Customer',
                      style: T.bodyMuted.copyWith(fontSize: 15),
                    ),
                  ],
                ),
              ),
            ],
          ),
          gap14,
          Text(effectiveJob.when, style: T.body.copyWith(fontSize: 15.5)),
          gap8,
          Text(
            '${formatPeso(effectiveJob.price)} estimate',
            style: T.bodyMuted.copyWith(fontSize: 15),
          ),
        ],
      ),
    );
  }
}
