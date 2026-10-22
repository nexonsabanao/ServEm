import 'package:flutter/material.dart';

import 'app_palette.dart';

abstract final class AppTheme {
  /// ServEm's customer theme: slates on paper, a serif for names and money,
  /// and monospace for anything someone counts. The paper background is the
  /// brand, so there is no dark variant.
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
      surfaceContainerHighest: AppPalette.paperSunk,
      outlineVariant: AppPalette.mist,
      error: AppPalette.danger,
      onError: AppPalette.card,
      outline: AppPalette.mist,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppPalette.paper,
      splashColor: AppPalette.splash,
      highlightColor: AppPalette.splash,
      dividerColor: AppPalette.line,
      dividerTheme: const DividerThemeData(
        color: AppPalette.line,
        thickness: 1,
        space: 1,
      ),
      textTheme: _textTheme,
      iconTheme: const IconThemeData(color: AppPalette.graphite, size: 22),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppPalette.paper,
        foregroundColor: AppPalette.graphite,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      navigationBarTheme: _navigationBarTheme,
      filledButtonTheme: _filledButtonTheme,
      outlinedButtonTheme: _outlinedButtonTheme,
      dialogTheme: _dialogTheme,
      snackBarTheme: _snackBarTheme,
    );
  }

  static const TextTheme _textTheme = TextTheme(
    // Display serif — names and money, like the web's Fraunces.
    headlineMedium: TextStyle(
      color: AppPalette.graphite,
      fontFamily: AppType.display,
      fontFamilyFallback: AppType.displayFallback,
      fontSize: 30,
      height: 1.08,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.9,
    ),
    titleLarge: TextStyle(
      color: AppPalette.graphite,
      fontFamily: AppType.display,
      fontFamilyFallback: AppType.displayFallback,
      fontSize: 19,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.3,
    ),
    titleMedium: TextStyle(
      color: AppPalette.graphite,
      fontFamily: AppType.display,
      fontFamilyFallback: AppType.displayFallback,
      fontSize: 16,
      fontWeight: FontWeight.w600,
      height: 1.25,
      letterSpacing: -0.2,
    ),
    bodyMedium: TextStyle(
      color: AppPalette.graphite,
      fontSize: 14,
      height: 1.55,
    ),
    bodySmall: TextStyle(
      color: AppPalette.inkSoft,
      fontSize: 12,
      height: 1.45,
    ),
    labelLarge: TextStyle(
      color: AppPalette.graphite,
      fontSize: 13.5,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.1,
    ),
  );

  static const NavigationBarThemeData _navigationBarTheme =
      NavigationBarThemeData(
        backgroundColor: AppPalette.card,
        indicatorColor: AppPalette.slateWash,
        height: 66,
        elevation: 0,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            color: selected ? AppPalette.slateDeep : AppPalette.inkSoft,
            fontSize: 11.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            letterSpacing: 0.2,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppPalette.slateDeep : AppPalette.inkSoft,
            size: 24,
          );
        }),
      );

  static const FilledButtonThemeData _filledButtonTheme =
      FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppPalette.graphite,
          foregroundColor: AppPalette.paper,
          minimumSize: const Size(0, 46),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
          ),
          textStyle: const TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
          ),
        ),
      );

  static const OutlinedButtonThemeData _outlinedButtonTheme =
      OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppPalette.graphite,
          minimumSize: const Size(0, 46),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
          side: const BorderSide(color: AppPalette.graphite),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(999)),
          ),
          textStyle: const TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
          ),
        ),
      );

  static const DialogTheme _dialogTheme = DialogTheme(
    backgroundColor: AppPalette.card,
    surfaceTintColor: Colors.transparent,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.all(Radius.circular(18)),
    ),
    titleTextStyle: TextStyle(
      color: AppPalette.graphite,
      fontFamily: AppType.display,
      fontFamilyFallback: AppType.displayFallback,
      fontSize: 21,
      fontWeight: FontWeight.w600,
      height: 1.2,
    ),
    contentTextStyle: TextStyle(
      color: AppPalette.inkSoft,
      fontSize: 13.5,
      height: 1.6,
    ),
  );

  static const SnackBarThemeData _snackBarTheme = SnackBarThemeData(
    backgroundColor: AppPalette.graphite,
    contentTextStyle: TextStyle(color: AppPalette.paper, fontSize: 13),
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.all(Radius.circular(10)),
    ),
  );
}
