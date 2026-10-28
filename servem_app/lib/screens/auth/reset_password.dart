import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../../firebase/firebase_auth_service.dart';
import 'login.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  late final TextEditingController _email;
  bool _sending = false;
  String? _emailError;
  String? _sentTo;

  @override
  void initState() {
    super.initState();
    _email = TextEditingController(text: AppState.instance.userProfile.value.email);
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final address = _email.text.trim();
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(address)) {
      setState(() => _emailError = 'Enter the email address on your account.');
      return;
    }
    setState(() {
      _emailError = null;
      _sending = true;
    });
    final problem = await FirebaseAuthService.resetPassword(address);
    if (!mounted) return;
    setState(() => _sending = false);
    if (problem != null) {
      setState(() => _emailError = problem);
      return;
    }
    setState(() => _sentTo = address);
  }

  @override
  Widget build(BuildContext context) {
    final sent = _sentTo;
    if (sent != null) {
      return ScreenScaffold(
        title: 'Reset your password',
        bottom: CtaBar(
          label: 'Back to login',
          onPressed: () => go(context, const LoginScreen()),
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
                child: const Icon(
                  LucideIcons.mailCheck,
                  size: 32,
                  color: V.brand,
                ),
              ),
            ),
            gap20,
            Text('Check your inbox.', textAlign: TextAlign.center, style: T.h2),
            gap12,
            Text(
              'We’ve sent a reset link to $sent.',
              textAlign: TextAlign.center,
              style: T.bodyMuted,
            ),
            gap24,
            Align(
              alignment: Alignment.centerLeft,
              child: StatusBadge('Sent to $sent'),
            ),
            gap16,
            Text(
              'The link expires in 30 minutes. If it doesn’t arrive, check your '
              'spam folder or send it again.',
              style: T.bodyMuted,
            ),
            gap18,
            GestureDetector(
              onTap: () => setState(() => _sentTo = null),
              behavior: HitTestBehavior.opaque,
              child: Text('Send it again', style: T.link),
            ),
          ],
        ),
      );
    }

    return ScreenScaffold(
      title: 'Reset your password',
      bottom: CtaBar(
        label: _sending ? 'Sending…' : 'Send reset link',
        link: 'Back to login',
        onLink: () => go(context, const LoginScreen()),
        onPressed: _sending ? null : _send,
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
              child: const Icon(LucideIcons.mail, size: 32, color: V.brand),
            ),
          ),
          gap20,
          Text(
            'Let’s get you back in.',
            textAlign: TextAlign.center,
            style: T.h2,
          ),
          gap12,
          Text(
            'Enter your email and we’ll send you a link to choose a new password.',
            textAlign: TextAlign.center,
            style: T.bodyMuted,
          ),
          gap24,
          const FieldLabel('Email address'),
          ServTextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            error: _emailError,
            onChanged: (_) {
              if (_emailError != null) setState(() => _emailError = null);
            },
          ),
          gap20,
          const InfoBanner(
            title: 'Check your inbox',
            body:
                'The reset link is valid for 30 minutes. Check your spam folder if it doesn’t arrive.',
          ),
        ],
      ),
    );
  }
}
