import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Startup state of the Firebase backend.
enum FirebaseStatus { notConfigured, ready, failed }

/// Firebase bootstrap for the mobile app.
///
/// The native app registrations (`google-services.json` on Android,
/// `GoogleService-Info.plist` on iOS) must belong to the same `servem-ph`
/// project the web app uses — see SETUP.md. Initialisation failure is surfaced
/// instead of silently running on sample data.
class FirebaseBootstrap {
  const FirebaseBootstrap._();

  static FirebaseStatus _status = FirebaseStatus.notConfigured;
  static bool _ready = false;
  static String? _initError;

  static FirebaseStatus get status => _status;
  static bool get isReady => _ready;
  static String? get initError => _initError;

  static Future<bool> initialize() async {
    if (_ready) return true;
    try {
      await Firebase.initializeApp();
      _ready = true;
      _status = FirebaseStatus.ready;
      _initError = null;
      return true;
    } catch (error) {
      _ready = false;
      _status = FirebaseStatus.failed;
      _initError = 'ServEm could not start Firebase on this device. Add the '
          'platform app registration (google-services.json / '
          'GoogleService-Info.plist) and restart the app.';
      debugPrint('[servem] Firebase init failed: $error');
      return false;
    }
  }
}
