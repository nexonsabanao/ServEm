import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import 'firebase_config.dart';

export 'firebase_config.dart' show FirebaseBootstrap, FirebaseStatus;

/// The slice of the signed-in account the app renders.
class AppUser {
  const AppUser({
    required this.uid,
    required this.displayName,
    required this.email,
    required this.photoURL,
    required this.phoneNumber,
    required this.emailVerified,
  });

  final String uid;
  final String? displayName;
  final String? email;
  final String? photoURL;
  final String? phoneNumber;
  final bool emailVerified;

  factory AppUser.from(User user) => AppUser(
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
      );
}


class FirebaseAuthService {
  const FirebaseAuthService._();

  static bool get isAvailable => FirebaseBootstrap.isReady;

  static User? get _user => isAvailable ? FirebaseAuth.instance.currentUser : null;

  static AppUser? get currentUser {
    final user = _user;
    return user == null ? null : AppUser.from(user);
  }

  static String? get uid => _user?.uid;

  static Stream<AppUser?> authStateChanges() async* {
    if (!isAvailable) {
      yield null;
      return;
    }
    yield currentUser;
    yield* FirebaseAuth.instance.authStateChanges().map(
          (user) => user == null ? null : AppUser.from(user),
        );
  }

  static Future<Map<String, Object?>> idTokenClaims({bool refresh = false}) async {
    final user = _user;
    if (user == null) return const {};
    try {
      final token = await user.getIdTokenResult(refresh);
      return Map<String, Object?>.from(token.claims ?? const {});
    } catch (error) {
      debugPrint('[servem] claim lookup failed: $error');
      return const {};
    }
  }

  static Future<bool> isAdmin() async =>
      (await idTokenClaims(refresh: true))['admin'] == true;

  /// Returns null on success, otherwise copy to show under the form.
  static Future<String?> signIn(String email, String password) async {
    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(email: email.trim(), password: password);
      return null;
    } on FirebaseAuthException catch (error) {
      return friendlyError(error.code, error.message);
    } catch (error) {
      return friendlyError('internal', '$error');
    }
  }

  static Future<String?> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  }) async {
    final problem = PasswordRules.validate(password);
    if (problem != null) return problem;
    try {
      final credential = await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      await credential.user?.updateDisplayName(name.trim());
      if (phone != null && phone.trim().isNotEmpty) {
        // Stored on the profile document by the caller; the auth record keeps
        // the email only.
        debugPrint('[servem] phone saved to profile for ${credential.user?.uid}');
      }
      return null;
    } on FirebaseAuthException catch (error) {
      return friendlyError(error.code, error.message);
    } catch (error) {
      return friendlyError('internal', '$error');
    }
  }

  /// Google runs through Firebase's browser flow, so no extra plugin is needed.
  static Future<String?> signInWithGoogle() async {
    try {
      await FirebaseAuth.instance.signInWithProvider(GoogleAuthProvider());
      return null;
    } on FirebaseAuthException catch (error) {
      return friendlyError(error.code, error.message);
    } catch (error) {
      return friendlyError('internal', '$error');
    }
  }

  /// Sends the verification mail again. Returns null on success.
  static Future<String?> resendVerificationEmail() async {
    final user = _user;
    if (user == null) return 'Sign in again to confirm your email.';
    if (user.emailVerified) return null;
    try {
      await user.sendEmailVerification();
      return null;
    } on FirebaseAuthException catch (error) {
      return friendlyError(error.code, error.message);
    } catch (error) {
      return error.toString();
    }
  }

  /// Re-reads the account from Firebase so a confirmed address is seen.
  static Future<bool> isEmailVerifiedNow() async {
    final user = _user;
    if (user == null) return false;
    try {
      await user.reload();
      return FirebaseAuth.instance.currentUser?.emailVerified ?? false;
    } catch (error) {
      debugPrint('[servem] verification refresh failed: $error');
      return user.emailVerified;
    }
  }

  static Future<String?> resetPassword(String email) async {
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: email.trim());
      return null;
    } on FirebaseAuthException catch (error) {
      return friendlyError(error.code, error.message);
    } catch (error) {
      return friendlyError('internal', '$error');
    }
  }

  static Future<void> signOut() async {
    if (!isAvailable) return;
    await FirebaseAuth.instance.signOut();
  }

  static String get configurationProblem =>
      FirebaseBootstrap.initError ??
      'ServEm could not start Firebase on this device. Add the platform app '
          'registration and restart the app.';

  static String friendlyError(String code, String? message) {
    switch (code) {
      case 'invalid-email':
        return 'That email address does not look right.';
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
        return 'Email or password is incorrect.';
      case 'email-already-in-use':
        return 'An account already exists with that email.';
      case 'weak-password':
        return PasswordRules.problem;
      case 'operation-not-allowed':
        return 'That sign-in method is not enabled in Firebase yet.';
      case 'requires-recent-login':
        return 'Please sign in again before making this change.';
      case 'too-many-requests':
        return 'Too many attempts. Please wait a minute and try again.';
      case 'network-request-failed':
        return 'Network unavailable. Check your connection and try again.';
      case 'user-disabled':
        return 'This ServEm account has been disabled. Contact support.';
      default:
        return message ?? 'Something went wrong. Please try again.';
    }
  }
}

/// Password policy, mirrored from the web client.
class PasswordRules {
  const PasswordRules._();

  static const int minLength = 10;

  static String get problem =>
      'Use at least $minLength characters, including one letter and one number.';

  static String? validate(String password) {
    if (password.isEmpty) return 'Enter a password.';
    if (password.length < minLength) return 'Use at least $minLength characters.';
    if (!RegExp(r'[A-Za-z]').hasMatch(password) || !RegExp(r'\d').hasMatch(password)) {
      return 'Include at least one letter and one number.';
    }
    return null;
  }

  static int strength(String password) {
    if (password.isEmpty) return 0;
    var score = 0;
    if (password.length >= minLength) score++;
    if (password.length >= 14) score++;
    if (RegExp(r'[A-Za-z]').hasMatch(password) && RegExp(r'\d').hasMatch(password)) score++;
    if (RegExp(r'[^A-Za-z0-9]').hasMatch(password)) score++;
    return score.clamp(0, 4);
  }
}
