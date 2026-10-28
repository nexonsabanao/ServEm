import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../firebase/firebase_auth_service.dart';
import '../../design/theme.dart';
import 'role_select.dart';

class ConfirmEmailScreen extends StatefulWidget {
  const ConfirmEmailScreen({super.key});

  @override
  State<ConfirmEmailScreen> createState() => _ConfirmEmailScreenState();
}

class _ConfirmEmailScreenState extends State<ConfirmEmailScreen> {
  bool _busy = false;
  String? _notice;

  Future<void> _resend() async {
    setState(() {
      _busy = true;
      _notice = null;
    });
    final problem = await FirebaseAuthService.resendVerificationEmail();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _notice = problem ?? 'Verification email sent. Check your inbox.';
    });
  }

  Future<void> _confirm() async {
    setState(() {
      _busy = true;
      _notice = null;
    });
    final verified = await FirebaseAuthService.isEmailVerifiedNow();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _notice = verified
          ? 'Email confirmed.'
          : 'That address is not confirmed yet. Open the link we emailed you, then try again.';
    });
    if (verified) {
      AppState.instance.emailVerified.value = true;
      go(context, const RoleSelectScreen());
    }
  }

  @override
  Widget build(BuildContext context) {
    final email = AppState.instance.userProfile.value.email;
    return ScreenScaffold(
      title: 'Confirm your email',
      bottom: CtaBar(
        label: _busy ? 'Checking…' : 'I have confirmed it',
        link: _busy ? null : 'Resend verification email',
        onLink: _busy ? null : _resend,
        onPressed: _busy ? null : _confirm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          gap8,
          Center(
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: V.tint,
                borderRadius: BorderRadius.circular(26),
              ),
              child: const Icon(LucideIcons.mailCheck, size: 32, color: V.brand),
            ),
          ),
          gap20,
          Text('One small step.', textAlign: TextAlign.center, style: T.h2),
          gap12,
          Text(
            email.isEmpty
                ? 'Open the confirmation link we emailed you, then come back here.'
                : 'Open the confirmation link we sent to $email, then come back here.',
            textAlign: TextAlign.center,
            style: T.bodyMuted,
          ),
          gap24,
          Text(
            'Confirmation protects your bookings: it proves the address on the account belongs to you.',
            style: T.bodyMuted,
          ),
          if (_notice != null) ...[
            gap16,
            Align(alignment: Alignment.centerLeft, child: StatusBadge(_notice!)),
          ],
          gap18,
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            behavior: HitTestBehavior.opaque,
            child: Text('Change email address', style: T.link),
          ),
        ],
      ),
    );
  }
}
