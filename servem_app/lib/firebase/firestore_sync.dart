import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/localization.dart';
import '../data/models.dart';
import 'firebase_auth_service.dart';

/// Firestore gateway for the mobile client.
///
/// Rules of the house:
///  * every read goes through Firestore with the signed-in user's token, so
///    `firestore.rules` decides what comes back;
///  * every write is re-checked by the rules — the 10% fee and the total are
///    arithmetic the server verifies, status only moves along the published
///    transitions, and `audit` is append-only;
///  * nothing here swallows an error. Failures raise [FirestoreSyncException]
///    with copy the UI can show alongside a retry.
class FirestoreSync {
  const FirestoreSync._();

  static FirebaseFirestore get _db {
    if (!FirebaseBootstrap.isReady) {
      throw const FirestoreSyncException(
        code: 'firebase-not-configured',
        message:
            'ServEm is not configured on this device. Add the platform '
            'app registration (see SETUP.md) and restart the app.',
      );
    }
    return FirebaseFirestore.instance;
  }

  static String get _uid {
    final uid = FirebaseAuthService.uid;
    if (uid == null) {
      throw const FirestoreSyncException(
        code: 'unauthenticated',
        message: 'Your session expired. Please sign in again.',
      );
    }
    return uid;
  }

  static Future<T> _guard<T>(
    String action,
    Future<T> Function() operation,
  ) async {
    try {
      return await operation();
    } on FirestoreSyncException {
      rethrow;
    } on FirebaseException catch (error) {
      debugPrint('[servem] $action failed: ${error.code} ${error.message}');
      throw FirestoreSyncException(
        code: error.code,
        message: _friendly(action, error.code, error.message),
      );
    } catch (error) {
      debugPrint('[servem] $action threw: $error');
      throw FirestoreSyncException(
        code: 'internal',
        message: 'Could not $action. Check your connection and try again.',
      );
    }
  }

  static String _friendly(String action, String code, String? details) {
    return switch (code) {
      'permission-denied' =>
        'ServEm blocked this action ($action). Your account is not allowed to '
            'do it — sign in again or contact support.',
      'unauthenticated' => 'Your session expired. Please sign in again.',
      'unavailable' =>
        'ServEm is unreachable right now. Check your connection and try again.',
      'not-found' => 'That record no longer exists.',
      'failed-precondition' =>
        'This action is not available yet. ${details ?? ''}'.trim(),
      _ => 'Could not $action (${code.isEmpty ? 'unknown error' : code}).',
    };
  }

  static Stream<T> _guardStream<T>(String action, Stream<T> Function() build) {
    final Stream<T> source;
    try {
      source = build();
    } on FirebaseException catch (error) {
      return Stream<T>.error(
        FirestoreSyncException(
          code: error.code,
          message: _friendly(action, error.code, error.message),
        ),
      );
    }
    return source.handleError((Object error) {
      if (error is FirestoreSyncException) throw error;
      if (error is FirebaseException) {
        throw FirestoreSyncException(
          code: error.code,
          message: _friendly(action, error.code, error.message),
        );
      }
      throw FirestoreSyncException(
        code: 'internal',
        message: 'Could not $action. Please try again.',
      );
    });
  }

  // ------------------------------------------------------------------ reads

  static Stream<Map<String, Object?>?> profileStream() => _guardStream(
    'load your profile',
    () => _db
        .collection('profiles')
        .doc(_uid)
        .snapshots()
        .map((snap) => snap.data()),
  );

  static Stream<List<Service>> servicesStream() => _guardStream(
    'load the service catalogue',
    () => _db
        .collection('services')
        .where('status', isEqualTo: 'live')
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((doc) => Service.fromMap(doc.id, doc.data()))
              .toList(),
        ),
  );

  static Stream<List<Provider>> servmatesStream() => _guardStream(
    'load nearby ServMates',
    () => _db
        .collection('servmates')
        .where('status', isEqualTo: 'active')
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((doc) => Provider.fromMap(doc.id, doc.data()))
              .toList(),
        ),
  );

  static Stream<List<Booking>> bookingsStream() => _guardStream(
    'load your bookings',
    () => _db
        .collection('bookings')
        .where('customerId', isEqualTo: _uid)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((doc) => Booking.fromMap(doc.id, doc.data()))
              .toList(),
        ),
  );

  static Stream<List<Booking>> jobsStream(String providerUid) => _guardStream(
    'load your jobs',
    () => _db
        .collection('bookings')
        .where('providerId', isEqualTo: providerUid)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((doc) => Booking.fromMap(doc.id, doc.data()))
              .toList(),
        ),
  );

  static Stream<List<Booking>> inboundRequestsStream(String providerUid) =>
      _guardStream(
        'load incoming requests',
        () => _db
            .collection('bookings')
            .where('providerId', isEqualTo: providerUid)
            .where('status', isEqualTo: 'pending')
            .snapshots()
            .map(
              (snap) => snap.docs
                  .map((doc) => Booking.fromMap(doc.id, doc.data()))
                  .toList(),
            ),
      );

  static Stream<List<Thread>> threadsStream() => _guardStream(
    'load your conversations',
    () => _db
        .collection('threads')
        .where('members', arrayContains: _uid)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((doc) => Thread.fromMap(doc.id, doc.data(), _uid))
              .toList(),
        ),
  );

  static Stream<List<Map<String, Object?>>> messagesStream(String threadId) =>
      _guardStream(
        'load this conversation',
        () => _db
            .collection('threads')
            .doc(threadId)
            .collection('messages')
            .orderBy('createdAt')
            .snapshots()
            .map(
              (snap) => snap.docs
                  .map((doc) => Map<String, Object?>.from(doc.data()))
                  .toList(),
            ),
      );

  static Stream<List<Address>> savedPlacesStream() => _guardStream(
    'load your saved addresses',
    () => _db
        .collection('profiles')
        .doc(_uid)
        .collection('places')
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((doc) => Address.fromMap(doc.id, doc.data()))
              .toList(),
        ),
  );

  static Stream<List<AppNotificationData>> notificationsStream() =>
      _guardStream(
        'load your notifications',
        () => _db
            .collection('notifications')
            .where('uid', isEqualTo: _uid)
            .snapshots()
            .map(
              (snap) => snap.docs
                  .map((doc) => AppNotificationData.fromMap(doc.id, doc.data()))
                  .toList(),
            ),
      );

  static Stream<List<PaymentRecord>> paymentsStream() => _guardStream(
    'load your payouts',
    () => _db
        .collection('withdrawals')
        .where('providerId', isEqualTo: _uid)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((doc) => PaymentRecord.fromMap(doc.id, doc.data()))
              .toList(),
        ),
  );

  static Stream<List<VerificationRequest>> verificationRequestsStream() =>
      _guardStream(
        'load verification requests',
        () => _db
            .collection('verificationRequests')
            .where('status', isEqualTo: 'pending')
            .snapshots()
            .map(
              (snap) => snap.docs
                  .map((doc) => VerificationRequest.fromMap(doc.id, doc.data()))
                  .toList(),
            ),
      );

  /// Admin-only: open disputes plus support tickets.
  static Stream<List<CaseRecord>> adminCasesStream() => _guardStream(
    'load the admin queue',
    () => _db.collection('disputes').snapshots().asyncMap((disputes) async {
      final tickets = await _db.collection('tickets').get();
      return [
        ...disputes.docs.map(
          (doc) => CaseRecord.fromMap('dispute', doc.id, doc.data()),
        ),
        ...tickets.docs.map(
          (doc) => CaseRecord.fromMap('ticket', doc.id, doc.data()),
        ),
      ];
    }),
  );

  static String? _cachedServmateId;

  static String _servmateId() => _cachedServmateId ?? _uid;

  /// Resolves the `servmates` document owned by the signed-in profile.
  static Future<String> resolveServmateId() async {
    final uid = _uid;
    try {
      final owned = await _db
          .collection('servmates')
          .where('uid', isEqualTo: uid)
          .limit(1)
          .get();
      final id = owned.docs.isNotEmpty ? owned.docs.first.id : uid;
      _cachedServmateId = id;
      return id;
    } on FirebaseException catch (error) {
      debugPrint('[servem] servmate lookup failed: ${error.code}');
      _cachedServmateId = uid;
      return uid;
    }
  }

  // ----------------------------------------------------------------- writes

  static const List<String> _placeTypes = [
    'home',
    'condo',
    'apartment',
    'office',
    'retail',
    'other',
  ];

  /// Creates a booking against a live listing. The rules re-check the listing's
  /// own rate, the 10% fee and the total, so this is the same contract the web
  /// client writes against.
  static Future<Booking> createBooking({
    required Service service,
    required DateTime manilaStart,
    required int hours,
    required String address,
    required String notes,
    required String paymentMethod,
    required String city,
    required String province,
    required String postalCode,
    required String placeType,
    String unit = '',
    String arrivalInstructions = '',
    String customer = '',
  }) async {
    final rail = paymentMethod.trim().toLowerCase();
    if (findPaymentMethod(rail) == null) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message:
            'Choose a supported payment method: GCash, Maya, bank '
            'transfer or cash on completion.',
      );
    }
    if (!_placeTypes.contains(placeType)) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message: 'Pick a place type: home, condo, apartment, office, retail or other.',
      );
    }
    if (!validatePhilippinePostalCode(postalCode)) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message: 'Philippine postal codes are exactly 4 digits, e.g. 1108.',
      );
    }
    if (city.trim().isEmpty || province.trim().isEmpty) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message:
            'Add the city and province for the service address before booking.',
      );
    }
    if (hours < 1 || hours > 24) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message: 'Bookings run from 1 to 24 hours.',
      );
    }
    return _guard('create this booking', () async {
      final uid = _uid;
      final listing = await _db.collection('services').doc(service.id).get();
      final data = listing.data();
      if (data == null || data['status'] != 'live') {
        throw const FirestoreSyncException(
          code: 'not-found',
          message: 'That listing is no longer bookable. Pick another one.',
        );
      }
      final rate = (data['rate'] as num?)?.toInt() ?? 0;
      final providerId = data['providerId'] as String? ?? '';
      if (rate <= 0 || providerId.isEmpty) {
        throw const FirestoreSyncException(
          code: 'failed-precondition',
          message: 'This listing is missing a rate or a provider.',
        );
      }
      final subtotal = rate * hours;
      final fee = (subtotal * 0.1).round();
      final total = subtotal + fee;
      final fullAddress = [
        address.trim(),
        unit.trim(),
      ].where((line) => line.isNotEmpty).join(', ');
      final ref = _db.collection('bookings').doc();
      await ref.set({
        'customerId': uid,
        'customer': customer,
        'provider': service.provider.name,
        'providerId': providerId,
        'serviceId': service.id,
        'service': (data['title'] ?? data['name'] ?? '') as String,
        'date': _manilaDate(manilaStart),
        'time': _manilaTime(manilaStart),
        'hours': hours,
        'status': 'pending',
        'address': fullAddress,
        'city': city.trim(),
        'province': province.trim(),
        'postalCode': postalCode.trim(),
        'notes': notes,
        'arrivalInstructions': arrivalInstructions,
        'placeType': placeType,
        'paymentMethod': rail,
        'rate': rate,
        'fee': fee,
        'total': total,
        'createdAt': FieldValue.serverTimestamp(),
      });
      return Booking(
        id: ref.id,
        docId: ref.id,
        service: service,
        when: formatManilaSlot(manilaStart: manilaStart, hours: hours),
        hours: hours,
        subtotal: subtotal.toDouble(),
        fee: fee.toDouble(),
        total: total.toDouble(),
        status: BookingStatus.awaitingProvider,
        address: address,
        paymentMethod: rail,
        notes: notes,
        customer: customer,
        startsAt: manilaStart,
        providerId: service.provider.id,
      );
    });
  }

  static String _manilaDate(DateTime manila) =>
      '${manila.year.toString().padLeft(4, '0')}-'
      '${manila.month.toString().padLeft(2, '0')}-'
      '${manila.day.toString().padLeft(2, '0')}';

  static String _manilaTime(DateTime manila) =>
      '${manila.hour.toString().padLeft(2, '0')}:'
      '${manila.minute.toString().padLeft(2, '0')}';

  static Future<void> updateBookingStatus({
    required String docId,
    required String action,
    String? reason,
    String? newDate,
    String? newTime,
  }) {
    if (!const [
      'cancel',
      'reschedule',
      'complete',
      'accept',
    ].contains(action)) {
      throw FirestoreSyncException(
        code: 'invalid-argument',
        message:
            'Unknown booking action "$action". ServEm supports cancel, '
            'reschedule, accept and complete.',
      );
    }
    return _guard('update this booking', () async {
      final ref = _db.collection('bookings').doc(docId);
      if (action == 'reschedule') {
        if (newDate == null ||
            newDate.isEmpty ||
            newTime == null ||
            newTime.isEmpty) {
          throw const FirestoreSyncException(
            code: 'invalid-argument',
            message: 'Pick a new date and time first.',
          );
        }
        await ref.update({
          'date': newDate,
          'time': newTime,
          'updatedAt': FieldValue.serverTimestamp(),
        });
        return;
      }
      final status = action == 'cancel'
          ? 'cancelled'
          : action == 'accept'
          ? 'accepted'
          : 'completed';
      final trimmed = reason?.trim() ?? '';
      await ref.update({
        'status': status,
        if (action == 'cancel')
          'cancellationReason': trimmed.isEmpty
              ? 'Cancelled by the customer'
              : trimmed,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    });
  }

  static (String, String) manilaSlotPair(DateTime manilaStart) =>
      (_manilaDate(manilaStart), _manilaTime(manilaStart));

  static Future<void> sendMessage({
    required String threadId,
    required String text,
  }) => _guard('send this message', () async {
    final uid = _uid;
    final body = text.trim();
    if (body.isEmpty) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message: 'Write a message first.',
      );
    }
    final threadRef = _db.collection('threads').doc(threadId);
    final booking = await _db.collection('bookings').doc(threadId).get();
    final data = booking.data();
    if (data == null) {
      throw const FirestoreSyncException(
        code: 'not-found',
        message: 'This conversation is no longer available.',
      );
    }
    // A missing thread cannot be read (rules only expose threads to members),
    // so merge-create instead of probing it first.
    await threadRef.set({
      'members': [data['customerId'], data['providerId']],
      'bookingId': threadId,
      'customerId': data['customerId'],
      'providerId': data['providerId'],
      'customerName': data['customer'] ?? '',
      'providerName': data['provider'] ?? '',
      'service': data['service'] ?? '',
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
    await threadRef.collection('messages').add({
      'senderId': uid,
      'text': body.length > 2000 ? body.substring(0, 2000) : body,
      'time': formatManilaTime(manilaNow()),
      'createdAt': FieldValue.serverTimestamp(),
    });
    await threadRef.update({
      'lastMessage': body.length > 140 ? body.substring(0, 140) : body,
      'lastMessageAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      'messageCount': FieldValue.increment(1),
    });
  });

  static const List<String> verificationTypes = [
    'government_id',
    'business_permit',
    'barangay_clearance',
    'nbi_clearance',
    'professional_certificate',
    'other',
  ];

  static Future<void> submitVerification({
    required List<String> documentPaths,
    required String type,
  }) {
    if (documentPaths.isEmpty || documentPaths.length > 10) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message: 'Upload between 1 and 10 document photos.',
      );
    }
    if (!verificationTypes.contains(type)) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message: 'Choose a valid document type.',
      );
    }
    return _guard('submit your documents', () async {
      await _db.collection('verificationRequests').add({
        'uid': _uid,
        'type': type,
        'documentPaths': documentPaths.take(5).toList(),
        'status': 'pending',
        'createdAt': FieldValue.serverTimestamp(),
      });
    });
  }

  static Future<void> requestPayout({required double amount}) {
    if (amount != amount.roundToDouble() || amount < 1000) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message: 'Payouts are whole-peso amounts of at least ₱1,000.',
      );
    }
    return _guard('request this payout', () async {
      await _db.collection('withdrawals').add({
        'providerId': _uid,
        'amount': amount.round(),
        'status': 'pending',
        'createdAt': FieldValue.serverTimestamp(),
      });
    });
  }

  static Future<void> adminDecision({
    required String kind,
    required String id,
    required String decision,
    required String reason,
  }) => _guard('record this decision', () async {
    const targets = {
      'verification': 'verificationRequests',
      'listing': 'services',
      'dispute': 'disputes',
      'payout': 'withdrawals',
      'payment': 'withdrawals',
      'review': 'reviews',
      'ticket': 'tickets',
      'account': 'profiles',
    };
    final table = targets[kind];
    final trimmed = reason.trim();
    if (table == null || trimmed.length < 5) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message: 'A decision needs a known kind and a reason of at least 5 characters.',
      );
    }
    final uid = _uid;
    await _db.collection(table).doc(id).update({
      kind == 'account' ? 'role' : 'status': decision,
      'decidedBy': uid,
      'decidedAt': FieldValue.serverTimestamp(),
      'decisionReason': trimmed,
    });
    await _db.collection('audit').add({
      'actor': uid,
      'action': '$kind:$decision',
      'target': id,
      'reason': trimmed,
      'createdAt': FieldValue.serverTimestamp(),
    });
  });

  /// Saves the signed-in user's own fields. `role` and `verified` are frozen by
  /// the rules and cannot be changed from here.
  static Future<void> saveProfile({
    String? name,
    String? email,
    String? phone,
    String? preferredName,
    PhilippineLocation? location,
    String? role,
  }) => _guard('save your profile', () async {
    final user = FirebaseAuthService.currentUser;
    final normalisedPhone = normalizePhilippineMobile(phone);
    if (phone != null && phone.trim().isNotEmpty && normalisedPhone == null) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message: 'Enter a Philippine mobile number, e.g. 0917 123 4567 or +63 917 123 4567.',
      );
    }
    final place = location ?? defaultPhilippineLocation;
    await _db.collection('profiles').doc(_uid).set({
      'name': name ?? user?.displayName ?? 'ServEm customer',
      'email': email ?? user?.email ?? '',
      'phone': normalisedPhone ?? '',
      'preferredName': preferredName ?? '',
      'barangay': place.barangay,
      'city': place.city,
      'province': place.province,
      'postalCode': place.postalCode,
      'photo': user?.photoURL ?? '',
      'verified': user?.emailVerified ?? false,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  });

  static Future<Map<String, dynamic>?> fetchProfile() =>
      _guard('load your profile', () async {
        final snap = await _db.collection('profiles').doc(_uid).get();
        return snap.data();
      });

  static Future<void> saveAddress(Address address) =>
      _guard('save this address', () async {
        if (address.postalCode.isNotEmpty &&
            !validatePhilippinePostalCode(address.postalCode)) {
          throw const FirestoreSyncException(
            code: 'invalid-argument',
            message: 'Philippine postal codes are exactly 4 digits, e.g. 1108.',
          );
        }
        final docId = address.id.isEmpty
            ? '$_uid-${DateTime.now().millisecondsSinceEpoch}'
            : address.id;
        await _db
            .collection('profiles')
            .doc(_uid)
            .collection('places')
            .doc(docId)
            .set({
              ...address.toMap(),
              'uid': _uid,
              'updatedAt': FieldValue.serverTimestamp(),
            }, SetOptions(merge: true));
      });

  static Future<void> deleteAddress(String id) => _guard(
    'delete this address',
    () => _db
        .collection('profiles')
        .doc(_uid)
        .collection('places')
        .doc(id)
        .delete(),
  );

  static Future<void> saveSavedSets({
    required Set<String> services,
    required Set<String> mates,
  }) => _guard(
    'save your bookmarks',
    () => _db.collection('profiles').doc(_uid).set({
      'savedServices': List<String>.from(services),
      'savedServmates': List<String>.from(mates),
    }, SetOptions(merge: true)),
  );

  static Future<void> savePreferences({
    required bool bookingNotifications,
    required bool messageAlerts,
    required bool recommendations,
  }) => _guard(
    'save your preferences',
    () => _db.collection('profiles').doc(_uid).set({
      'preferences': {
        'bookingNotifications': bookingNotifications,
        'messageAlerts': messageAlerts,
        'recommendations': recommendations,
        'locale': appLocale,
        'timeZone': appTimeZone,
      },
    }, SetOptions(merge: true)),
  );

  static Future<void> signOut() => FirebaseAuthService.signOut();

  /// Records a review and refreshes the ServMate's aggregate rating.
  static Future<(String, int)?> updateServmateRating({
    required String servmateId,
    required int rating,
    required ReviewRecord review,
  }) async {
    if (servmateId.isEmpty) return null;
    return _guard('send your review', () async {
      await _db.collection('reviews').add({
        'authorUid': _uid,
        'author': review.author,
        'rating': review.rating,
        'date': review.date,
        'text': review.text,
        'service': review.serviceTitle,
        'servmateId': servmateId,
        'status': 'published',
        'createdAt': FieldValue.serverTimestamp(),
      });
      final ref = _db.collection('servmates').doc(servmateId);
      final snap = await ref.get();
      final existing = (snap.data()?['reviews'] as num?)?.toInt() ?? 0;
      final current = double.tryParse('${snap.data()?['rating']}') ?? 0;
      final count = existing + 1;
      final average = (current * existing + rating) / count;
      await ref.set({
        'rating': double.parse(average.toStringAsFixed(1)),
        'reviews': count,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
      return (average.toStringAsFixed(1), count);
    });
  }

  /// Publishes one of the ServMate's own listings.
  static Future<void> saveService(Service service) => _guard(
    'publish this service',
    () => _db
        .collection('services')
        .doc(
          service.id.isEmpty
              ? '$_uid-${DateTime.now().millisecondsSinceEpoch}'
              : service.id,
        )
        .set({
          'title': service.title,
          'name': service.title,
          'category': service.category,
          'description': service.description,
          'blurb': service.description.length > 200
              ? service.description.substring(0, 200)
              : service.description,
          'rate': service.price.round(),
          'price': service.price.round(),
          'rating': double.tryParse(service.rating) ?? 0,
          'asset': service.asset,
          'providerId': service.provider.id.isEmpty
              ? _uid
              : service.provider.id,
          'providerName': service.provider.name,
          'servmateId': _servmateId(),
          'area': service.provider.area,
          'status': 'live',
          'updatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true)),
  );

  static Future<void> setServmateAvailability(bool available) => _guard(
    'update your availability',
    () => _db.collection('servmates').doc(_servmateId()).set({
      'status': available ? 'active' : 'paused',
      'available': available,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true)),
  );

  static Future<void> markNotificationsRead() async {
    if (!FirebaseBootstrap.isReady || FirebaseAuthService.uid == null) return;
    await _guard('clear your notifications', () async {
      final snap = await _db
          .collection('notifications')
          .where('uid', isEqualTo: _uid)
          .where('read', isEqualTo: false)
          .get();
      if (snap.docs.isEmpty) return;
      final batch = _db.batch();
      for (final doc in snap.docs) {
        batch.update(doc.reference, {'read': true});
      }
      await batch.commit();
    });
  }
}

/// Raised for every Firestore read/write that fails, already phrased so a
/// screen can render it verbatim with a retry action.
class FirestoreSyncException implements Exception {
  const FirestoreSyncException({required this.code, required this.message});

  final String code;
  final String message;

  bool get isPermissionProblem =>
      code == 'permission-denied' || code == 'unauthenticated';

  @override
  String toString() => 'FirestoreSyncException($code): $message';
}

/// Raw notification document before icons are attached on the client.
class AppNotificationData {
  const AppNotificationData({
    required this.id,
    required this.title,
    required this.body,
    required this.kind,
    required this.when,
    required this.read,
  });

  final String id;
  final String title;
  final String body;
  final String kind;
  final String when;
  final bool read;

  factory AppNotificationData.fromMap(String id, Map<String, Object?> map) {
    return AppNotificationData(
      id: id,
      title: (map['title'] as String?) ?? 'ServEm',
      body: (map['body'] as String?) ?? '',
      kind: (map['kind'] as String?) ?? 'info',
      when: formatManilaRelative(
        map['time'] ?? map['createdAt'] ?? DateTime.now(),
      ),
      read: map['read'] == true,
    );
  }

  AppNotification toNotification() => AppNotification(
    id: id,
    icon: switch (kind) {
      'booking' => LucideIcons.calendarCheck,
      'message' => LucideIcons.messageCircle,
      'payment' => LucideIcons.wallet,
      'review' => LucideIcons.star,
      'alert' => LucideIcons.triangleAlert,
      _ => LucideIcons.bell,
    },
    title: title,
    body: body,
    when: when,
  );
}

/// A `withdrawals` row in pesos.
class PaymentRecord {
  const PaymentRecord({
    required this.id,
    required this.label,
    required this.subtitle,
    required this.amount,
    required this.method,
    required this.status,
  });

  final String id;
  final String label;
  final String subtitle;
  final double amount;
  final String method;
  final String status;

  TransactionRecord toTransaction() => TransactionRecord(
    title: label,
    subtitle: subtitle,
    amountValue: amount,
    isWithdrawal: amount < 0,
  );

  factory PaymentRecord.fromMap(String id, Map<String, Object?> map) {
    final amount = (map['amount'] as num?)?.toDouble() ?? 0;
    final isWithdrawal =
        map['kind'] == 'withdrawal' || map['type'] == 'withdrawal';
    return PaymentRecord(
      id: id,
      label:
          (map['label'] as String?) ??
          (map['service'] as String?) ??
          (isWithdrawal ? 'Payout' : 'Earning'),
      subtitle:
          '${paymentMethodLabel((map['method'] as String?) ?? (map['paymentMethod'] as String?))}'
          ' · ${formatManilaRelative(map['createdAt'] ?? DateTime.now())}'
          ' · ${_statusLabel(map['status'] as String?)}',
      amount: isWithdrawal ? -amount.abs() : amount.abs(),
      method:
          (map['method'] as String?) ??
          (map['paymentMethod'] as String?) ??
          'gcash',
      status: _statusLabel(map['status'] as String?),
    );
  }

  static String _statusLabel(String? raw) => switch (raw) {
    'completed' || 'paid' => 'Available',
    'pending' => 'Pending',
    'failed' || 'rejected' => 'Failed',
    _ => raw ?? 'Recorded',
  };
}

/// A `verificationRequests` row shown on the admin surface.
class VerificationRequest {
  const VerificationRequest({
    required this.id,
    required this.servmateName,
    required this.idType,
    required this.submittedAt,
    required this.status,
  });

  final String id;
  final String servmateName;
  final String idType;
  final String submittedAt;
  final String status;

  factory VerificationRequest.fromMap(String id, Map<String, Object?> map) =>
      VerificationRequest(
        id: id,
        servmateName:
            (map['servmateName'] as String?) ??
            (map['name'] as String?) ??
            'ServMate',
        idType: (map['idType'] as String?) ?? 'PhilSys ID',
        submittedAt: formatManilaRelative(
          map['submittedAt'] ?? map['createdAt'] ?? DateTime.now(),
        ),
        status: (map['status'] as String?) ?? 'pending',
      );
}

/// A `disputes` or `tickets` row in the admin queue.
class CaseRecord {
  const CaseRecord({
    required this.kind,
    required this.id,
    required this.subject,
    required this.parties,
    required this.updatedAt,
    required this.status,
    required this.amountPeso,
  });

  /// `dispute` or `ticket`.
  final String kind;
  final String id;
  final String subject;
  final String parties;
  final String updatedAt;
  final String status;

  /// Amount in dispute, in Philippine pesos (zero for support tickets).
  final double amountPeso;

  String get amountLabel =>
      amountPeso > 0 ? formatPeso(amountPeso, showCents: true) : '—';

  factory CaseRecord.fromMap(String kind, String id, Map<String, Object?> map) {
    final createdAt = map['createdAt'] ?? map['openedAt'] ?? DateTime.now();
    return CaseRecord(
      kind: kind,
      id: id,
      subject:
          (map['subject'] as String?) ??
          (map['title'] as String?) ??
          (kind == 'dispute' ? 'Booking dispute' : 'Support ticket'),
      parties: [
        (map['openedBy'] as String?) ?? (map['customerName'] as String?) ?? '',
        (map['servmateName'] as String?) ?? (map['assignee'] as String?) ?? '',
      ].where((part) => part.isNotEmpty).join(' ↔ '),
      updatedAt: formatManilaRelative(createdAt),
      status: (map['status'] as String?) ?? 'open',
      amountPeso: (map['amount'] as num?)?.toDouble() ?? 0,
    );
  }
}
