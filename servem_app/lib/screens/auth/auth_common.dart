import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/localization.dart';
import '../../design/components.dart';
import '../../design/payment_icons.dart';
import '../../design/theme.dart';

export '../../design/payment_icons.dart' show GoogleMark;

/// The published legal documents. The web app hosts them for `servem-ph`.
const String termsOfServiceUrl = 'https://servem-ph.web.app/terms';
const String privacyPolicyUrl = 'https://servem-ph.web.app/privacy';

/// Opens a URL in the platform browser, reporting a message when it fails.
Future<void> openLegalUrl(BuildContext context, String url) async {
  final uri = Uri.parse(url);
  final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!opened && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Could not open $url. Please visit it in your browser.'),
      ),
    );
  }
}

class SocialButton extends StatelessWidget {
  const SocialButton({
    super.key,
    required this.label,
    this.leading = SocialLeading.google,
    this.onPressed,
  });

  final String label;
  final SocialLeading leading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(V.radius),
      side: const BorderSide(color: V.line),
    );
    return SizedBox(
      height: V.button,
      child: Material(
        // White outlined button, per the Google branding guidelines.
        color: V.surface,
        shape: shape,
        child: InkWell(
          borderRadius: BorderRadius.circular(V.radius),
          onTap: onPressed,
          child: Semantics(
            button: true,
            label: label,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              // A fixed 20 x 20 glyph box keeps every mark on one baseline at
              // the same optical weight next to the label.
              children: [
                SizedBox(
                  width: 20,
                  height: 20,
                  child: switch (leading) {
                    SocialLeading.google => const GoogleMark(size: 20),
                    SocialLeading.apple => const Center(
                        child: Icon(Icons.apple, size: 19, color: V.ink),
                      ),
                  },
                ),
                const SizedBox(width: 12),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.button.copyWith(fontSize: 16.5, color: V.ink),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

enum SocialLeading { google, apple }

class OrDivider extends StatelessWidget {
  const OrDivider(this.label, {super.key});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(height: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text(label, style: T.small.copyWith(fontSize: 15)),
        ),
        const Expanded(child: Divider(height: 1)),
      ],
    );
  }
}

/// Logo + tagline used at the top of the auth forms.
class AuthHeader extends StatelessWidget {
  const AuthHeader({super.key, required this.tagline});
  final String tagline;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const ServEmLogo(size: 44),
        const SizedBox(height: 10),
        Text(tagline, style: T.bodyMuted),
      ],
    );
  }
}

/// Required, explicit acknowledgement of the Terms of Service and the Privacy
/// Policy. The sign-up and login CTA stay disabled until it is ticked, and the
/// two documents open in the browser through `url_launcher`.
class LegalAcceptance extends StatelessWidget {
  const LegalAcceptance({
    super.key,
    required this.checked,
    required this.onChanged,
    this.error,
    this.actionLabel = 'creating an account',
  });

  final bool checked;
  final ValueChanged<bool> onChanged;
  final String? error;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => onChanged(!checked),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  checked ? LucideIcons.checkCircle2 : LucideIcons.circle,
                  size: 22,
                  color: checked ? V.brand : (error != null ? V.dangerFg : V.muted),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Wrap(
                    spacing: 4,
                    runSpacing: 2,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text('By $actionLabel I agree to the', style: T.small),
                      _LegalLink(
                        label: 'Terms of Service',
                        url: termsOfServiceUrl,
                      ),
                      Text('and', style: T.small),
                      _LegalLink(
                        label: 'Privacy Policy',
                        url: privacyPolicyUrl,
                      ),
                      Text('.', style: T.small),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 32),
            child: Text(
              error!,
              style: T.small.copyWith(color: V.dangerFg),
            ),
          ),
      ],
    );
  }
}

class _LegalLink extends StatelessWidget {
  const _LegalLink({required this.label, required this.url});

  final String label;
  final String url;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      link: true,
      label: '$label (opens in your browser)',
      child: InkWell(
        onTap: () => openLegalUrl(context, url),
        child: Text(
          label,
          style: T.small.copyWith(
            color: V.brand,
            fontWeight: FontWeight.w600,
            decoration: TextDecoration.underline,
            decorationColor: V.brand,
          ),
        ),
      ),
    );
  }
}

/// Peso-labelled field helper used by the pricing screens.
String pesoPerHourLabel(double rate) => '${formatPeso(rate)} / hr';
