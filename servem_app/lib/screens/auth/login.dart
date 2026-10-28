import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../../firebase/firebase_auth_service.dart';
import 'auth_common.dart';
import 'create_account.dart';
import 'reset_password.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  String? _emailError;
  String? _passwordError;
  bool _acceptedTerms = false;
  String? _termsError;
  bool _busy = false;
  bool _revealPassword = false;

  @override
  void initState() {
    super.initState();
    _emailFocus.addListener(_validateEmail);
    _passwordFocus.addListener(_validatePassword);
  }

  @override
  void dispose() {
    _emailFocus
      ..removeListener(_validateEmail)
      ..dispose();
    _passwordFocus
      ..removeListener(_validatePassword)
      ..dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _validateEmail() {
    if (_emailFocus.hasFocus) return;
    setState(() => _emailError = _emailErrorFor(_email.text));
  }

  void _validatePassword() {
    if (_passwordFocus.hasFocus) return;
    setState(() => _passwordError = _password.text.isEmpty ? 'Enter your password.' : null);
  }

  String? _emailErrorFor(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return 'Enter your email address.';
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$').hasMatch(trimmed)) {
      return 'That email address does not look right.';
    }
    return null;
  }

  bool _validateAll() {
    final emailError = _emailErrorFor(_email.text);
    final passwordError =
        _password.text.isEmpty ? 'Enter your password.' : null;
    final termsError = _acceptedTerms ? null : _termsAcknowledgementRequired;
    setState(() {
      _emailError = emailError;
      _passwordError = passwordError;
      _termsError = termsError;
    });
    return emailError == null && passwordError == null && termsError == null;
  }

  static const _termsAcknowledgementRequired =
      'Please accept the Terms of Service and Privacy Policy to continue.';

  Future<void> _signIn() async {
    if (_busy) return;
    if (!_validateAll()) return;
    setState(() => _busy = true);
    final error = await FirebaseAuthService.signIn(_email.text, _password.text);
    if (!mounted) return;
    setState(() => _busy = false);
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
      return;
    }
    // The root gate reacts to FirebaseAuth.authStateChanges(); nothing to push.
  }

  Future<void> _signInWithGoogle() async {
    if (_busy) return;
    if (!_acceptedTerms) {
      setState(() => _termsError = _termsAcknowledgementRequired);
      return;
    }
    setState(() => _busy = true);
    final error = await FirebaseAuthService.signInWithGoogle();
    if (!mounted) return;
    setState(() => _busy = false);
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Welcome back',
      showBack: false,
      bottom: CtaBar(
        label: _busy ? 'Signing in…' : 'Log in',
        link: 'New to ServEm? Create an account',
        onLink: () => go(context, const CreateAccountScreen()),
        onPressed: _busy ? null : _signIn,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const ServEmLogo(size: 44),
          gap24,
          const FieldLabel('Email address'),
          ServTextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            textCapitalization: TextCapitalization.none,
            autofillHints: const [AutofillHints.email],
            semanticsLabel: 'Email address',
            error: _emailError,
            onBlur: _validateEmail,
            onChanged: (_) {
              if (_emailError != null) setState(() => _emailError = null);
            },
          ),
          gap18,
          FieldLabel(
            'Password',
            trailing: GestureDetector(
              onTap: () => go(context, const ResetPasswordScreen()),
              behavior: HitTestBehavior.opaque,
              child: Text('Forgot password?', style: T.link),
            ),
          ),
          ServTextField(
            controller: _password,
            obscure: !_revealPassword,
            keyboardType: TextInputType.visiblePassword,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
            semanticsLabel: 'Password',
            error: _passwordError,
            onBlur: _validatePassword,
            suffixIcon: _revealPassword
                ? LucideIcons.eyeOff
                : LucideIcons.eye,
            // One reveal control, in the field itself: the old "Show
            // password" row beneath it put two eyes on one form.
            onSuffixTap: () =>
                setState(() => _revealPassword = !_revealPassword),
            suffixTooltip:
                _revealPassword ? 'Hide password' : 'Show password',
            onChanged: (_) {
              if (_passwordError != null) setState(() => _passwordError = null);
            },
          ),
          gap18,
          LegalAcceptance(
            checked: _acceptedTerms,
            error: _termsError,
            actionLabel: 'signing in',
            onChanged: (value) => setState(() {
              _acceptedTerms = value;
              _termsError = value ? null : _termsError;
            }),
          ),
          gap20,
          const OrDivider('Or continue with'),
          gap16,
          SocialButton(
            label: 'Continue with Google',
            onPressed: _busy ? null : _signInWithGoogle,
          ),
          gap12,
          const SocialButton(
            label: 'Continue with Apple',
            leading: SocialLeading.apple,
          ),
        ],
      ),
    );
  }
}
