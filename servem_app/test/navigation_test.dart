import 'package:flutter_test/flutter_test.dart';
import 'package:servem_app/core/localization.dart';
import 'package:servem_app/data/models.dart';

/// Contract tests for the Philippine formatting and the booking lifecycle the
/// screens rely on. They run without Firebase so they stay fast and always
/// meaningful, instead of asserting against seeded demo data.
void main() {
  group('Philippine money', () {
    test('peso amounts use the peso sign and group thousands', () {
      expect(formatPeso(1500), contains('₱'));
      expect(formatPeso(1500), contains('1,500'));
      expect(formatPeso(0), contains('₱'));
    });

    test('centavos appear only when asked for', () {
      expect(formatPeso(1250.5), isNot(contains('.50')));
      expect(formatPeso(1250.5, showCents: true), contains('1,250.50'));
    });
  });

  group('Philippine contact details', () {
    test('postal codes are exactly four digits', () {
      expect(validatePhilippinePostalCode('1000'), isTrue);
      expect(validatePhilippinePostalCode('10000'), isFalse);
      expect(validatePhilippinePostalCode('ABCD'), isFalse);
    });

    test('mobile numbers are accepted with or without the +63 prefix', () {
      expect(validatePhilippineMobile('+63 917 123 4567'), isTrue);
      expect(validatePhilippineMobile('0917 123 4567'), isTrue);
      expect(validatePhilippineMobile('12345'), isFalse);
    });
  });

  group('Manila scheduling', () {
    test('slot labels carry a date and the hour range', () {
      final label = formatManilaSlot(
        manilaStart: DateTime(2026, 10, 26, 9),
        hours: 2,
      );
      expect(label, contains('26'));
      expect(label, contains('Oct'));
      expect(label, contains('9:00 AM'));
      expect(label, contains('11:00 AM'));
    });

    test('a two-hour job is recognised from its duration label', () {
      expect(hoursFromDurationLabel('2 hours'), 2);
    });

    test('distances read in kilometres', () {
      expect(formatDistanceKm(1.2), contains('km'));
    });
  });

  group('Booking lifecycle', () {
    test('server status strings map to the labels the UI shows', () {
      expect(BookingStatus.fromFirestore('confirmed'), BookingStatus.confirmed);
      expect(BookingStatus.fromFirestore('in_progress'), BookingStatus.inProgress);
      expect(BookingStatus.fromFirestore('completed'), BookingStatus.completed);
      expect(BookingStatus.fromFirestore('cancelled'), BookingStatus.cancelled);
      // An unknown or missing status must never crash a screen.
      expect(BookingStatus.fromFirestore('something-new'), BookingStatus.awaitingProvider);
      expect(BookingStatus.fromFirestore(null), BookingStatus.awaitingProvider);
    });

    test('a job keeps the values the screens render', () {
      const job = Job(
        title: 'Furniture assembly',
        customer: 'Ana Cruz',
        when: 'Mon, 26 Oct · 9:00 AM – 11:00 AM',
        price: 900,
        area: 'Makati',
      );
      expect(job.title, 'Furniture assembly');
      expect(job.customer, 'Ana Cruz');
      expect(job.price, 900);
      expect(job.distance, isNotEmpty);
    });
  });
}
