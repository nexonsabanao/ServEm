import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';

class RoleSelectScreen extends StatefulWidget {
  const RoleSelectScreen({super.key});

  @override
  State<RoleSelectScreen> createState() => _RoleSelectScreenState();
}

class _RoleSelectScreenState extends State<RoleSelectScreen> {
  AppRole _role = AppRole.customer;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'How can we help?',
      bottom: CtaBar(
        label: _role == AppRole.customer
            ? 'Continue as customer'
            : 'Continue as a ServMate',
        onPressed: () => Session.enter(_role, context),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const ServEmLogo(size: 44),
          gap32,
          Text('Find help. Or lend a\nhand.', style: T.display),
          gap14,
          Text(
            'Choose how you’d like to start. You can switch roles in your profile anytime.',
            style: T.bodyMuted,
          ),
          gap28,
          _RoleCard(
            icon: LucideIcons.user2,
            title: 'I’m a customer',
            body: 'Find trusted local help for everyday tasks.',
            selected: _role == AppRole.customer,
            onTap: () => setState(() => _role = AppRole.customer),
          ),
          gap14,
          _RoleCard(
            icon: LucideIcons.briefcase,
            title: 'I’m a ServMate',
            body: 'Share your skills and earn on your schedule.',
            selected: _role == AppRole.servmate,
            onTap: () => setState(() => _role = AppRole.servmate),
          ),
          gap20,
          const InfoBanner(
            title: 'One account, two ways to use ServEm',
            body:
                'Booking help and ServMate jobs stay separate, and you can switch anytime.',
          ),
        ],
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.icon,
    required this.title,
    required this.body,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String body;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(V.cardRadius),
      side: BorderSide(color: selected ? V.brand : V.line),
    );
    return Material(
      color: selected ? V.tint : V.surface,
      shape: shape,
      child: InkWell(
        borderRadius: BorderRadius.circular(V.cardRadius),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Icon(
                  icon,
                  size: 24,
                  color: V.brand,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: T.cardTitle.copyWith(fontSize: 18)),
                    gap6,
                    Text(body, style: T.small.copyWith(fontSize: 15)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
