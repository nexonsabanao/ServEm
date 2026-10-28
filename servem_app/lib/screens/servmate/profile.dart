import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import '../account/help.dart';
import '../account/profile.dart';
import '../account/notifications.dart';
import '../account/personal_info.dart';
import 'reviews.dart';
import 'services.dart';
import 'setup.dart';

class MateProfileTab extends StatefulWidget {
  const MateProfileTab({super.key});

  @override
  State<MateProfileTab> createState() => _MateProfileTabState();
}

class _MateProfileTabState extends State<MateProfileTab> {
  bool _alerts = true;

  @override
  Widget build(BuildContext context) {
    final profile = AppState.instance.userProfile.value;
    return SafeArea(
      bottom: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(V.pad, 6, V.pad, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Your ServMate account', style: T.h1),
            gap20,
            Row(
              children: [
                Avatar(
                  AppState.instance.userProfile.value.avatar,
                  size: 84,
                  initials: AppState.instance.userProfile.value.name.isEmpty
                      ? 'S'
                      : AppState.instance.userProfile.value.name[0]
                            .toUpperCase(),
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile.name.isEmpty
                            ? 'Your ServMate account'
                            : profile.name,
                        style: T.h3.copyWith(fontSize: 25),
                      ),
                      gap6,
                      Text(
                        profile.email.isEmpty ? 'Email not set' : profile.email,
                        style: T.bodyMuted.copyWith(fontSize: 15),
                      ),
                      gap8,
                      const StatusBadge('ServMate profile'),
                    ],
                  ),
                ),
              ],
            ),
            gap20,
            ListenableBuilder(
              listenable: Listenable.merge([
                AppState.instance.availableBalance,
                AppState.instance.reviews,
              ]),
              builder: (context, _) {
                final balance = AppState.instance.availableBalance.value;
                final reviewsMap = AppState.instance.reviews.value;
                final mateReviews =
                    reviewsMap[profile.name] ?? const <ReviewRecord>[];
                final avg = mateReviews.isNotEmpty
                    ? (mateReviews
                                  .map((r) => r.rating)
                                  .reduce((a, b) => a + b) /
                              mateReviews.length)
                          .toStringAsFixed(1)
                    : '—';

                return Row(
                  children: [
                    Expanded(
                      child: _MiniStat(value: avg, label: 'Average rating'),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MiniStat(
                        value: formatPeso(balance),
                        label: 'Available balance',
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => go(context, const MateReviewsScreen()),
                        child: _MiniStat(
                          value: '${mateReviews.length}',
                          label: 'Reviews',
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
            gap20,
            SettingsRows(
              rows: [
                (
                  LucideIcons.user2,
                  'Edit public profile',
                  () => go(context, const PublicProfileScreen()),
                ),
                (
                  LucideIcons.wrench,
                  'Manage services',
                  () => go(context, const EditServiceScreen()),
                ),
                (
                  LucideIcons.clock,
                  'Working hours',
                  () => go(context, const WorkingHoursScreen()),
                ),
                (
                  LucideIcons.mapPin,
                  'Availability & service area',
                  () => go(context, const MateServiceAreaScreen()),
                ),
                (
                  LucideIcons.clipboardCheck,
                  'Verification',
                  () => go(context, const VerificationScreen()),
                ),
                (
                  LucideIcons.mail,
                  'Customer messages',
                  () => go(context, const NotificationsScreen()),
                ),
              ],
            ),
            gap6,
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Jobs & message alerts',
                          style: T.body.copyWith(fontSize: 16),
                        ),
                        gap4,
                        Text(
                          'Notifications while you’re working',
                          style: T.small.copyWith(fontSize: 14.5),
                        ),
                      ],
                    ),
                  ),
                  Switch(
                    value: _alerts,
                    onChanged: (v) => setState(() => _alerts = v),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            SettingsRows(
              rows: [
                (
                  LucideIcons.shieldCheck,
                  'Privacy & account security',
                  () => go(context, const PersonalInfoScreen()),
                ),
                (
                  LucideIcons.helpCircle,
                  'Help & support',
                  () => go(context, const HelpScreen()),
                ),
              ],
            ),
            gap20,
            Material(
              color: V.tint,
              borderRadius: BorderRadius.circular(V.cardRadius),
              child: InkWell(
                borderRadius: BorderRadius.circular(V.cardRadius),
                onTap: () => Session.switchRole(AppRole.customer, context),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 18, 18),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'You’re in ServMate mode',
                              style: T.cardTitle.copyWith(color: V.brandDeep),
                            ),
                            gap8,
                            Text(
                              'Switch to customer mode',
                              style: T.body.copyWith(fontSize: 15.5),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        LucideIcons.arrowLeftRight,
                        size: 24,
                        color: V.brand,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            gap20,
            Row(
              children: [
                GestureDetector(
                  onTap: () => Session.signOut(context),
                  child: Text('Log out', style: T.link),
                ),
                const Spacer(),
                Text('ServEm · v1.0', style: T.small),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: V.tint,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: T.h3.copyWith(fontSize: 22, color: V.brandDeep),
            ),
          ),
          gap4,
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(label, style: T.micro.copyWith(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
