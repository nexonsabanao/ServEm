import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/errors.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import '../../firebase/firebase_auth_service.dart';
import '../../firebase/firestore_sync.dart';
import 'auth_common.dart';
import 'login.dart';

class CreateAccountScreen extends StatefulWidget {
  const CreateAccountScreen({super.key});

  @override
  State<CreateAccountScreen> createState() => _CreateAccountScreenState();
}

class _CreateAccountScreenState extends State<CreateAccountScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _city = TextEditingController(text: defaultPhilippineLocation.city);
  final _province = TextEditingController(
      text: defaultPhilippineLocation.province);
  final _postal = TextEditingController(
      text: defaultPhilippineLocation.postalCode);

  final _nameFocus = FocusNode();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  final _confirmFocus = FocusNode();
  final _postalFocus = FocusNode();

  String? _nameError;
  String? _emailError;
  String? _passwordError;
  String? _confirmError;
  String? _postalError;
  bool _acceptedTerms = false;
  String? _termsError;
  bool _busy = false;
  bool _revealPassword = false;

  @override
  void initState() {
    super.initState();
    _nameFocus.addListener(_validateName);
    _emailFocus.addListener(_validateEmail);
    _passwordFocus.addListener(_validatePassword);
    _confirmFocus.addListener(_validateConfirm);
    _postalFocus.addListener(_validatePostal);
    _password.addListener(_notifyStrength);
  }

  @override
  void dispose() {
    for (final node in [
      _nameFocus,
      _emailFocus,
      _passwordFocus,
      _confirmFocus,
      _postalFocus,
    ]) {
      node.dispose();
    }
    _name.dispose();
    _password.removeListener(_notifyStrength);
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    _city.dispose();
    _province.dispose();
    _postal.dispose();
    super.dispose();
  }

  void _validateName() {
    if (_nameFocus.hasFocus) return;
    setState(() => _nameError = _nameErrorFor());
  }

  void _validateEmail() {
    if (_emailFocus.hasFocus) return;
    setState(() => _emailError = _emailErrorFor());
  }

  void _validatePassword() {
    if (_passwordFocus.hasFocus) return;
    setState(() => _passwordError = PasswordRules.validate(_password.text));
  }

  void _validateConfirm() {
    if (_confirmFocus.hasFocus) return;
    setState(() => _confirmError = _confirmErrorFor());
  }

  void _validatePostal() {
    if (_postalFocus.hasFocus) return;
    setState(() => _postalError = _postalErrorFor());
  }

  void _notifyStrength() => setState(() {});

  String? _nameErrorFor() {
    if (_name.text.trim().isEmpty) return 'Enter your full name.';
    if (_name.text.trim().length < 2) return 'That name looks too short.';
    return null;
  }

  String? _emailErrorFor() {
    final trimmed = _email.text.trim();
    if (trimmed.isEmpty) return 'Enter your email address.';
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$').hasMatch(trimmed)) {
      return 'That email address does not look right.';
    }
    return null;
  }

  String? _confirmErrorFor() {
    if (_confirm.text.isEmpty) return 'Re-enter your password.';
    if (_confirm.text != _password.text) return 'Passwords do not match.';
    return null;
  }

  String? _postalErrorFor() {
    if (_postal.text.trim().isEmpty) return 'Enter your 4-digit postal code.';
    if (!validatePhilippinePostalCode(_postal.text)) {
      return 'Philippine postal codes are exactly 4 digits, e.g. 1229.';
    }
    return null;
  }

  bool _validateAll() {
    setState(() {
      _nameError = _nameErrorFor();
      _emailError = _emailErrorFor();
      _passwordError = PasswordRules.validate(_password.text);
      _confirmError = _confirmErrorFor();
      _postalError = _postalErrorFor();
      _termsError = _acceptedTerms
          ? null
          : 'Please accept the Terms of Service and Privacy Policy to continue.';
    });
    return _nameError == null &&
        _emailError == null &&
        _passwordError == null &&
        _confirmError == null &&
        _postalError == null &&
        _termsError == null;
  }

  PhilippineLocation get _location => PhilippineLocation(
        barangay: '',
        city: _city.text.trim(),
        province: _province.text.trim(),
        postalCode: _postal.text.trim(),
      );

  Future<void> _createAccount() async {
    if (_busy) return;
    if (!_validateAll()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fix the highlighted fields.')),
      );
      return;
    }
    setState(() => _busy = true);
    final error = await FirebaseAuthService.register(
      name: _name.text,
      email: _email.text,
      password: _password.text,
    );
    if (!mounted) return;
    if (error != null) {
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
      return;
    }
    // Persist the profile. A failure here is shown to the user — the account
    // exists, but they must know their details were not stored.
    final syncError = FirebaseAuthService.currentUser == null
        ? 'Sign-in did not complete. Please try again.'
        : null;
    if (syncError == null) {
      try {
        await FirestoreSync.saveProfile(
          name: _name.text.trim(),
          email: _email.text.trim(),
          location: _location,
        );
      } on Object catch (problem) {
        if (mounted) {
          setState(() => _busy = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeFailure(problem).message)),
          );
          return;
        }
      }
    }
    if (!mounted) return;
    setState(() => _busy = false);
    // The root gate now sees the signed-in user and shows the role choice.
  }

  Future<void> _signUpWithGoogle() async {
    if (_busy) return;
    if (!_acceptedTerms) {
      setState(() => _termsError =
          'Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    setState(() => _busy = true);
    final error = await FirebaseAuthService.signInWithGoogle();
    if (!mounted) return;
    setState(() => _busy = false);
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
      return;
    }
    try {
      await FirestoreSync.saveProfile(
        name: _name.text.trim().isEmpty ? null : _name.text.trim(),
        location: _location,
      );
    } on Object catch (problem) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeFailure(problem).message)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final strength = PasswordRules.strength(_password.text);
    return ScreenScaffold(
      title: 'Create your account',
      showBack: false,
      bottom: CtaBar(
        label: _busy ? 'Creating account…' : 'Create account',
        link: 'Already a member? Log in',
        onLink: () => go(context, const LoginScreen()),
        onPressed: _busy ? null : _createAccount,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthHeader(
            tagline: 'A little help starts here. Join your barangay.',
          ),
          gap20,
          const FieldLabel('Full name'),
          ServTextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
            semanticsLabel: 'Full name',
            error: _nameError,
            onBlur: _validateName,
            onChanged: (_) {
              if (_nameError != null) setState(() => _nameError = null);
            },
          ),
          gap18,
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
          const FieldLabel('Password'),
          ServTextField(
            controller: _password,
            obscure: !_revealPassword,
            keyboardType: TextInputType.visiblePassword,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
            semanticsLabel: 'Password',
            error: _passwordError,
            onBlur: _validatePassword,
            suffixIcon: _revealPassword ? LucideIcons.eyeOff : LucideIcons.eye,
            // The reveal control lives in the field itself; below the meter
            // there is only the rule hint left, no second eye.
            onSuffixTap: () =>
                setState(() => _revealPassword = !_revealPassword),
            suffixTooltip:
                _revealPassword ? 'Hide password' : 'Show password',
            onChanged: (_) {
              if (_passwordError != null) setState(() => _passwordError = null);
            },
          ),
          gap8,
          _PasswordStrengthMeter(score: strength),
          gap8,
          Text(PasswordRules.problem, style: T.small),
          gap14,
          const FieldLabel('Confirm password'),
          ServTextField(
            controller: _confirm,
            obscure: true,
            keyboardType: TextInputType.visiblePassword,
            textInputAction: TextInputAction.done,
            semanticsLabel: 'Confirm password',
            error: _confirmError,
            onBlur: _validateConfirm,
            onChanged: (_) {
              if (_confirmError != null) setState(() => _confirmError = null);
            },
          ),
          gap20,
          const FieldLabel('City or Municipality'),
          ServTextField(
            controller: _city,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            semanticsLabel: 'City or municipality',
          ),
          gap14,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FieldLabel('Province'),
                    ServTextField(
                      controller: _province,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      semanticsLabel: 'Province',
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FieldLabel('Postal code'),
                    ServTextField(
                      controller: _postal,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.done,
                      inputFormatters: const [PhilippinePostalCodeFormatter()],
                      semanticsLabel: '4-digit postal code',
                      error: _postalError,
                      onBlur: _validatePostal,
                    ),
                  ],
                ),
              ),
            ],
          ),
          gap18,
          LegalAcceptance(
            checked: _acceptedTerms,
            error: _termsError,
            onChanged: (value) => setState(() {
              _acceptedTerms = value;
              _termsError = value ? null : _termsError;
            }),
          ),
          gap20,
          const OrDivider('Or sign up with'),
          gap16,
          SocialButton(
            label: 'Continue with Google',
            onPressed: _busy ? null : _signUpWithGoogle,
          ),
          gap12,
          const SocialButton(
            label: 'Continue with Apple',
            leading: SocialLeading.apple,
          ),
          gap8,
        ],
      ),
    );
  }
}

/// Four-segment strength meter announced to screen readers as a percentage.
class _PasswordStrengthMeter extends StatelessWidget {
  const _PasswordStrengthMeter({required this.score});

  final int score;

  static const _labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Excellent'];

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Password strength: ${_labels[score]}',
      child: Row(
        children: [
          for (var i = 0; i < 4; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                height: 4,
                decoration: BoxDecoration(
                  color: i < score
                      ? switch (score) {
                          1 || 2 => V.dangerFg,
                          3 => V.warnFg,
                          _ => V.brand,
                        }
                      : V.line,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ],
          const SizedBox(width: 10),
          Text(_labels[score], style: T.small),
        ],
      ),
    );
  }
}
