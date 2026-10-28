import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import 'help.dart';
import 'profile.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    return ShellScreen(
      title: 'Settings',
      navIndex: 4,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Preferences', style: T.section),
          gap12,
          ServCard(
            child: Column(
              children: [
                ValueListenableBuilder<bool>(
                  valueListenable: AppState.instance.bookingNotifications,
                  builder: (context, v, _) => _SwitchRow(
                    title: 'Booking notifications',
                    subtitle: 'Confirmations and schedule updates',
                    value: v,
                    onChanged: (val) =>
                        AppState.instance.bookingNotifications.value = val,
                  ),
                ),
                gap18,
                ValueListenableBuilder<bool>(
                  valueListenable: AppState.instance.messageAlerts,
                  builder: (context, v, _) => _SwitchRow(
                    title: 'Message alerts',
                    value: v,
                    onChanged: (val) =>
                        AppState.instance.messageAlerts.value = val,
                  ),
                ),
                gap18,
                ValueListenableBuilder<bool>(
                  valueListenable: AppState.instance.recommendations,
                  builder: (context, v, _) => _SwitchRow(
                    title: 'Helpful recommendations',
                    value: v,
                    onChanged: (val) =>
                        AppState.instance.recommendations.value = val,
                  ),
                ),
              ],
            ),
          ),
          gap14,
          ServCard(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Text('Language', style: T.body),
                      const Spacer(),
                      Text(
                        'English',
                        style: T.body.copyWith(color: V.brand, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 24),
                SettingsRows(
                  rows: [
                    (LucideIcons.lock, 'Privacy & data', () {}),
                    (LucideIcons.shieldCheck, 'Account security', () {}),
                    (LucideIcons.helpCircle, 'Help & support',
                        () => go(context, const HelpScreen())),
                  ],
                ),
              ],
            ),
          ),
          gap16,
          const InfoBanner(
            icon: LucideIcons.arrowLeftRight,
            title: 'Customer mode',
            body:
                'Switch to ServMate from your profile to manage services and jobs.',
          ),
          gap16,
          Row(
            children: [
              GestureDetector(
                onTap: () => Session.signOut(context),
                child: Text('Log out', style: T.link),
              ),
              const Spacer(),
              Text('ServEm · v1.0 · Philippines', style: T.small),
            ],
          ),
        ],
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    required this.title,
    required this.value,
    required this.onChanged,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: T.body.copyWith(fontSize: 16)),
              if (subtitle != null) ...[
                gap4,
                Text(subtitle!, style: T.small.copyWith(fontSize: 14.5)),
              ],
            ],
          ),
        ),
        const SizedBox(width: 12),
        Switch(value: value, onChanged: onChanged),
      ],
    );
  }
}
