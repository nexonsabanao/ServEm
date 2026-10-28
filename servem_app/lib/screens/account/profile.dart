import 'package:flutter/material.dart';

import '../auth/confirm_email.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/payment_icons.dart';
import '../../design/theme.dart';
import 'help.dart';
import 'notifications.dart';
import 'settings.dart';
import 'personal_info.dart';
import 'saved_places.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(V.pad, 6, V.pad, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Your profile', style: T.h1),
            gap20,
            ValueListenableBuilder<UserProfile>(
              valueListenable: AppState.instance.userProfile,
              builder: (context, user, _) {
                return Row(
                  children: [
                    Avatar(user.avatar, size: 84),
                    const SizedBox(width: 18),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user.name, style: T.h3.copyWith(fontSize: 25)),
                          gap6,
                          Text(user.email, style: T.bodyMuted.copyWith(fontSize: 15)),
                          gap4,
                          Text('Member since ${user.memberSince}',
                              style: T.micro.copyWith(fontSize: 13.5)),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
            gap24,
            Material(
              color: V.tint,
              borderRadius: BorderRadius.circular(V.cardRadius),
              child: InkWell(
                borderRadius: BorderRadius.circular(V.cardRadius),
                onTap: () => Session.switchRole(AppRole.servmate, context),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 18, 20),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'You’re in customer mode',
                              style: T.cardTitle.copyWith(color: V.brandDeep),
                            ),
                            gap8,
                            Text(
                              'Switch to ServMate',
                              style: T.body.copyWith(fontSize: 15.5),
                            ),
                          ],
                        ),
                      ),
                      const Icon(LucideIcons.arrowLeftRight, size: 24, color: V.brand),
                    ],
                  ),
                ),
              ),
            ),
            gap24,
            ValueListenableBuilder<bool>(
              valueListenable: AppState.instance.emailVerified,
              builder: (context, verified, _) => SettingsRows(
                rows: [
                  if (!verified)
                    (
                      LucideIcons.mailCheck,
                      'Confirm your email',
                      () => go(context, const ConfirmEmailScreen()),
                    ),
                  (
                    LucideIcons.user2,
                    'Personal information',
                    () => go(context, const PersonalInfoScreen()),
                  ),
                  (
                    LucideIcons.mapPin,
                    'Addresses',
                    () => go(context, const SavedPlacesScreen()),
                  ),
                  (LucideIcons.creditCard, 'Payments', () => _showPayments(context)),
                  (
                    LucideIcons.bell,
                    'Notifications',
                    () => go(context, const NotificationsScreen()),
                  ),
                  (
                    LucideIcons.settings,
                    'Settings',
                    () => go(context, const SettingsScreen()),
                  ),
                  (
                    LucideIcons.helpCircle,
                    'Help & support',
                    () => go(context, const HelpScreen()),
                  ),
                ],
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

  void _showPayments(BuildContext context) {
    showServEmSheet<void>(
      context,
      Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Payment methods', style: T.h3),
          gap16,
          const InfoBanner(
            icon: LucideIcons.wallet,
            title: 'GCash · Maya · bank transfer',
            body:
                'Pay through your wallet or online banking, or settle in cash '
                'with your ServMate once the job is done.',
          ),
          gap18,
          const Center(child: PaymentRailRow(height: 34)),
          gap18,
          SecondaryButton(
            label: 'Close',
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }
}

/// Divider-separated list of navigation rows.
class SettingsRows extends StatelessWidget {
  const SettingsRows({super.key, required this.rows});
  final List<(IconData, String, VoidCallback)> rows;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const Divider(height: 1),
          NavRow(
            icon: rows[i].$1,
            title: rows[i].$2,
            onTap: rows[i].$3,
            padding: const EdgeInsets.symmetric(vertical: 18),
          ),
        ],
      ],
    );
  }
}
