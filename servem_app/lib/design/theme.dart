import 'package:flutter/material.dart';

/// Design tokens lifted from the ServEm boards.
/// Colours come from the SVG export palette; sizes are measured off the
/// 780x1688 (2x, 390x844 logical) screen crops.
class V {
  V._();

  // Surfaces
  static const bg = Color(0xFFF7FAF8);
  static const surface = Color(0xFFFFFFFF);
  static const soft = Color(0xFFEDF2EF);
  static const tint = Color(0xFFE5F5EC);
  static const line = Color(0xFFDFE8E2);

  // Ink
  static const ink = Color(0xFF172B22);
  static const muted = Color(0xFF64756C);

  // Brand
  static const brand = Color(0xFF16845B);
  static const brandDeep = Color(0xFF0B573D);

  // Status
  static const warnBg = Color(0xFFFFF5DF);
  static const warnFg = Color(0xFF8A5B16);
  static const dangerBg = Color(0xFFFFF0EE);
  static const dangerFg = Color(0xFFB53E35);

  // Metrics
  static const pad = 24.0;
  static const radius = 14.0;
  static const cardRadius = 16.0;
  static const button = 56.0;
}

/// Text styles. Inter with the tight tracking the designs use.
class T {
  T._();

  static const _f = 'Inter';
  static const ink = V.ink;
  static const muted = V.muted;
  static const brand = V.brand;

  static const display = TextStyle(
    fontFamily: _f,
    fontSize: 40,
    height: 1.14,
    fontWeight: FontWeight.w700,
    letterSpacing: -1.3,
    color: V.ink,
  );
  static const h1 = TextStyle(
    fontFamily: _f,
    fontSize: 34,
    height: 1.2,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.9,
    color: V.ink,
  );
  static const h2 = TextStyle(
    fontFamily: _f,
    fontSize: 30,
    height: 1.22,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.7,
    color: V.ink,
  );
  static const h3 = TextStyle(
    fontFamily: _f,
    fontSize: 24,
    height: 1.25,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
    color: V.ink,
  );
  static const title = TextStyle(
    fontFamily: _f,
    fontSize: 21,
    height: 1.3,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.3,
    color: V.ink,
  );
  static const section = TextStyle(
    fontFamily: _f,
    fontSize: 20,
    height: 1.3,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.4,
    color: V.ink,
  );
  static const cardTitle = TextStyle(
    fontFamily: _f,
    fontSize: 17.5,
    height: 1.35,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
    color: V.ink,
  );
  static const label = TextStyle(
    fontFamily: _f,
    fontSize: 15,
    height: 1.4,
    fontWeight: FontWeight.w600,
    color: V.ink,
  );
  static const body = TextStyle(
    fontFamily: _f,
    fontSize: 16,
    height: 1.45,
    fontWeight: FontWeight.w400,
    color: V.ink,
  );
  static const bodyMuted = TextStyle(
    fontFamily: _f,
    fontSize: 16,
    height: 1.5,
    fontWeight: FontWeight.w400,
    color: V.muted,
  );
  static const small = TextStyle(
    fontFamily: _f,
    fontSize: 14,
    height: 1.5,
    fontWeight: FontWeight.w400,
    color: V.muted,
  );
  static const smallStrong = TextStyle(
    fontFamily: _f,
    fontSize: 14,
    height: 1.5,
    fontWeight: FontWeight.w600,
    color: V.ink,
  );
  static const micro = TextStyle(
    fontFamily: _f,
    fontSize: 12.5,
    height: 1.4,
    fontWeight: FontWeight.w400,
    color: V.muted,
  );
  static const link = TextStyle(
    fontFamily: _f,
    fontSize: 15,
    height: 1.4,
    fontWeight: FontWeight.w600,
    color: V.brand,
  );
  static const button = TextStyle(
    fontFamily: _f,
    fontSize: 17,
    height: 1.2,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.1,
    color: Colors.white,
  );
  static const eyebrow = TextStyle(
    fontFamily: _f,
    fontSize: 13,
    height: 1.3,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.9,
    color: V.brand,
  );
  static const price = TextStyle(
    fontFamily: _f,
    fontSize: 28,
    height: 1.2,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.6,
    color: V.ink,
  );
}

ThemeData buildTheme() {
  final base = ThemeData.light(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: V.bg,
    canvasColor: V.bg,
    colorScheme: base.colorScheme.copyWith(
      primary: V.brand,
      secondary: V.brand,
      surface: V.surface,
      onSurface: V.ink,
      error: V.dangerFg,
    ),
    splashFactory: InkSparkle.splashFactory,
    textSelectionTheme: const TextSelectionThemeData(cursorColor: V.brand),
    dividerTheme: const DividerThemeData(
      color: V.line,
      thickness: 1,
      space: 1,
    ),
    textTheme: base.textTheme.apply(
      fontFamily: 'Inter',
      bodyColor: V.ink,
      displayColor: V.ink,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: V.bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: V.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected) ? Colors.white : Colors.white,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected) ? V.brand : V.line,
      ),
      trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
    ),
  );
}
