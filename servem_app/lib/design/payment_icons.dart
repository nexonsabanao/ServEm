import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/localization.dart';
import 'theme.dart';

/// Philippine payment rails and the official Google mark.
///
/// ServEm settles in the Philippines, so the checkout surface shows GCash,
/// Maya, bank transfer and cash on completion — no foreign card-brand artwork,
/// which the platform does not support.
///
/// Every badge is drawn into the same 46 x 30 box and vertically centred, so
/// the wordmarks and glyphs share one baseline and one optical weight when they
/// sit side by side.
class PaymentRailBadge extends StatelessWidget {
  const PaymentRailBadge({
    super.key,
    required this.method,
    this.width = 46,
    this.height = 30,
  });

  final PaymentMethod method;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Color(method.accent),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Center(
          child: switch (method.id) {
            'gcash' => const _Wordmark(text: 'GCash', size: 10.5),
            'maya' => const _Wordmark(text: 'Maya', size: 12),
            'bank_transfer' => const Icon(
                LucideIcons.landmark,
                size: 17,
                color: Colors.white,
              ),
            _ => const Icon(
                LucideIcons.banknote,
                size: 17,
                color: Colors.white,
              ),
          },
        ),
      ),
    );
  }
}

class _Wordmark extends StatelessWidget {
  const _Wordmark({required this.text, required this.size});

  final String text;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      // Centred on the box's midline so wordmarks and glyphs share a baseline.
      textAlign: TextAlign.center,
      style: TextStyle(
        fontFamily: 'Inter',
        color: Colors.white,
        fontSize: size,
        height: 1,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.2,
      ),
    );
  }
}

/// The four supported rails as a row of equally sized badges.
class PaymentRailRow extends StatelessWidget {
  const PaymentRailRow({super.key, this.height = 30});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final method in philippinePaymentMethods) ...[
          PaymentRailBadge(method: method, height: height),
          if (method != philippinePaymentMethods.last) const SizedBox(width: 10),
        ],
      ],
    );
  }
}

/// Radio-style picker for the payment rail on the checkout screen.
class PaymentMethodPicker extends StatelessWidget {
  const PaymentMethodPicker({
    super.key,
    required this.selected,
    required this.onSelect,
  });

  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final method in philippinePaymentMethods)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _PaymentTile(
              method: method,
              selected: method.id == selected,
              onTap: () => onSelect(method.id),
            ),
          ),
      ],
    );
  }
}

class _PaymentTile extends StatelessWidget {
  const _PaymentTile({
    required this.method,
    required this.selected,
    required this.onTap,
  });

  final PaymentMethod method;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(V.cardRadius),
      side: BorderSide(color: selected ? V.brand : V.line, width: selected ? 1.6 : 1),
    );
    return Semantics(
      selected: selected,
      button: true,
      label: '${method.label}. ${method.description}',
      child: Material(
        color: selected ? V.tint : V.surface,
        shape: shape,
        child: InkWell(
          borderRadius: BorderRadius.circular(V.cardRadius),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                PaymentRailBadge(method: method),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(method.label, style: T.label.copyWith(fontSize: 16)),
                      const SizedBox(height: 4),
                      Text(method.description, style: T.small.copyWith(fontSize: 14)),
                    ],
                  ),
                ),
                Icon(
                  selected ? LucideIcons.checkCircle2 : LucideIcons.circle,
                  size: 22,
                  color: selected ? V.brand : V.line,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The official four-colour Google `G`, drawn into a square box so it lines up
/// with the label next to it on a white outlined button.
class GoogleMark extends StatelessWidget {
  const GoogleMark({super.key, this.size = 20});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _GoogleGPainter()),
    );
  }
}

/// Fills the four arcs of the Google `G` using the brand palette
/// (blue #4285F4, green #34A853, yellow #FBBC05, red #EA4335) at 24 x 24 units.
class _GoogleGPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24, size.height / 24);

    // Blue: the right arm, ending in the horizontal bar of the G.
    canvas.drawPath(
      Path()
        ..moveTo(12, 10.2)
        ..lineTo(21.4, 10.2)
        ..cubicTo(21.5, 10.9, 21.6, 11.5, 21.6, 12.2)
        ..cubicTo(21.6, 15.3, 20.5, 17.9, 18.6, 19.6)
        ..lineTo(15.4, 17.1)
        ..cubicTo(16.5, 16.3, 17.2, 15.3, 17.4, 14.1)
        ..lineTo(12, 14.1)
        ..close(),
      Paint()..color = const Color(0xFF4285F4),
    );

    // Green: the bottom sweep, closing the ring under the bar.
    canvas.drawPath(
      Path()
        ..moveTo(6.4, 14)
        ..lineTo(3.1, 16.6)
        ..cubicTo(4.8, 19.8, 8.1, 22, 12, 22)
        ..cubicTo(14.7, 22, 17, 21.1, 18.6, 19.6)
        ..lineTo(15.4, 17.1)
        ..cubicTo(14.5, 17.7, 13.4, 18.1, 12, 18.1)
        ..cubicTo(9.4, 18.1, 7.2, 16.3, 6.4, 14)
        ..close(),
      Paint()..color = const Color(0xFF34A853),
    );

    // Yellow: the left arc.
    canvas.drawPath(
      Path()
        ..moveTo(2, 12)
        ..cubicTo(2, 13.6, 2.4, 15.2, 3.1, 16.6)
        ..lineTo(6.4, 14)
        ..cubicTo(6.2, 13.4, 6.1, 12.7, 6.1, 12)
        ..cubicTo(6.1, 11.3, 6.2, 10.6, 6.4, 10)
        ..lineTo(3.1, 7.4)
        ..cubicTo(2.4, 8.8, 2, 10.4, 2, 12)
        ..close(),
      Paint()..color = const Color(0xFFFBBC05),
    );

    // Red: the top arc, from the bar's start over the crown.
    canvas.drawPath(
      Path()
        ..moveTo(12, 6)
        ..cubicTo(9.4, 6, 7.2, 7.7, 6.4, 10)
        ..lineTo(3.1, 7.4)
        ..cubicTo(4.8, 4.2, 8.1, 2, 12, 2)
        ..cubicTo(14.7, 2, 17, 3.1, 18.7, 4.7)
        ..lineTo(15.8, 7.5)
        ..cubicTo(14.8, 6.5, 13.5, 6, 12, 6)
        ..close(),
      Paint()..color = const Color(0xFFEA4335),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
