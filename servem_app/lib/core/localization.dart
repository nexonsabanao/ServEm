/// Single source of truth for Philippine localisation across the app.
///
/// Every price, date, distance, phone number and postal code the UI renders
/// goes through this file — screens must not interpolate a dollar sign, US city
/// names or five-digit ZIP codes by hand.
///
/// Conventions mirrored from the web client (`servem_web/src/lib/localization.ts`):
///  * currency is Philippine peso, symbol `₱`, `en-PH` grouping;
///  * all timestamps are interpreted in `Asia/Manila` (UTC+8, no DST);
///  * the platform service fee is 10% of the labour subtotal and is only ever
///    *displayed* from a server response — see [estimatedPriceBreakdown];
///  * mobile numbers are `+63 9xx xxx xxxx`; postal codes are exactly 4 digits.

library;

import 'package:flutter/services.dart';

const String appLocale = 'en-PH';
const String appTimeZone = 'Asia/Manila';

/// Philippines is UTC+8 year-round (no daylight saving), so a fixed offset is
/// exact and avoids pulling a tz database into the mobile build.
const Duration manilaOffset = Duration(hours: 8);

const String pesoSymbol = '\u20B1';

/// Platform commission on the labour subtotal. Display/estimate only: the value
/// charged is the one `createBooking` / `updateBookingStatus` write into
/// Firestore server-side.
const double platformFeeRate = 0.10;

/// Current wall-clock time in Manila as a naive [DateTime] (no zone attached).
DateTime manilaNow() => DateTime.now().toUtc().add(manilaOffset);

/// Converts any timestamp (DateTime, ISO-8601 string, or epoch milliseconds)
/// into the equivalent Manila wall-clock [DateTime].
DateTime toManila(Object value) {
  final DateTime utc;
  if (value is DateTime) {
    utc = value.isUtc ? value : value.toUtc();
  } else if (value is int) {
    utc = DateTime.fromMillisecondsSinceEpoch(value, isUtc: true);
  } else {
    final parsed = DateTime.tryParse(value.toString());
    utc = (parsed == null
        ? DateTime.now().toUtc()
        : (parsed.isUtc ? parsed : parsed.toUtc()));
  }
  return utc.add(manilaOffset);
}

/// `Sun, 25 Oct 2026, 9:00 AM` — always Manila time.
String formatManilaDateTime(Object value, {bool withTime = true}) {
  final local = toManila(value);
  final date = '${_weekdayShort(local.weekday)}, '
      '${_pad(local.day)} ${_monthShort(local.month)} ${local.year}';
  if (!withTime) return date;
  return '$date, ${formatManilaTime(local)}';
}

/// `9:00 AM` from a Manila wall-clock [DateTime].
String formatManilaTime(DateTime manilaTime) {
  final hour12 = manilaTime.hour % 12 == 0
      ? 12
      : manilaTime.hour % 12;
  final suffix = manilaTime.hour < 12 ? 'AM' : 'PM';
  return '$hour12:${_pad(manilaTime.minute)} $suffix';
}

/// `Sun, 25 Oct · 9:00 AM – 11:00 AM` style slot label used by booking cards.
String formatManilaSlot({
  required DateTime manilaStart,
  required int hours,
}) {
  final end = manilaStart.add(Duration(hours: hours));
  final day =
      '${_weekdayShort(manilaStart.weekday)}, ${_pad(manilaStart.day)} '
      '${_monthShort(manilaStart.month)}';
  return '$day · ${formatManilaTime(manilaStart)} – ${formatManilaTime(end)}';
}

/// `2 minutes ago`, `Yesterday`, `Oct 21` — Manila-relative, en-PH.
String formatManilaRelative(Object value) {
  final manila = toManila(value);
  final now = manilaNow();
  final diff = now.difference(manila);
  if (diff.isNegative) return formatManilaDateTime(manila, withTime: false);
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inMinutes < 60) {
    return '${diff.inMinutes} min ago';
  }
  if (diff.inHours < 24 && manila.day == now.day) {
    return formatManilaTime(manila);
  }
  if (diff.inDays == 1) return 'Yesterday';
  if (diff.inDays < 7) return '${diff.inDays} days ago';
  return '${_monthShort(manila.month)} ${manila.day}';
}

const List<String> _months = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const List<String> _weekdays = [
  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
];

String _weekdayShort(int weekday) => _weekdays[weekday - 1];
String _monthShort(int month) => _months[month];
String _pad(int value) => value.toString().padLeft(2, '0');

/// `₱1,250` (default) or `₱1,250.00` with [showCents].
String formatPeso(num amount, {bool showCents = false}) {
  final negative = amount < 0;
  final absolute = amount.abs();
  final rounded =
      showCents ? absolute.toDouble() : absolute.roundToDouble();
  final asString = rounded.toStringAsFixed(showCents ? 2 : 0);
  final dotIndex = asString.indexOf('.');
  final digits = dotIndex == -1 ? asString : asString.substring(0, dotIndex);
  final fraction = dotIndex == -1 ? '' : asString.substring(dotIndex);
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return '${negative ? '-' : ''}$pesoSymbol$buffer$fraction';
}

/// Signed peso amount for ledger rows: `+₱1,500.00` / `-₱500.00`.
String formatPesoDelta(num amount, {bool showCents = true}) {
  final sign = amount > 0 ? '+' : (amount < 0 ? '-' : '');
  return '$sign${formatPeso(amount.abs(), showCents: showCents)}';
}

/// Parses a user-typed peso string ("1,500", "₱1500.50") into a number.
double? parsePesoInput(String raw) {
  final cleaned = raw
      .replaceAll(pesoSymbol, '')
      .replaceAll(',', '')
      .replaceAll(RegExp(r'[^0-9.]'), '')
      .trim();
  if (cleaned.isEmpty) return null;
  return double.tryParse(cleaned);
}

/// `1.4 km away` — the app never renders miles.
String formatDistanceKm(double kilometers) {
  final rounded = kilometers < 10
      ? (kilometers * 10).roundToDouble() / 10
      : kilometers.roundToDouble();
  final text = rounded == rounded.roundToDouble()
      ? rounded.toStringAsFixed(0)
      : rounded.toStringAsFixed(1);
  return '$text km away';
}

/// `Within 5 km of <area>` style coverage copy.
String formatCoverageKm(double radiusKm) => 'Within ${radiusKm.round()} km';

/// `+63 917 123 4567` from any local or foreign spelling; null when the digits
/// are not a valid Philippine mobile number.
String? normalizePhilippineMobile(String? input) {
  if (input == null) return null;
  final digits = input.replaceAll(RegExp(r'\D'), '');
  String local;
  if (digits.startsWith('0063')) {
    local = digits.substring(4);
  } else if (digits.startsWith('63')) {
    local = digits.substring(2);
  } else if (digits.startsWith('0')) {
    local = digits.substring(1);
  } else {
    local = digits;
  }
  if (!RegExp(r'^9\d{9}$').hasMatch(local)) return null;
  return '+63 ${local.substring(0, 3)} ${local.substring(3, 6)} '
      '${local.substring(6)}';
}

/// Philippine postal codes are exactly four digits (e.g. `1105` for Ermita).
bool validatePhilippinePostalCode(String input) =>
    RegExp(r'^\d{4}$').hasMatch(input.trim());

/// Philippine mobile numbers accepted with or without the `+63`/`0` prefix.
bool validatePhilippineMobile(String input) =>
    normalizePhilippineMobile(input) != null;

/// `+63` prefix for phone fields that only collect the 10 local digits.
String withPlus63(String input) {
  final normalised = normalizePhilippineMobile(input);
  return normalised ?? input.trim();
}

// ---------------------------------------------------------------- formatters

/// Groups digits as `917 123 4567` while typing the local mobile number.
class PhilippineMobileFormatter extends TextInputFormatter {
  const PhilippineMobileFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final local = digits.startsWith('63')
        ? digits.substring(2)
        : digits.startsWith('0')
            ? digits.substring(1)
            : digits;
    final capped = local.length > 10 ? local.substring(0, 10) : local;
    final parts = <String>[];
    if (capped.isNotEmpty) parts.add(capped.substring(0, capped.length < 3 ? capped.length : 3));
    if (capped.length > 3) parts.add(capped.substring(3, capped.length < 6 ? capped.length : 6));
    if (capped.length > 6) parts.add(capped.substring(6));
    final formatted = '+63 ${parts.join(' ')}';
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

/// Hard cap of four digits for postal codes.
class PhilippinePostalCodeFormatter extends TextInputFormatter {
  const PhilippinePostalCodeFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final capped = digits.length > 4 ? digits.substring(0, 4) : digits;
    return TextEditingValue(
      text: capped,
      selection: TextSelection.collapsed(offset: capped.length),
    );
  }
}

/// Thousands-separated whole pesos for numeric entry fields.
class PesoInputFormatter extends TextInputFormatter {
  const PesoInputFormatter({this.maxFractionDigits = 2});

  final int maxFractionDigits;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var text = newValue.text.replaceAll(pesoSymbol, '').trim();
    text = text.replaceAll(
      RegExp(maxFractionDigits == 0 ? r'[^0-9]' : r'[^0-9.]'),
      '',
    );
    if (maxFractionDigits == 0) text = text.replaceAll('.', '');
    final parsed = double.tryParse(text.replaceAll(',', ''));
    if (parsed == null && text.isNotEmpty) {
      return TextEditingValue(
        text: pesoSymbol,
        selection: TextSelection.collapsed(offset: 1),
      );
    }
    final grouped = parsed == null
        ? ''
        : formatPeso(parsed, showCents: maxFractionDigits > 0 && text.contains('.'));
    final caretOffset = text.isEmpty ? 1 : grouped.length;
    return TextEditingValue(
      text: pesoSymbol + grouped,
      selection: TextSelection.collapsed(offset: caretOffset),
    );
  }
}

// ------------------------------------------------------------------- pricing

/// A labour subtotal / platform fee / total triple.
class PriceBreakdown {
  const PriceBreakdown({
    required this.subtotal,
    required this.fee,
    required this.total,
    required this.authoritative,
  });

  final double subtotal;
  final double fee;
  final double total;

  /// True when [fee] came back from a Cloud Function. False for on-device
  /// estimates, which are shown as "estimated" and never written to Firestore.
  final bool authoritative;

  String get subtotalLabel => formatPeso(subtotal, showCents: true);
  String get feeLabel => formatPeso(fee, showCents: true);
  String get totalLabel => formatPeso(total, showCents: true);
}

/// UI-side 10% preview before a booking exists. Never send this fee to
/// Firestore — `createBooking` recomputes it server-side.
PriceBreakdown estimatedPriceBreakdown({
  required double ratePerHour,
  required int hours,
}) {
  final subtotal = (ratePerHour * hours).roundToDouble();
  final fee = (subtotal * platformFeeRate).roundToDouble();
  return PriceBreakdown(
    subtotal: subtotal,
    fee: fee,
    total: subtotal + fee,
    authoritative: false,
  );
}

/// Builds a breakdown from a server response.
PriceBreakdown authoritativePriceBreakdown({
  required double subtotal,
  required double fee,
  required double total,
}) {
  return PriceBreakdown(
    subtotal: subtotal,
    fee: fee,
    total: total,
    authoritative: true,
  );
}

// ------------------------------------------------------------ payment rails

/// The only rails ServEm supports in the Philippines.
class PaymentMethod {
  const PaymentMethod({
    required this.id,
    required this.label,
    required this.description,
    required this.accent,
  });

  final String id;
  final String label;
  final String description;
  final int accent;

  /// Asset-backed rails (GCash/Maya) render a wordmark chip; the rest render
  /// a tinted glyph so every chip keeps the same optical weight.
  bool get isWallet => id == 'gcash' || id == 'maya';
}

const List<PaymentMethod> philippinePaymentMethods = [
  PaymentMethod(
    id: 'gcash',
    label: 'GCash',
    description: 'Pay from your GCash wallet',
    accent: 0xFF1976D2,
  ),
  PaymentMethod(
    id: 'maya',
    label: 'Maya',
    description: 'Pay with your Maya wallet',
    accent: 0xFF00B14F,
  ),
  PaymentMethod(
    id: 'bank_transfer',
    label: 'Bank transfer',
    description: 'Send through online banking',
    accent: 0xFF37474F,
  ),
  PaymentMethod(
    id: 'cash_on_completion',
    label: 'Cash on completion',
    description: 'Pay your ServMate after the job',
    accent: 0xFF2E7D32,
  ),
];

PaymentMethod? findPaymentMethod(String? id) {
  if (id == null) return null;
  for (final method in philippinePaymentMethods) {
    if (method.id == id) return method;
  }
  return null;
}

String paymentMethodLabel(String? id) =>
    findPaymentMethod(id)?.label ?? 'Payment method';

// ---------------------------------------------------------------- locations

/// A Philippine address part: barangay / city or municipality / province.
class PhilippineLocation {
  const PhilippineLocation({
    required this.barangay,
    required this.city,
    required this.province,
    required this.postalCode,
  });

  final String barangay;
  final String city;
  final String province;
  final String postalCode;

  String get display =>
      barangay.isEmpty ? '$city, $province' : '$barangay, $city, $province';
}

const List<String> philippineRegions = [
  'Metro Manila',
  'Central Visayas',
  'Davao Region',
];

/// Launch coverage. Kept short and real: these are the cities the catalogue and
/// address form offer by default.
const List<PhilippineLocation> metroManilaAreas = [
  PhilippineLocation(barangay: 'Ermita', city: 'Manila', province: 'Metro Manila', postalCode: '1100'),
  PhilippineLocation(barangay: 'Makati Central Business District', city: 'Makati', province: 'Metro Manila', postalCode: '1229'),
  PhilippineLocation(barangay: 'Brgy. Teachers Village', city: 'Quezon City', province: 'Metro Manila', postalCode: '1108'),
  PhilippineLocation(barangay: 'Poblacion', city: 'Mandaluyong', province: 'Metro Manila', postalCode: '1870'),
  PhilippineLocation(barangay: 'San Antonio', city: 'Muntinlupa', province: 'Metro Manila', postalCode: '1770'),
  PhilippineLocation(barangay: 'Bagumbayan', city: 'Taguig', province: 'Metro Manila', postalCode: '1637'),
];

const List<PhilippineLocation> cebuAreas = [
  PhilippineLocation(barangay: 'Parian', city: 'Cebu City', province: 'Cebu', postalCode: '6000'),
  PhilippineLocation(barangay: 'Tisa', city: 'Cebu City', province: 'Cebu', postalCode: '6003'),
  PhilippineLocation(barangay: 'Poblacion', city: 'Mandaue City', province: 'Cebu', postalCode: '6014'),
  PhilippineLocation(barangay: 'Basak', city: 'Lapu-Lapu City', province: 'Cebu', postalCode: '6015'),
];

const List<PhilippineLocation> davaoAreas = [
  PhilippineLocation(barangay: 'Uyangna', city: 'Davao City', province: 'Davao del Sur', postalCode: '8000'),
  PhilippineLocation(barangay: 'Matina Aduas', city: 'Davao City', province: 'Davao del Sur', postalCode: '8002'),
  PhilippineLocation(barangay: 'Bajada', city: 'Davao City', province: 'Davao del Sur', postalCode: '8000'),
];

const List<PhilippineLocation> allPhilippineAreas = [
  ...metroManilaAreas,
  ...cebuAreas,
  ...davaoAreas,
];

/// Default service area for a fresh Philippine account (Makati CBD).
const PhilippineLocation defaultPhilippineLocation = PhilippineLocation(
  barangay: 'Makati Central Business District',
  city: 'Makati',
  province: 'Metro Manila',
  postalCode: '1229',
);

/// `Manila · 0.8 km` style proximity copy.
String formatAreaLabel(String city, double distanceKm) =>
    '$city · ${formatDistanceKm(distanceKm)}';

// ------------------------------------------------------------- booking slots

/// Parses a slot label such as `9:00 AM` into a 24-hour hour/minute pair.
({int hour, int minute}) parseManilaSlot(String label) {
  final match = RegExp(r'^(\d{1,2}):(\d{2})\s*([AP]M)$', caseSensitive: false)
      .firstMatch(label.trim());
  if (match == null) return (hour: 9, minute: 0);
  final rawHour = int.parse(match.group(1)!) % 12;
  final minute = int.parse(match.group(2)!);
  final suffix = match.group(3)!.toUpperCase();
  return (
    hour: suffix == 'PM' ? rawHour + 12 : rawHour,
    minute: minute,
  );
}

/// Manila wall-clock start time for a chosen day plus a slot label.
DateTime manilaStartFor({
  required DateTime manilaDay,
  required String slotLabel,
}) {
  final slot = parseManilaSlot(slotLabel);
  return DateTime(
    manilaDay.year,
    manilaDay.month,
    manilaDay.day,
    slot.hour,
    slot.minute,
  );
}

/// Whole hours parsed from a duration label such as `3 hours`.
int hoursFromDurationLabel(String label) {
  final match = RegExp(r'\d+').firstMatch(label);
  return match == null ? 2 : int.parse(match.group(0)!);
}

/// The next [count] bookable calendar days in Manila, starting [aheadDays]
/// from today. Naive DateTimes holding Manila wall-clock midnight.
List<DateTime> upcomingManilaDays({int count = 4, int aheadDays = 1}) {
  final today = manilaNow();
  final base = DateTime(today.year, today.month, today.day)
      .add(Duration(days: aheadDays));
  return [for (var i = 0; i < count; i++) base.add(Duration(days: i))];
}
