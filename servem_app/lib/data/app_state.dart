import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/localization.dart';
import '../firebase/firebase_auth_service.dart';
import '../firebase/firestore_sync.dart';
import '../firebase/functions.dart';
import 'models.dart';

export 'models.dart';

enum AppRole { customer, servmate, admin }

/// Where the authenticated session is right now.
enum SessionStatus {
  /// No Firebase user: every collection in this store is empty.
  signedOut,

  /// Signed in and reading Firestore.
  connecting,

  /// Signed in and live.
  ready,

  /// A read failed (permission, offline, missing index). [AppState.error]
  /// carries the message and [AppState.retry] re-opens the streams.
  error,
}

/// The single app-wide store.
///
/// It is driven purely by Firebase: nothing here is seeded from a fixture.
/// Signing out clears every collection; signing in opens reactive Firestore
/// listeners; a failed read puts the store in [SessionStatus.error] with a
/// message and a retry action rather than silently continuing.
class AppState {
  AppState._() {
    _bindNotifiers();
  }

  static final AppState instance = AppState._();

  // Session ------------------------------------------------------------

  final ValueNotifier<SessionStatus> status = ValueNotifier<SessionStatus>(
    SessionStatus.signedOut,
  );
  final ValueNotifier<String?> error = ValueNotifier<String?>(null);
  final ValueNotifier<String?> userId = ValueNotifier<String?>(null);
  final ValueNotifier<bool> isAdmin = ValueNotifier<bool>(false);
  late final ValueNotifier<AppRole?> role;

  // Navigation
  late final ValueNotifier<int> customerTab;
  late final ValueNotifier<int> mateTab;
  String? justBooked;

  // Profiles
  late final ValueNotifier<UserProfile> userProfile;

  /// True when Firebase has confirmed the account's email address.
  late final ValueNotifier<bool> emailVerified;
  late final ValueNotifier<Provider> mateProfile;

  // Addresses
  late final ValueNotifier<List<Address>> addresses;

  // Catalogue & bookmarks
  late final ValueNotifier<List<Service>> services;
  late final ValueNotifier<List<Provider>> providers;
  late final ValueNotifier<List<CategoryItem>> categories;
  late final ValueNotifier<Set<String>> savedServices;
  late final ValueNotifier<Set<String>> savedMates;

  // Customer bookings
  late final ValueNotifier<List<Booking>> upcomingBookings;
  late final ValueNotifier<List<Booking>> activeBookings;
  late final ValueNotifier<List<Booking>> completedBookings;
  late final ValueNotifier<List<Booking>> cancelledBookings;

  // ServMate work
  late final ValueNotifier<bool> availableForWork;
  late final ValueNotifier<List<JobRequest>> jobRequests;
  late final ValueNotifier<List<JobRequest>> respondedRequests;
  late final ValueNotifier<List<Job>> upcomingJobs;
  late final ValueNotifier<List<Job>> activeJobs;
  late final ValueNotifier<List<Job>> historyJobs;

  // Earnings (pesos)
  late final ValueNotifier<double> availableBalance;
  late final ValueNotifier<double> todayEarnings;
  late final ValueNotifier<double> totalEarnings;
  late final ValueNotifier<List<TransactionRecord>> transactions;

  // Messages
  late final ValueNotifier<List<Thread>> customerThreads;
  late final ValueNotifier<List<Thread>> mateThreads;
  late final ValueNotifier<Map<String, List<ChatLine>>> chatMessages;

  // Reviews
  late final ValueNotifier<Map<String, List<ReviewRecord>>> reviews;

  // Notifications
  late final ValueNotifier<List<AppNotification>> notifications;
  late final ValueNotifier<List<AppNotification>> mateNotifications;

  // Settings
  late final ValueNotifier<bool> bookingNotifications;
  late final ValueNotifier<bool> messageAlerts;
  late final ValueNotifier<bool> recommendations;

  final List<StreamSubscription<Object?>> _subscriptions = [];
  Timer? _debounce;
  bool _bound = false;
  bool _jobsWatched = false;

  /// Booking slot choices offered by the launch catalogue (product config).
  List<String> get timeSlots => const ['9:00 AM', '11:00 AM', '2:00 PM'];
  List<String> get durations => const ['2 hours', '3 hours', '4 hours'];
  List<String> get reviewTags => const [
    'On time',
    'Great communication',
    'Tidy finish',
  ];

  bool get isSignedIn => userId.value != null;

  void _bindNotifiers() {
    role = ValueNotifier<AppRole?>(null);
    customerTab = ValueNotifier<int>(0);
    mateTab = ValueNotifier<int>(0);

    userProfile = ValueNotifier<UserProfile>(UserProfile.signedOut);
    emailVerified = ValueNotifier<bool>(false);
    mateProfile = ValueNotifier<Provider>(Provider.empty(''));

    addresses = ValueNotifier<List<Address>>(const []);

    services = ValueNotifier<List<Service>>(const []);
    providers = ValueNotifier<List<Provider>>(const []);
    categories = ValueNotifier<List<CategoryItem>>(const []);
    savedServices = ValueNotifier<Set<String>>(const {});
    savedMates = ValueNotifier<Set<String>>(const {});

    upcomingBookings = ValueNotifier<List<Booking>>(const []);
    activeBookings = ValueNotifier<List<Booking>>(const []);
    completedBookings = ValueNotifier<List<Booking>>(const []);
    cancelledBookings = ValueNotifier<List<Booking>>(const []);

    availableForWork = ValueNotifier<bool>(false);
    jobRequests = ValueNotifier<List<JobRequest>>(const []);
    respondedRequests = ValueNotifier<List<JobRequest>>(const []);
    upcomingJobs = ValueNotifier<List<Job>>(const []);
    activeJobs = ValueNotifier<List<Job>>(const []);
    historyJobs = ValueNotifier<List<Job>>(const []);

    availableBalance = ValueNotifier<double>(0);
    todayEarnings = ValueNotifier<double>(0);
    totalEarnings = ValueNotifier<double>(0);
    transactions = ValueNotifier<List<TransactionRecord>>(const []);

    customerThreads = ValueNotifier<List<Thread>>(const []);
    mateThreads = ValueNotifier<List<Thread>>(const []);
    chatMessages = ValueNotifier<Map<String, List<ChatLine>>>(const {});

    reviews = ValueNotifier<Map<String, List<ReviewRecord>>>(const {});

    notifications = ValueNotifier<List<AppNotification>>(const []);
    mateNotifications = ValueNotifier<List<AppNotification>>(const []);

    bookingNotifications = ValueNotifier<bool>(true);
    messageAlerts = ValueNotifier<bool>(true);
    recommendations = ValueNotifier<bool>(false);
  }

  /// Empties everything. Called on sign-out and before a fresh sign-in.
  void clear() {
    _cancelSubscriptions();
    userId.value = null;
    isAdmin.value = false;
    role.value = null;
    justBooked = null;

    userProfile.value = UserProfile.signedOut;
    emailVerified.value = false;
    mateProfile.value = Provider.empty('');
    addresses.value = const [];
    services.value = const [];
    providers.value = const [];
    categories.value = const [];
    savedServices.value = const {};
    savedMates.value = const {};

    upcomingBookings.value = const [];
    activeBookings.value = const [];
    completedBookings.value = const [];
    cancelledBookings.value = const [];

    availableForWork.value = false;
    jobRequests.value = const [];
    respondedRequests.value = const [];
    upcomingJobs.value = const [];
    activeJobs.value = const [];
    historyJobs.value = const [];

    availableBalance.value = 0;
    todayEarnings.value = 0;
    totalEarnings.value = 0;
    transactions.value = const [];

    customerThreads.value = const [];
    mateThreads.value = const [];
    chatMessages.value = const {};
    reviews.value = const {};
    notifications.value = const [];
    mateNotifications.value = const [];

    status.value = SessionStatus.signedOut;
    error.value = null;
  }

  // ------------------------------------------------------------- session

  /// Single entry point for auth-state changes; called by the root gate.
  Future<void> onAuthChanged(AppUser? user) async {
    if (user == null) {
      clear();
      return;
    }
    userId.value = user.uid;
    error.value = null;
    status.value = SessionStatus.connecting;
    await _refreshClaims();
    _openStreams();
  }

  Future<void> _refreshClaims() async {
    try {
      final claims = await FirebaseAuthService.idTokenClaims(refresh: true);
      isAdmin.value = claims['admin'] == true;
    } catch (problem) {
      debugPrint('[auth] claims lookup failed: $problem');
      isAdmin.value = false;
    }
  }

  /// Re-opens every Firestore listener after a failure.
  Future<void> retry() async {
    if (userId.value == null) return;
    error.value = null;
    status.value = SessionStatus.connecting;
    _cancelSubscriptions();
    _openStreams();
  }

  void _openStreams() {
    if (!_bound) _bound = true;
    _cancelSubscriptions();

    void watch<T>(Stream<T> stream, void Function(T) onData) {
      _subscriptions.add(
        stream.listen(
          onData,
          onError: (Object problem) {
            _fail(problem);
          },
        ),
      );
    }

    watch(FirestoreSync.profileStream(), _onProfile);
    watch(FirestoreSync.servicesStream(), _onServices);
    watch(FirestoreSync.servmatesStream(), _onServmates);
    watch(FirestoreSync.bookingsStream(), _onBookings);
    watch(FirestoreSync.threadsStream(), _onThreads);
    watch(FirestoreSync.savedPlacesStream(), _onPlaces);
    watch(FirestoreSync.notificationsStream(), _onNotifications);
    watch(FirestoreSync.paymentsStream(), _onPayments);
  }

  void _fail(Object problem) {
    final message = switch (problem) {
      FirestoreSyncException(:final message) => message,
      ServEmFunctionException(:final message) => message,
      _ => 'ServEm could not reach your data. Check your connection and try again.',
    };
    debugPrint('[app-state] $problem');
    error.value = message;
    status.value = SessionStatus.error;
  }

  void _markReady() {
    if (status.value != SessionStatus.error) {
      status.value = SessionStatus.ready;
      error.value = null;
    }
  }

  void _onProfile(Map<String, Object?>? data) {
    final uid = userId.value ?? '';
    if (data == null) {
      // First sign-in on this account: no profile document yet. Offer the role
      // choice rather than assuming a session, and reflect the admin claim.
      emailVerified.value = FirebaseAuthService.currentUser?.emailVerified ?? false;
      userProfile.value = UserProfile(
        uid: uid,
        name: FirebaseAuthService.currentUser?.displayName ?? '',
        email: FirebaseAuthService.currentUser?.email ?? '',
        phone:
            normalizePhilippineMobile(
              FirebaseAuthService.currentUser?.phoneNumber,
            ) ??
            '',
        preferredName: '',
        avatar: FirebaseAuthService.currentUser?.photoURL ?? '',
      );
      role.value = isAdmin.value ? AppRole.admin : null;
      _markReady();
      return;
    }
    userProfile.value = UserProfile.fromMap(uid, data);
    emailVerified.value = FirebaseAuthService.currentUser?.emailVerified ?? false;

    final savedServicesRaw = data['savedServices'];
    final savedMatesRaw = data['savedServmates'];
    savedServices.value = savedServicesRaw is List
        ? savedServicesRaw.map((e) => '$e').toSet()
        : const {};
    savedMates.value = savedMatesRaw is List
        ? savedMatesRaw.map((e) => '$e').toSet()
        : const {};

    final preferences = data['preferences'];
    if (preferences is Map) {
      bookingNotifications.value =
          preferences['bookingNotifications'] as bool? ?? true;
      messageAlerts.value = preferences['messageAlerts'] as bool? ?? true;
      recommendations.value = preferences['recommendations'] as bool? ?? false;
    }

    role.value = switch (data['role']) {
      'servmate' => AppRole.servmate,
      'customer' => AppRole.customer,
      _ => isAdmin.value ? AppRole.admin : null,
    };
    _markReady();
  }

  void _onServices(List<Service> list) {
    services.value = list;
    categories.value = _buildCategories(list);
    _markReady();
  }

  void _onServmates(List<Provider> list) {
    providers.value = list;
    final own = list.where((p) => p.id == userId.value).toList();
    if (own.isNotEmpty) mateProfile.value = own.first;
    _markReady();
  }

  void _onBookings(List<Booking> list) {
    upcomingBookings.value = list
        .where(
          (b) =>
              b.status == BookingStatus.awaitingProvider ||
              b.status == BookingStatus.confirmed,
        )
        .toList();
    activeBookings.value = list
        .where((b) => b.status == BookingStatus.inProgress)
        .toList();
    completedBookings.value = list
        .where((b) => b.status == BookingStatus.completed)
        .toList();
    cancelledBookings.value = list
        .where((b) => b.status == BookingStatus.cancelled)
        .toList();
    _markReady();
  }

  void _onThreads(List<Thread> list) {
    customerThreads.value = list;
    mateThreads.value = list;
    _markReady();
  }

  void _onPlaces(List<Address> list) {
    final sorted = [...list]
      ..sort((a, b) => (b.isDefault ? 1 : 0).compareTo(a.isDefault ? 1 : 0));
    addresses.value = sorted;
    _markReady();
  }

  void _onNotifications(List<AppNotificationData> list) {
    notifications.value = list
        .map((item) => item.toNotification())
        .toList(growable: false);
    mateNotifications.value = notifications.value;
    _markReady();
  }

  void _onPayments(List<PaymentRecord> list) {
    transactions.value = list.map((item) => item.toTransaction()).toList();
    var total = 0.0;
    var available = 0.0;
    var today = 0.0;
    final todayKey = formatManilaDateTime(manilaNow(), withTime: false);
    for (final record in list) {
      if (record.amount <= 0) continue;
      total += record.amount;
      if (record.status == 'Available') available += record.amount;
      if (record.subtitle.contains(todayKey)) today += record.amount;
    }
    totalEarnings.value = total;
    availableBalance.value = available;
    todayEarnings.value = today;
    _markReady();
  }

  List<CategoryItem> _buildCategories(List<Service> list) {
    final counts = <String, int>{};
    for (final service in list) {
      counts[service.category] = (counts[service.category] ?? 0) + 1;
    }
    return [
      for (final entry in counts.entries)
        CategoryItem(
          name: entry.key,
          icon: _categoryIcon(entry.key),
          blurb: _categoryBlurb(entry.key),
          count: entry.value,
        ),
    ];
  }

  static IconData _categoryIcon(String name) => switch (name) {
    'Repairs' => LucideIcons.wrench,
    'Home cleaning' => LucideIcons.sparkles,
    'Errands' => LucideIcons.shoppingBag,
    'Furniture assembly' => LucideIcons.sofa,
    'Tech help' => LucideIcons.laptop,
    'Yard & garden' => LucideIcons.sprout,
    _ => LucideIcons.hammer,
  };

  static String _categoryBlurb(String name) => switch (name) {
    'Repairs' => 'Small fixes around your home',
    'Home cleaning' => 'Fresh starts, one room at a time',
    'Errands' => 'Shopping, pickups and deliveries',
    'Furniture assembly' => 'From box to built',
    'Tech help' => 'Devices, setup and troubleshooting',
    'Yard & garden' => 'A helping hand outdoors',
    _ => 'Everyday help nearby',
  };

  void _cancelSubscriptions() {
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    _subscriptions.clear();
    _jobsWatched = false;
  }

  // ------------------------------------------------------- session actions

  void enter(AppRole next, BuildContext context) {
    role.value = next;
    _persistRole(next);
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  void switchRole(AppRole next, BuildContext context) {
    role.value = next;
    _persistRole(next);
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  void _persistRole(AppRole next) {
    unawaited(
      FirestoreSync.saveProfile(
        name: userProfile.value.name,
        email: userProfile.value.email,
        phone: userProfile.value.phone,
        preferredName: userProfile.value.preferredName,
        role: switch (next) {
          AppRole.servmate => 'servmate',
          AppRole.admin => 'admin',
          AppRole.customer => 'customer',
        },
      ),
    );
  }

  /// Signs out of Firebase and clears the store. The auth stream then keeps
  /// the root gate on the welcome screen.
  Future<void> signOut(BuildContext context) async {
    _debounce?.cancel();
    await FirebaseAuthService.signOut();
    clear();
    if (context.mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }

  void openTab(BuildContext context, int index) {
    if (role.value == AppRole.customer) {
      customerTab.value = index;
    } else {
      mateTab.value = index;
    }
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  // ------------------------------------------------------ booking actions

  /// Requests a booking through the `createBooking` Cloud Function, which
  /// returns the authoritative pesos subtotal, 10% platform fee and total.
  /// The client never sends a fee.
  ///
  /// The server's strict schema also requires the structured address parts
  /// (unit/city/province/postalCode/placeType/arrivalInstructions). Those are
  /// threaded from the saved place that produced [address] — pass it as
  /// [serviceAddress], otherwise the matching entry in [addresses] is used —
  /// falling back to the profile's own location and, last, to the launch
  /// default area (same fallback `saveProfile` uses).
  Future<Booking> placeBooking({
    required Service service,
    required DateTime manilaStart,
    required int hours,
    required String address,
    required String notes,
    String paymentMethod = 'gcash',
    Address? serviceAddress,
  }) async {
    final source =
        serviceAddress ??
        addresses.value.where((a) => a.line == address).firstOrNull ??
        addresses.value.where((a) => a.isDefault).firstOrNull;
    final profile = userProfile.value;
    final fallback = defaultPhilippineLocation;
    final city = _firstOf([source?.city, profile.city, fallback.city]);
    final province = _firstOf([
      source?.province,
      profile.province,
      fallback.province,
    ]);
    final postalCode =
        [source?.postalCode, profile.postalCode, fallback.postalCode]
            .whereType<String>()
            .firstWhere(validatePhilippinePostalCode, orElse: () => '');
    final booking = await FirestoreSync.createBooking(
      service: service,
      manilaStart: manilaStart,
      hours: hours,
      address: address,
      notes: notes,
      paymentMethod: paymentMethod,
      unit: source?.unit ?? '',
      city: city,
      province: province,
      postalCode: postalCode,
      placeType: source?.placeTypeCode ?? 'home',
      arrivalInstructions: source?.detail ?? '',
      customer: userProfile.value.name,
    );
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), () {
      _debounce = null;
      unawaited(
        FirestoreSync.saveProfile(
          name: userProfile.value.name,
          email: userProfile.value.email,
          phone: userProfile.value.phone,
          preferredName: userProfile.value.preferredName,
        ),
      );
    });

    upcomingBookings.value = [
      booking,
      ...upcomingBookings.value.where((b) => b.docId != booking.docId),
    ];
    justBooked = booking.id;
    notifications.value = [
      AppNotification(
        id: 'local-${booking.docId}',
        icon: LucideIcons.calendarCheck,
        title: 'Booking requested: ${service.title}',
        body:
            '${booking.when} with ${service.provider.name}. '
            'Awaiting provider acceptance.',
        when: 'Just now',
      ),
      ...notifications.value,
    ];
    return booking;
  }

  /// First non-empty value, used when threading address parts with fallbacks.
  static String _firstOf(List<String?> values) => values
      .whereType<String>()
      .firstWhere((value) => value.trim().isNotEmpty, orElse: () => '');

  Future<void> cancelBooking(String bookingId, String reason) async {
    final target = _findBooking(bookingId);
    if (target == null) return;
    await FirestoreSync.updateBookingStatus(
      docId: _docIdOf(target),
      action: 'cancel',
      reason: reason,
    );
    upcomingBookings.value = upcomingBookings.value
        .where((b) => b.id != bookingId)
        .toList();
    activeBookings.value = activeBookings.value
        .where((b) => b.id != bookingId)
        .toList();
    cancelledBookings.value = [
      target.copyWith(status: BookingStatus.cancelled),
      ...cancelledBookings.value,
    ];
  }

  Future<void> rescheduleBooking(
    String bookingId,
    DateTime manilaStart,
    int hours,
  ) async {
    final upcoming = [...upcomingBookings.value];
    final idx = upcoming.indexWhere((b) => b.id == bookingId);
    if (idx == -1) return;
    final when = formatManilaSlot(manilaStart: manilaStart, hours: hours);
    final (newDate, newTime) = FirestoreSync.manilaSlotPair(manilaStart);
    await FirestoreSync.updateBookingStatus(
      docId: _docIdOf(upcoming[idx]),
      action: 'reschedule',
      newDate: newDate,
      newTime: newTime,
    );
    upcoming[idx] = upcoming[idx].copyWith(
      when: when,
      startsAt: manilaStart,
      status: BookingStatus.confirmed,
    );
    upcomingBookings.value = upcoming;
  }

  Booking? _findBooking(String id) {
    for (final booking in [
      ...upcomingBookings.value,
      ...activeBookings.value,
      ...completedBookings.value,
      ...cancelledBookings.value,
    ]) {
      if (booking.id == id || booking.docId == id) return booking;
    }
    return null;
  }

  String _docIdOf(Booking booking) =>
      booking.docId.isNotEmpty ? booking.docId : booking.id;

  // ------------------------------------------------ ServMate job workflow

  Future<void> acceptRequest(String requestId) async {
    final reqs = [...jobRequests.value];
    final idx = reqs.indexWhere((r) => r.id == requestId);
    if (idx == -1) return;
    final req = reqs.removeAt(idx);
    await FirestoreSync.updateBookingStatus(
      docId: req.docId.isNotEmpty ? req.docId : req.id,
      action: 'accept',
    );
    jobRequests.value = reqs;
    respondedRequests.value = [
      req.copyWith(status: BookingStatus.confirmed),
      ...respondedRequests.value,
    ];
    upcomingJobs.value = [
      Job(
        docId: req.docId,
        title: req.title,
        customer: req.customer,
        when: req.when,
        price: req.price,
        area: req.area,
        distanceKm: req.distanceKm,
        status: BookingStatus.confirmed,
        asset: req.asset,
        address: req.area,
      ),
      ...upcomingJobs.value,
    ];
  }

  Future<void> declineRequest(String requestId) async {
    final reqs = [...jobRequests.value];
    final idx = reqs.indexWhere((r) => r.id == requestId);
    if (idx == -1) return;
    final req = reqs.removeAt(idx);
    await FirestoreSync.updateBookingStatus(
      docId: req.docId.isNotEmpty ? req.docId : req.id,
      action: 'cancel',
      reason: 'Declined by ServMate',
    );
    jobRequests.value = reqs;
    respondedRequests.value = [
      req.copyWith(status: BookingStatus.cancelled),
      ...respondedRequests.value,
    ];
  }

  Future<void> startJobJourney(Job job) async {
    final upcoming = [...upcomingJobs.value];
    final idx = upcoming.indexWhere(
      (j) => j.docId == job.docId && j.title == job.title,
    );
    if (idx == -1) return;
    // The server's `updateBookingStatus` only accepts
    // cancel/reschedule/complete/accept — there is no client-callable action
    // that moves a booking to `in_progress`. The journey is therefore
    // optimistic on-device state; `completeJob` is what persists.
    debugPrint(
      '[app-state] startJobJourney kept on-device: '
      'server has no in_progress transition for clients (${job.docId})',
    );
    final target = upcoming.removeAt(idx);
    upcomingJobs.value = upcoming;
    activeJobs.value = [
      target.copyWith(status: 'En Route'),
      ...activeJobs.value,
    ];
  }

  Future<void> cancelJob(Job job) async {
    await FirestoreSync.updateBookingStatus(
      docId: job.docId.isNotEmpty ? job.docId : job.title,
      action: 'cancel',
      reason: 'Cancelled by ServMate',
    );
    final upcoming = [...upcomingJobs.value]
      ..removeWhere((j) => j.docId == job.docId && j.title == job.title);
    final active = [...activeJobs.value]
      ..removeWhere((j) => j.docId == job.docId && j.title == job.title);
    upcomingJobs.value = upcoming;
    activeJobs.value = active;
    historyJobs.value = [
      job.copyWith(status: BookingStatus.cancelled),
      ...historyJobs.value,
    ];
  }

  Future<void> updateActiveJobStage(Job job, String stage) async {
    final active = [...activeJobs.value];
    final idx = active.indexWhere(
      (j) => j.docId == job.docId && j.title == job.title,
    );
    if (idx == -1) return;
    // 'Arrived' / 'In progress' have no server action (see [startJobJourney]):
    // stage progress stays on-device until `completeJob` persists `complete`.
    active[idx] = active[idx].copyWith(status: stage);
    activeJobs.value = active;
  }

  /// Completes a job. `updateBookingStatus` finalises the payout server-side;
  /// the optimistic balance bump below is immediately corrected by the
  /// `withdrawals`/`payments` stream.
  Future<void> completeJob(Job job, {double? earnings}) async {
    final amount = earnings ?? job.price;
    await FirestoreSync.updateBookingStatus(
      docId: job.docId.isNotEmpty ? job.docId : job.title,
      action: 'complete',
    );
    final active = [...activeJobs.value];
    final idx = active.indexWhere(
      (j) => j.docId == job.docId && j.title == job.title,
    );
    if (idx != -1) {
      final target = active.removeAt(idx);
      activeJobs.value = active;
      historyJobs.value = [
        target.copyWith(status: BookingStatus.completed),
        ...historyJobs.value,
      ];
    } else {
      historyJobs.value = [
        job.copyWith(status: BookingStatus.completed),
        ...historyJobs.value,
      ];
    }
    availableBalance.value += amount;
    todayEarnings.value += amount;
    totalEarnings.value += amount;
    transactions.value = [
      TransactionRecord(
        title: job.title,
        subtitle: '${job.customer} · Just now · Completed',
        amountValue: amount,
      ),
      ...transactions.value,
    ];
  }

  /// Requests a payout through `requestPayout`. Throws when the function
  /// rejects the amount or rail so the caller can show it. The server schema
  /// is `{ amount }` only — the rail stays a display detail of the local
  /// ledger row until the payout is settled.
  Future<void> withdrawEarnings(double amount, String method) async {
    await FirestoreSync.requestPayout(amount: amount);
    availableBalance.value -= amount;
    transactions.value = [
      TransactionRecord(
        title: 'Payout via ${paymentMethodLabel(method)}',
        subtitle: 'Requested just now',
        amountValue: -amount,
        isWithdrawal: true,
      ),
      ...transactions.value,
    ];
  }

  // -------------------------------------------------- profile & addresses

  Future<void> updateUserProfile({
    String? name,
    String? email,
    String? phone,
    String? preferredName,
    PhilippineLocation? location,
  }) async {
    final normalisedPhone = phone == null
        ? null
        : normalizePhilippineMobile(phone) ??
              (phone.trim().isEmpty ? '' : null);
    if (phone != null && phone.trim().isNotEmpty && normalisedPhone == null) {
      throw const FirestoreSyncException(
        code: 'invalid-argument',
        message: 'Enter a Philippine mobile number, e.g. 0917 123 4567.',
      );
    }
    await FirestoreSync.saveProfile(
      name: name,
      email: email,
      phone: normalisedPhone,
      preferredName: preferredName,
      location: location,
      role: switch (role.value) {
        AppRole.servmate => 'servmate',
        AppRole.admin => 'admin',
        _ => 'customer',
      },
    );
    userProfile.value = userProfile.value.copyWith(
      name: name,
      email: email,
      phone: normalisedPhone,
      preferredName: preferredName,
      barangay: location?.barangay,
      city: location?.city,
      province: location?.province,
      postalCode: location?.postalCode,
    );
  }

  Future<void> updateMateProfile({
    String? name,
    String? bio,
    String? area,
    List<String>? tags,
  }) async {
    mateProfile.value = mateProfile.value.copyWith(
      name: name,
      bio: bio,
      area: area,
      tags: tags,
    );
  }

  Future<void> addAddress(Address address) async {
    await FirestoreSync.saveAddress(
      address.copyWith(
        id: address.id.isEmpty
            ? '${userId.value}-${DateTime.now().millisecondsSinceEpoch}'
            : address.id,
      ),
    );
    if (address.isDefault) {
      addresses.value = [
        address,
        ...addresses.value.map((a) => a.copyWith(isDefault: false)),
      ];
    } else {
      addresses.value = [...addresses.value, address];
    }
  }

  Future<void> removeAddress(int index) async {
    if (index < 0 || index >= addresses.value.length) return;
    final list = [...addresses.value];
    final removed = list.removeAt(index);
    if (removed.id.isNotEmpty) {
      await FirestoreSync.deleteAddress(removed.id);
    }
    addresses.value = list;
  }

  Future<void> updateAddress(int index, Address address) async {
    if (index < 0 || index >= addresses.value.length) return;
    await FirestoreSync.saveAddress(address);
    final list = [...addresses.value];
    list[index] = address;
    addresses.value = list;
  }

  // ------------------------------------------------------------ bookmarks

  Future<void> toggleSavedService(String serviceTitle) async {
    final set = Set<String>.from(savedServices.value);
    if (!set.remove(serviceTitle)) set.add(serviceTitle);
    savedServices.value = set;
    await FirestoreSync.saveSavedSets(services: set, mates: savedMates.value);
  }

  Future<void> toggleSavedMate(String mateName) async {
    final set = Set<String>.from(savedMates.value);
    if (!set.remove(mateName)) set.add(mateName);
    savedMates.value = set;
    await FirestoreSync.saveSavedSets(
      services: savedServices.value,
      mates: set,
    );
  }

  // -------------------------------------------------------------- messages

  Future<void> sendChatMessage(
    String participantName,
    String text,
    String threadId,
  ) async {
    await FirestoreSync.sendMessage(threadId: threadId, text: text);
    final map = Map<String, List<ChatLine>>.from(chatMessages.value);
    final lines = [...map[participantName] ?? const <ChatLine>[]];
    lines.add(
      ChatLine(text, formatManilaTime(manilaNow()), mine: true, read: true),
    );
    map[participantName] = lines;
    chatMessages.value = map;

    for (final notifier in [customerThreads, mateThreads]) {
      final threads = [...notifier.value];
      final idx = threads.indexWhere((t) => t.name == participantName);
      if (idx != -1) {
        threads[idx] = threads[idx].copyWith(
          preview: text,
          when: 'Just now',
          unread: false,
        );
        notifier.value = threads;
      }
    }
  }

  /// Loads a conversation's messages from the `threads/{id}/messages`
  /// subcollection written by the `sendMessage` Cloud Function
  /// (`senderUid`, `text`, `createdAt`).
  Future<void> loadConversation(String threadId, String peerName) async {
    try {
      final raw = await FirestoreSync.messagesStream(threadId).first;
      final lines = raw.map((message) {
        final from =
            (message['senderUid'] as String?) ??
            (message['from'] as String?) ??
            '';
        return ChatLine(
          (message['text'] as String?) ?? '',
          formatManilaRelative(
            message['createdAt'] ?? message['sentAt'] ?? DateTime.now(),
          ),
          mine: from == userId.value || from == 'me',
          read: true,
        );
      }).toList();
      chatMessages.value = {...chatMessages.value, peerName: lines};
    } catch (problem) {
      _fail(problem);
    }
  }

  // --------------------------------------------------------------- reviews

  Future<void> addReview({
    required String providerName,
    required String servmateId,
    required int rating,
    required String text,
    required String serviceTitle,
  }) async {
    final author = userProfile.value.name.isEmpty
        ? 'ServEm customer'
        : userProfile.value.name;
    final record = ReviewRecord(
      author: author,
      rating: rating,
      date: formatManilaDateTime(manilaNow(), withTime: false),
      text: text,
      serviceTitle: serviceTitle,
    );
    final map = Map<String, List<ReviewRecord>>.from(reviews.value);
    map[providerName] = [record, ...map[providerName] ?? const []];
    reviews.value = map;

    final updated = await FirestoreSync.updateServmateRating(
      servmateId: servmateId,
      rating: rating,
      review: record,
    );
    if (updated != null && mateProfile.value.id == servmateId) {
      mateProfile.value = mateProfile.value.copyWith(
        rating: updated.$1,
        reviews: updated.$2,
      );
    }
  }

  // ------------------------------------------------------------- catalogue

  Future<void> addService(Service newService) async {
    await FirestoreSync.saveService(newService);
    services.value = [...services.value, newService];
    categories.value = _buildCategories(services.value);
  }

  Future<void> setAvailableForWork(bool available) async {
    availableForWork.value = available;
    await FirestoreSync.setServmateAvailability(available);
  }

  Future<void> saveSettings() => FirestoreSync.savePreferences(
    bookingNotifications: bookingNotifications.value,
    messageAlerts: messageAlerts.value,
    recommendations: recommendations.value,
  );

  Future<void> markAllNotificationsRead({bool forServMate = false}) async {
    if (forServMate) {
      mateNotifications.value = const [];
    } else {
      notifications.value = const [];
    }
    await FirestoreSync.markNotificationsRead();
  }

  /// Loads the ServMate-side job list. `createBooking` stores the provider's
  /// Firebase Auth uid in `bookings.providerId`, so provider queries filter
  /// on the signed-in uid — not on a `servmates` document id.
  Future<void> watchJobs() async {
    if (_jobsWatched || userId.value == null) return;
    _jobsWatched = true;
    final providerUid = userId.value!;
    _subscriptions.add(
      FirestoreSync.jobsStream(providerUid).listen((list) {
        final jobs = list.map((b) => Job.fromBooking(b)).toList();
        upcomingJobs.value = jobs
            .where(
              (j) =>
                  j.status == BookingStatus.confirmed ||
                  j.status == BookingStatus.awaitingProvider,
            )
            .toList();
        activeJobs.value = jobs
            .where((j) => j.status == BookingStatus.inProgress)
            .toList();
        historyJobs.value = jobs
            .where(
              (j) =>
                  j.status == BookingStatus.completed ||
                  j.status == BookingStatus.cancelled,
            )
            .toList();
      }, onError: _fail),
    );
    _subscriptions.add(
      FirestoreSync.inboundRequestsStream(providerUid).listen((list) {
        jobRequests.value = list.map((b) => JobRequest.fromBooking(b)).toList();
      }, onError: _fail),
    );
  }

  // --------------------------------------------------------------- legacy

  /// Kept for call sites that predate the reactive store; now a no-op because
  /// [onAuthChanged] opens the listeners itself.
  Future<void> syncFromFirebase() async {
    final user = FirebaseAuthService.currentUser;
    if (user == null) return;
    if (userId.value != user.uid) await onAuthChanged(user);
  }
}
