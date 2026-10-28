/// Domain models for the ServEm marketplace.
///
/// These are transport-neutral view models: they are populated from Firestore
/// documents (see `lib/firebase/firestore_sync.dart`) and never carry seeded
/// sample content. Every money field is Philippine pesos; every distance is
/// kilometres; every label goes through `lib/core/localization.dart`.

library;

import 'package:flutter/material.dart';

import '../core/localization.dart';

/// Canonical booking/job lifecycle states. Firestore stores the lowercase form;
/// Cloud Function `updateBookingStatus` is the only writer.
class BookingStatus {
  const BookingStatus._();

  static const awaitingProvider = 'Awaiting provider';
  static const confirmed = 'Confirmed';
  static const inProgress = 'In progress';
  static const completed = 'Completed';
  static const cancelled = 'Cancelled';

  static const all = [
    awaitingProvider,
    confirmed,
    inProgress,
    completed,
    cancelled,
  ];

  static String fromFirestore(String? raw) =>
      switch ((raw ?? '').toLowerCase()) {
        'cancelled' => cancelled,
        'completed' => completed,
        'confirmed' || 'accepted' => confirmed,
        'in progress' ||
        'in_progress' ||
        'active' ||
        'arrived' ||
        'en route' => inProgress,
        _ => awaitingProvider,
      };

  static String toFirestore(String value) => switch (value) {
    cancelled => 'cancelled',
    completed => 'completed',
    confirmed => 'confirmed',
    inProgress => 'in_progress',
    _ => 'requested',
  };
}

/// A ServMate (service provider) listing from the `servmates` collection.
class Provider {
  const Provider({
    required this.name,
    required this.asset,
    required this.rating,
    required this.reviews,
    required this.jobs,
    required this.area,
    this.id = '',
    this.distanceKm = 0.8,
    this.bio = '',
    this.tags = const [],
  });

  final String id;
  final String name;
  final String asset;
  final String rating;
  final int reviews;
  final int jobs;

  /// Barangay / city, e.g. `Brgy. teachers Village, Quezon City`.
  final String area;
  final double distanceKm;
  final String bio;
  final List<String> tags;

  String get distance => formatDistanceKm(distanceKm);

  static Provider empty(String name) => Provider(
    name: name,
    asset: '',
    rating: 'New',
    reviews: 0,
    jobs: 0,
    area: defaultPhilippineLocation.city,
  );

  Provider copyWith({
    String? id,
    String? name,
    String? asset,
    String? rating,
    int? reviews,
    int? jobs,
    String? area,
    double? distanceKm,
    String? bio,
    List<String>? tags,
  }) {
    return Provider(
      id: id ?? this.id,
      name: name ?? this.name,
      asset: asset ?? this.asset,
      rating: rating ?? this.rating,
      reviews: reviews ?? this.reviews,
      jobs: jobs ?? this.jobs,
      area: area ?? this.area,
      distanceKm: distanceKm ?? this.distanceKm,
      bio: bio ?? this.bio,
      tags: tags ?? this.tags,
    );
  }

  Map<String, Object?> toMap() => {
    'name': name,
    'photo': asset,
    'rating': rating,
    'reviews': reviews,
    'jobs': jobs,
    'area': area,
    'bio': bio,
    'tags': tags,
  };

  factory Provider.fromMap(String id, Map<String, Object?> map) {
    final tagsRaw = map['tags'];
    return Provider(
      id: id,
      name: (map['name'] as String?) ?? 'ServMate',
      asset: (map['photo'] as String?) ?? '',
      rating: formatRating(map['rating']),
      reviews: (map['reviews'] as num?)?.toInt() ?? 0,
      jobs: (map['jobs'] as num?)?.toInt() ?? 0,
      area: (map['area'] as String?) ?? defaultPhilippineLocation.display,
      distanceKm: (map['distanceKm'] as num?)?.toDouble() ?? 0.8,
      bio: (map['bio'] as String?) ?? '',
      tags: tagsRaw is List ? tagsRaw.map((e) => '$e').toList() : const [],
    );
  }
}

/// Normalises a Firestore rating (number, string or missing) into display text.
String formatRating(Object? raw) => switch (raw) {
  final num value => value.toStringAsFixed(1),
  final String value when value.isNotEmpty => value,
  _ => 'New',
};

/// A bookable listing from the `services` collection.
class Service {
  const Service({
    required this.title,
    required this.provider,
    required this.price,
    required this.rating,
    required this.asset,
    required this.category,
    this.id = '',
    this.distanceKm = 0.8,
    this.description = '',
  });

  final String id;
  final String title;
  final Provider provider;

  /// Labour rate in Philippine pesos per hour.
  final double price;
  final String rating;
  final String asset;
  final String category;
  final double distanceKm;
  final String description;

  String get distance => formatDistanceKm(distanceKm);
  String get priceLabel => '${formatPeso(price)} / hr';

  /// Labour subtotal in pesos for [hours] of work, before the platform fee.
  double laborSubtotal(int hours) => (price * hours).roundToDouble();

  Service copyWith({
    String? id,
    String? title,
    Provider? provider,
    double? price,
    String? rating,
    String? asset,
    String? category,
    double? distanceKm,
    String? description,
  }) {
    return Service(
      id: id ?? this.id,
      title: title ?? this.title,
      provider: provider ?? this.provider,
      price: price ?? this.price,
      rating: rating ?? this.rating,
      asset: asset ?? this.asset,
      category: category ?? this.category,
      distanceKm: distanceKm ?? this.distanceKm,
      description: description ?? this.description,
    );
  }

  factory Service.fromMap(String id, Map<String, Object?> map) {
    final providerRaw = map['provider'];
    final providerName = providerRaw is Map
        ? (providerRaw['name'] as String? ?? 'ServMate')
        : (providerRaw as String? ?? 'ServMate');
    return Service(
      id: id,
      title: (map['title'] as String?) ?? (map['name'] as String?) ?? 'Service',
      provider: Provider(
        id:
            (map['providerId'] as String?) ??
            (map['servmateId'] as String?) ??
            '',
        name: providerName,
        asset: (map['providerPhoto'] as String?) ?? '',
        rating: formatRating(
          providerRaw is Map ? providerRaw['rating'] : map['rating'],
        ),
        reviews: (map['providerReviews'] as num?)?.toInt() ?? 0,
        jobs: (map['providerJobs'] as num?)?.toInt() ?? 0,
        area:
            (map['providerArea'] as String?) ??
            defaultPhilippineLocation.display,
        distanceKm: (map['distanceKm'] as num?)?.toDouble() ?? 0.8,
        bio: (map['providerBio'] as String?) ?? '',
        tags: const [],
      ),
      price:
          (map['rate'] as num?)?.toDouble() ??
          (map['price'] as num?)?.toDouble() ??
          0,
      rating: formatRating(map['rating']),
      asset: (map['photo'] as String?) ?? (map['asset'] as String?) ?? '',
      category: (map['category'] as String?) ?? 'General',
      distanceKm: (map['distanceKm'] as num?)?.toDouble() ?? 0.8,
      description: (map['description'] as String?) ?? '',
    );
  }

  Map<String, Object?> toMap() => {
    'title': title,
    // `createBooking` reads `name`, `providerId`, `status` and `rate`
    // from the service document — mirror the web catalogue shape.
    'name': title,
    'category': category,
    'rate': price,
    'currency': 'PHP',
    'description': description,
    'photo': asset,
    'providerId': provider.id,
    'servmateId': provider.id,
    'provider': provider.name,
    'providerPhoto': provider.asset,
    'rating': provider.rating,
    'status': 'live',
    'active': true,
  };
}

/// A booking from the `bookings` collection.
///
/// [subtotal], [fee] and [total] are the values written by the `createBooking`
/// Cloud Function. The client never computes the fee it persists.
class Booking {
  const Booking({
    required this.id,
    required this.service,
    required this.when,
    required this.hours,
    required this.total,
    required this.status,
    this.docId = '',
    this.subtotal = 0,
    this.fee = 0,
    this.address = '',
    this.paymentMethod = 'gcash',
    this.notes = '',
    this.customer = '',
    this.startsAt,
    this.providerId = '',
  });

  /// Human-readable booking reference, e.g. `SE-2610-014`.
  final String id;

  /// Firestore document id, used for `updateBookingStatus`.
  final String docId;
  final Service service;

  /// Manila-formatted slot label, e.g. `Sun, 25 Oct · 9:00 AM – 11:00 AM`.
  final String when;
  final int hours;
  final double total;
  final double subtotal;
  final double fee;
  final String status;
  final String address;
  final String paymentMethod;
  final String notes;

  /// Display name of the customer who placed the booking.
  final String customer;

  /// Manila wall-clock start, when the backend supplied one.
  final DateTime? startsAt;
  final String providerId;

  String get totalLabel => formatPeso(total, showCents: true);
  String get subtotalLabel => formatPeso(subtotal, showCents: true);
  String get feeLabel => formatPeso(fee, showCents: true);
  String get paymentLabel => paymentMethodLabel(paymentMethod);

  Booking copyWith({
    String? id,
    String? docId,
    Service? service,
    String? when,
    int? hours,
    double? total,
    double? subtotal,
    double? fee,
    String? status,
    String? address,
    String? paymentMethod,
    String? notes,
    String? customer,
    DateTime? startsAt,
    String? providerId,
  }) {
    return Booking(
      id: id ?? this.id,
      docId: docId ?? this.docId,
      service: service ?? this.service,
      when: when ?? this.when,
      hours: hours ?? this.hours,
      total: total ?? this.total,
      subtotal: subtotal ?? this.subtotal,
      fee: fee ?? this.fee,
      status: status ?? this.status,
      address: address ?? this.address,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      notes: notes ?? this.notes,
      customer: customer ?? this.customer,
      startsAt: startsAt ?? this.startsAt,
      providerId: providerId ?? this.providerId,
    );
  }

  factory Booking.fromMap(String docId, Map<String, Object?> map) {
    final service = Service.fromMap((map['serviceId'] as String?) ?? docId, {
      'title': map['service'] as String? ?? 'Service',
      'provider': map['provider'] as String? ?? 'ServMate',
      'providerPhoto': map['providerPhoto'] as String?,
      'rate': map['rate'] as num?,
      'rating': map['rating'],
      'photo': map['servicePhoto'] as String?,
      'category': map['category'] as String?,
      'distanceKm': map['distanceKm'] as num?,
    });
    final createdAt = _parseTimestamp(map['createdAt']);
    // `createBooking` stores the slot as plain `date` (YYYY-MM-DD) + `time`
    // (HH:mm) strings in Manila wall-clock; prefer them over `createdAt`.
    final dateText = map['date'] as String?;
    final timeText = map['time'] as String?;
    DateTime? slotStart;
    if (dateText != null &&
        dateText.length == 10 &&
        timeText != null &&
        timeText.length >= 5) {
      final parsedDate = DateTime.tryParse(dateText);
      final parsedTime = DateTime.tryParse('2000-01-01T$timeText:00');
      if (parsedDate != null && parsedTime != null) {
        slotStart = DateTime(
          parsedDate.year,
          parsedDate.month,
          parsedDate.day,
          parsedTime.hour,
          parsedTime.minute,
        );
      }
    }
    final scheduledAt = _parseTimestamp(map['scheduledAt']);
    final starts = slotStart ?? scheduledAt ?? createdAt;
    final hours = (map['hours'] as num?)?.toInt() ?? 0;
    return Booking(
      id: (map['bookingRef'] as String?) ?? docId,
      docId: docId,
      service: service,
      when: (starts == null || hours == 0)
          ? ([
              map['date'] as String?,
              map['time'] as String?,
            ]).whereType<String>().where((e) => e.isNotEmpty).join(' · ')
          : formatManilaSlot(manilaStart: starts, hours: hours),
      hours: hours,
      subtotal: (map['subtotal'] as num?)?.toDouble() ?? 0,
      fee:
          (map['platformFee'] as num?)?.toDouble() ??
          (map['fee'] as num?)?.toDouble() ??
          0,
      total: (map['total'] as num?)?.toDouble() ?? 0,
      status: BookingStatus.fromFirestore(map['status'] as String?),
      address: (map['address'] as String?) ?? '',
      paymentMethod: (map['paymentMethod'] as String?) ?? 'gcash',
      notes: (map['notes'] as String?) ?? '',
      customer: (map['customer'] as String?) ?? '',
      startsAt: starts,
      providerId:
          (map['providerId'] as String?) ??
          (map['servmateId'] as String?) ??
          '',
    );
  }
}

/// Converts any Firestore timestamp shape into a Manila wall-clock [DateTime].
///
/// Handles `DateTime`, epoch millis, ISO-8601 strings and `Timestamp` documents
/// (duck-typed via `toDate()`) so these models stay free of a Firebase import.
DateTime? _parseTimestamp(Object? raw) {
  if (raw == null) return null;
  DateTime? absolute;
  if (raw is DateTime) {
    absolute = raw;
  } else if (raw is int) {
    absolute = DateTime.fromMillisecondsSinceEpoch(raw, isUtc: true);
  } else if (raw is String) {
    absolute = DateTime.tryParse(raw);
  } else {
    try {
      final converted = (raw as dynamic).toDate();
      if (converted is DateTime) absolute = converted;
    } catch (_) {
      absolute = null;
    }
  }
  if (absolute == null) return null;
  return (absolute.isUtc ? absolute : absolute.toUtc()).add(manilaOffset);
}

/// An inbound job request on the ServMate side.
class JobRequest {
  const JobRequest({
    required this.id,
    required this.title,
    required this.customer,
    required this.when,
    required this.price,
    required this.area,
    this.docId = '',
    this.distanceKm = 0,
    this.status = BookingStatus.awaitingProvider,
    this.asset = '',
  });

  final String id;
  final String docId;
  final String title;
  final String customer;
  final String when;

  /// Labour subtotal in pesos the customer agreed to.
  final double price;
  final String area;
  final double distanceKm;
  final String status;
  final String asset;

  String get distance => distanceKm > 0
      ? formatDistanceKm(distanceKm)
      : 'Distance shared after booking';

  JobRequest copyWith({
    String? id,
    String? docId,
    String? title,
    String? customer,
    String? when,
    double? price,
    String? area,
    double? distanceKm,
    String? status,
    String? asset,
  }) {
    return JobRequest(
      id: id ?? this.id,
      docId: docId ?? this.docId,
      title: title ?? this.title,
      customer: customer ?? this.customer,
      when: when ?? this.when,
      price: price ?? this.price,
      area: area ?? this.area,
      distanceKm: distanceKm ?? this.distanceKm,
      status: status ?? this.status,
      asset: asset ?? this.asset,
    );
  }

  factory JobRequest.fromBooking(Booking booking) => JobRequest(
    id: booking.id,
    docId: booking.docId,
    title: booking.service.title,
    customer: booking.customer,
    when: booking.when,
    price: booking.subtotal,
    area: booking.address,
    asset: booking.service.asset,
    status: booking.status,
  );
}

/// A ServMate-side scheduled job.
class Job {
  const Job({
    required this.title,
    required this.customer,
    required this.when,
    required this.price,
    required this.area,
    this.docId = '',
    this.distanceKm = 0,
    this.status = BookingStatus.confirmed,
    this.asset = '',
    this.address = '',
  });

  final String docId;
  final String title;
  final String customer;
  final String when;

  /// Provider earnings in pesos (labour subtotal; the platform fee is not part
  /// of what the ServMate receives).
  final double price;
  final String area;
  final double distanceKm;
  final String status;
  final String asset;
  final String address;

  String get distance => distanceKm > 0
      ? formatDistanceKm(distanceKm)
      : 'Distance shared after booking';
  String get earningsLabel => formatPeso(price, showCents: true);

  Job copyWith({
    String? docId,
    String? title,
    String? customer,
    String? when,
    double? price,
    String? area,
    double? distanceKm,
    String? status,
    String? asset,
    String? address,
  }) {
    return Job(
      docId: docId ?? this.docId,
      title: title ?? this.title,
      customer: customer ?? this.customer,
      when: when ?? this.when,
      price: price ?? this.price,
      area: area ?? this.area,
      distanceKm: distanceKm ?? this.distanceKm,
      status: status ?? this.status,
      asset: asset ?? this.asset,
      address: address ?? this.address,
    );
  }

  factory Job.fromBooking(Booking booking, {String customerName = ''}) => Job(
    docId: booking.docId,
    title: booking.service.title,
    customer: customerName.isNotEmpty
        ? customerName
        : booking.customer.isNotEmpty
        ? booking.customer
        : 'Customer',
    when: booking.when,
    price: booking.subtotal,
    area: booking.address,
    asset: booking.service.asset,
    status: booking.status,
    address: booking.address,
  );
}

class ChatLine {
  const ChatLine(this.text, this.time, {this.mine = false, this.read = false});

  final String text;
  final String time;
  final bool mine;
  final bool read;
}

class Thread {
  const Thread({
    required this.name,
    required this.service,
    required this.preview,
    required this.when,
    this.id = '',
    this.asset = '',
    this.initials = '',
    this.unread = false,
  });

  final String id;
  final String name;
  final String service;
  final String preview;
  final String when;
  final String asset;
  final String initials;
  final bool unread;

  Thread copyWith({
    String? id,
    String? name,
    String? service,
    String? preview,
    String? when,
    String? asset,
    String? initials,
    bool? unread,
  }) {
    return Thread(
      id: id ?? this.id,
      name: name ?? this.name,
      service: service ?? this.service,
      preview: preview ?? this.preview,
      when: when ?? this.when,
      asset: asset ?? this.asset,
      initials: initials ?? this.initials,
      unread: unread ?? this.unread,
    );
  }

  static String initialsOf(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return '?';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  factory Thread.fromMap(String id, Map<String, Object?> map, String myUid) {
    final List<Map<Object?, Object?>> messages = map['messages'] is List
        ? (map['messages'] as List).whereType<Map<Object?, Object?>>().toList()
        : const [];
    final Map<Object?, Object?> last = messages.isNotEmpty
        ? messages.last
        : const {};
    final lastFrom = (last['from'] as String?) ?? '';
    final members =
        (map['members'] as List?)?.whereType<String>().toList() ??
        const <String>[];
    final otherId =
        members.where((member) => member != myUid).firstOrNull ?? '';
    final customerId = (map['customerId'] as String?) ?? '';
    final peer = otherId.isNotEmpty && otherId == customerId
        ? (map['providerName'] as String?) ?? ''
        : (map['customerName'] as String?) ?? '';
    final peerName = peer.isNotEmpty
        ? peer
        : (map['peerName'] as String?) ?? 'Conversation';
    return Thread(
      id: id,
      name: peerName,
      service: (map['service'] as String?) ?? '',
      preview: (last['text'] as String?) ?? '',
      when: formatManilaRelative(
        _parseTimestamp(map['updatedAt']) ?? DateTime.now(),
      ),
      asset: (map['peerPhoto'] as String?) ?? '',
      initials: initialsOf(peerName),
      unread: lastFrom.isNotEmpty && lastFrom != myUid && last['read'] != true,
    );
  }
}

/// A saved Philippine address: Unit/Floor, street, barangay, city or
/// municipality, province and a 4-digit postal code.
class Address {
  const Address({
    required this.label,
    required this.icon,
    this.street = '',
    this.unit = '',
    this.barangay = '',
    this.city = '',
    this.province = '',
    this.postalCode = '',
    this.isDefault = false,
    this.detail = '',
    this.id = '',
  });

  final String id;
  final String label;
  final IconData icon;
  final String street;

  /// Unit / floor / apartment / house number.
  final String unit;
  final String barangay;

  /// City or municipality, e.g. `Quezon City`, `Cebu City`.
  final String city;
  final String province;

  /// Exactly four digits, validated by [validatePhilippinePostalCode].
  final String postalCode;
  final bool isDefault;

  /// Free-text arrival instructions.
  final String detail;

  String get line {
    final first = [
      if (street.isNotEmpty) street,
      if (unit.isNotEmpty) unit,
    ].join(', ');
    final second = [
      if (barangay.isNotEmpty) barangay,
      if (city.isNotEmpty) city,
      if (province.isNotEmpty) province,
      if (postalCode.isNotEmpty) postalCode,
    ].join(', ');
    return [
      if (first.isNotEmpty) first,
      if (second.isNotEmpty) second,
    ].join(' · ');
  }

  /// Maps the saved-place label to the lowercase `placeType` enum that
  /// `createBookingSchema` accepts (home|condo|apartment|office|retail|other).
  String get placeTypeCode {
    final value = label.toLowerCase();
    if (value.contains('condo')) return 'condo';
    if (value.contains('apartment')) return 'apartment';
    if (value.contains('home')) return 'home';
    if (value.contains('work') || value.contains('office')) return 'office';
    if (value.contains('retail') ||
        value.contains('store') ||
        value.contains('shop')) {
      return 'retail';
    }
    return 'other';
  }

  Address copyWith({
    String? id,
    String? label,
    IconData? icon,
    String? street,
    String? unit,
    String? barangay,
    String? city,
    String? province,
    String? postalCode,
    bool? isDefault,
    String? detail,
  }) {
    return Address(
      id: id ?? this.id,
      label: label ?? this.label,
      icon: icon ?? this.icon,
      street: street ?? this.street,
      unit: unit ?? this.unit,
      barangay: barangay ?? this.barangay,
      city: city ?? this.city,
      province: province ?? this.province,
      postalCode: postalCode ?? this.postalCode,
      isDefault: isDefault ?? this.isDefault,
      detail: detail ?? this.detail,
    );
  }

  Map<String, Object?> toMap() => {
    'label': label,
    'street': street,
    'unit': unit,
    'barangay': barangay,
    'city': city,
    'province': province,
    'postalCode': postalCode,
    'isDefault': isDefault,
    'detail': detail,
    'display': line,
  };

  factory Address.fromMap(String id, Map<String, Object?> map) => Address(
    id: id,
    label: (map['label'] as String?) ?? 'Home',
    icon: Icons.home,
    street: (map['street'] as String?) ?? '',
    unit: (map['unit'] as String?) ?? '',
    barangay: (map['barangay'] as String?) ?? '',
    city: (map['city'] as String?) ?? '',
    province: (map['province'] as String?) ?? '',
    postalCode: (map['postalCode'] as String?) ?? '',
    isDefault: map['isDefault'] == true,
    detail: (map['detail'] as String?) ?? '',
  );
}

class ReviewRecord {
  const ReviewRecord({
    required this.author,
    required this.rating,
    required this.date,
    required this.text,
    required this.serviceTitle,
    this.providerResponse,
  });

  final String author;
  final int rating;
  final String date;
  final String text;
  final String serviceTitle;
  final String? providerResponse;

  ReviewRecord copyWith({
    String? author,
    int? rating,
    String? date,
    String? text,
    String? serviceTitle,
    String? providerResponse,
  }) {
    return ReviewRecord(
      author: author ?? this.author,
      rating: rating ?? this.rating,
      date: date ?? this.date,
      text: text ?? this.text,
      serviceTitle: serviceTitle ?? this.serviceTitle,
      providerResponse: providerResponse ?? this.providerResponse,
    );
  }
}

class TransactionRecord {
  const TransactionRecord({
    required this.title,
    required this.subtitle,
    required this.amountValue,
    this.isWithdrawal = false,
  });

  final String title;
  final String subtitle;

  /// Signed amount in pesos: positive for earnings, negative for payouts.
  final double amountValue;
  final bool isWithdrawal;

  String get amount => formatPesoDelta(amountValue);
}

class UserProfile {
  const UserProfile({
    required this.name,
    required this.email,
    required this.phone,
    required this.preferredName,
    required this.avatar,
    this.uid = '',
    this.memberSince = '',
    this.role = 'customer',
    this.suspended = false,
    this.city = '',
    this.barangay = '',
    this.province = '',
    this.postalCode = '',
  });

  final String uid;
  final String name;
  final String email;

  /// Always stored as `+63 9xx xxx xxxx`.
  final String phone;
  final String preferredName;
  final String avatar;
  final String memberSince;
  final String role;

  /// Set by staff only. A suspended account keeps read access but cannot
  /// create bookings, listings, messages or requests.
  final bool suspended;
  final String city;
  final String barangay;
  final String province;
  final String postalCode;

  static const signedOut = UserProfile(
    name: '',
    email: '',
    phone: '',
    preferredName: '',
    avatar: '',
  );

  bool get isEmpty => name.isEmpty && email.isEmpty && uid.isEmpty;

  String get displayLocation => [
    if (barangay.isNotEmpty) barangay,
    if (city.isNotEmpty) city,
    if (province.isNotEmpty) province,
  ].join(', ');

  UserProfile copyWith({
    String? uid,
    String? name,
    String? email,
    String? phone,
    String? preferredName,
    String? avatar,
    String? memberSince,
    String? role,
    String? city,
    String? barangay,
    String? province,
    String? postalCode,
  }) {
    return UserProfile(
      uid: uid ?? this.uid,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      preferredName: preferredName ?? this.preferredName,
      avatar: avatar ?? this.avatar,
      memberSince: memberSince ?? this.memberSince,
      role: role ?? this.role,
      city: city ?? this.city,
      barangay: barangay ?? this.barangay,
      province: province ?? this.province,
      postalCode: postalCode ?? this.postalCode,
    );
  }

  factory UserProfile.fromMap(String uid, Map<String, Object?> map) {
    final since = map['since'] ?? map['createdAt'];
    return UserProfile(
      uid: uid,
      name: (map['name'] as String?) ?? '',
      email: (map['email'] as String?) ?? '',
      phone:
          normalizePhilippineMobile(map['phone'] as String?) ??
          (map['phone'] as String?) ??
          '',
      preferredName: (map['preferredName'] as String?) ?? '',
      avatar: (map['photo'] as String?) ?? '',
      memberSince: since == null
          ? ''
          : formatManilaDateTime(since, withTime: false),
      role: (map['role'] as String?) ?? 'customer',
      suspended: (map['status'] as String?) == 'suspended',
      city: (map['city'] as String?) ?? '',
      barangay: (map['barangay'] as String?) ?? '',
      province: (map['province'] as String?) ?? '',
      postalCode: (map['postalCode'] as String?) ?? '',
    );
  }
}

class AppNotification {
  const AppNotification({
    required this.icon,
    required this.title,
    required this.body,
    required this.when,
    this.id = '',
  });

  final String id;
  final IconData icon;
  final String title;
  final String body;
  final String when;
}

class CategoryItem {
  const CategoryItem({
    required this.name,
    required this.icon,
    required this.blurb,
    required this.count,
  });

  final String name;
  final IconData icon;
  final String blurb;
  final int count;
}

/// The fixed ServEm category taxonomy (product configuration, not sample data).
class ServiceCategory {
  const ServiceCategory({
    required this.name,
    required this.icon,
    required this.blurb,
    required this.shortName,
  });

  final String name;
  final IconData icon;
  final String blurb;
  final String shortName;
}

/// The in-progress booking being assembled across the three booking steps.
///
/// Carries a real Manila wall-clock start (never a free-text date string) and
/// only an *estimate* of the price: the subtotal, 10% platform fee and total
/// that get stored come back from the `createBooking` Cloud Function.
class BookingDraft {
  BookingDraft({
    required this.service,
    required List<String> slotLabels,
    required List<String> durationLabels,
    this.notes = '',
    DateTime? firstDay,
  }) : slotLabels = List<String>.unmodifiable(slotLabels),
       durationLabels = List<String>.unmodifiable(durationLabels),
       dayChoices = List<DateTime>.unmodifiable(
         firstDay == null
             ? upcomingManilaDays()
             : [
                 for (var i = 0; i < 4; i++)
                   DateTime(
                     firstDay.year,
                     firstDay.month,
                     firstDay.day,
                   ).add(Duration(days: i)),
               ],
       );

  final Service service;
  final List<String> slotLabels;
  final List<String> durationLabels;
  final List<DateTime> dayChoices;

  String notes;
  int dayIndex = 0;
  int slotIndex = 0;
  int durationIndex = 0;
  Address? address;
  String paymentMethod = philippinePaymentMethods.first.id;

  int get hours => hoursFromDurationLabel(durationLabels[durationIndex]);

  /// Manila wall-clock start, e.g. `Sun, 25 Oct 2026 09:00`.
  DateTime get manilaStart => manilaStartFor(
    manilaDay: dayChoices[dayIndex],
    slotLabel: slotLabels[slotIndex],
  );

  String get dayLabel =>
      formatManilaDateTime(dayChoices[dayIndex], withTime: false);
  String get slotLabel => slotLabels[slotIndex];
  String get durationLabel => durationLabels[durationIndex];
  String get whenLabel =>
      formatManilaSlot(manilaStart: manilaStart, hours: hours);

  String get addressLine => address?.line ?? '';

  /// On-device preview only. Never sent to Firestore as the price of record.
  PriceBreakdown get estimate =>
      estimatedPriceBreakdown(ratePerHour: service.price, hours: hours);
}
