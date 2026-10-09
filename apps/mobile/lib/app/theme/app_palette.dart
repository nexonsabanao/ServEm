import 'package:flutter/material.dart';

abstract final class AppPalette {
  static const paper = Color(0xFFF6F5F1);
  static const graphite = Color(0xFF4A4A4A);
  static const mist = Color(0xFFCBCBCB);
  static const slate = Color(0xFF6D8196);

  // Darker slate for text-bearing surfaces so light text stays legible.
  static const slateDeep = Color(0xFF52667B);
  static const card = Color(0xFFFFFEFC);
  static const paleSlate = Color(0xFFE9EDF1);
}
