import 'package:flutter/material.dart';

import 'app_palette.dart';

abstract final class AppTheme {
  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppPalette.slate,
      surface: AppPalette.paper,
    ).copyWith(
      primary: AppPalette.graphite,
      onPrimary: AppPalette.paper,
      secondary: AppPalette.slate,
      onSecondary: AppPalette.paper,
      surface: AppPalette.paper,
      onSurface: AppPalette.graphite,
      outline: AppPalette.mist,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppPalette.paper,
      textTheme: const TextTheme(
        headlineMedium: TextStyle(
          color: AppPalette.graphite,
          fontFamily: 'serif',
          fontSize: 30,
          height: 1.08,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.8,
        ),
        titleLarge: TextStyle(
          color: AppPalette.graphite,
          fontSize: 19,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.2,
        ),
        titleMedium: TextStyle(
          color: AppPalette.graphite,
          fontSize: 16,
          fontWeight: FontWeight.w700,
          height: 1.25,
        ),
        bodyMedium: TextStyle(
          color: AppPalette.graphite,
          fontSize: 14,
          height: 1.5,
        ),
        bodySmall: TextStyle(
          color: AppPalette.graphite,
          fontSize: 12,
          height: 1.4,
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppPalette.paper,
        foregroundColor: AppPalette.graphite,
        surfaceTintColor: Colors.transparent,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppPalette.card,
        indicatorColor: AppPalette.paleSlate,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            color: AppPalette.graphite,
            fontSize: 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          );
        }),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppPalette.graphite,
          foregroundColor: AppPalette.paper,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }
}
