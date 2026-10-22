import 'package:flutter/material.dart';

/// The ServEm palette — the same paper / ink / slate tokens the web app prints
/// from `globals.css`, so both surfaces read as one product.
abstract final class AppPalette {
  // Surfaces.
  static const paper = Color(0xFFF6F5F1);
  static const paperSunk = Color(0xFFEEEDE9);
  static const card = Color(0xFFFFFEFC);

  // Ink.
  static const graphite = Color(0xFF4A4A4A);
  static const inkSoft = Color(0xFF6B6B6B);

  // The one accent — slate, exactly like the web.
  static const slate = Color(0xFF6D8196);
  static const slateDeep = Color(0xFF52667B);
  static const slateWash = Color(0xFFE9EDF1);

  // Lines and status.
  static const mist = Color(0xFFCBCBCB);
  static const line = Color(0x264A4A4A);
  static const danger = Color(0xFF9D4B3B);

  // The ink shadow cast — a fixed rgba(74,74,74,0.12) so shadows never need
  // alpha math at the call site.
  static const shadowInk = Color(0x1F4A4A4A);

  // Slate wash settled onto paper — the press-feedback tint, pre-blended so
  // callers stay const-friendly.
  static const splash = Color(0xFFE3E9EE);
}

/// Type families. The display serif and the utility mono carry the receipt
/// language: Fraunces-like serif for names and money, monospace for anything
/// someone counts. Georgia ships on iOS and macOS; on Android the `serif`
/// fallback keeps the same editorial feel through Noto Serif.
abstract final class AppType {
  static const display = 'Georgia';
  static const displayFallback = <String>['serif'];
  static const utility = 'monospace';

  /// Uppercase mono metadata — refs, counts, eyebrows.
  static const TextStyle eyebrow = TextStyle(
    color: AppPalette.inkSoft,
    fontFamily: utility,
    fontSize: 9.5,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.1,
  );
}
