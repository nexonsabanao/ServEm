import 'dart:async';

import 'data/app_state.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'core/errors.dart';
import 'core/localization.dart';
import 'design/components.dart';
import 'design/theme.dart';
import 'firebase/firebase_auth_service.dart';
import 'screens/admin/admin_console.dart';
import 'screens/auth/role_select.dart';
import 'screens/customer/shell.dart';
import 'screens/servmate/shell.dart';
import 'screens/welcome.dart';

export 'data/app_state.dart';
export 'design/components.dart';

/// Thin facade over the store so screens never touch `AppState` internals.
class Session {
  Session._();

  static AppState get store => AppState.instance;

  static ValueNotifier<AppRole?> get role => AppState.instance.role;
  static ValueNotifier<SessionStatus> get status => AppState.instance.status;
  static ValueNotifier<String?> get error => AppState.instance.error;
  static ValueNotifier<bool> get isAdmin => AppState.instance.isAdmin;
  static ValueNotifier<Set<String>> get savedServices =>
      AppState.instance.savedServices;
  static ValueNotifier<Set<String>> get savedMates =>
      AppState.instance.savedMates;
  static ValueNotifier<bool> get availableForWork =>
      AppState.instance.availableForWork;
  static ValueNotifier<int> get customerTab => AppState.instance.customerTab;
  static ValueNotifier<int> get mateTab => AppState.instance.mateTab;

  static String? get justBooked => AppState.instance.justBooked;
  static set justBooked(String? val) => AppState.instance.justBooked = val;

  static void enter(AppRole next, BuildContext context) =>
      AppState.instance.enter(next, context);

  static void switchRole(AppRole next, BuildContext context) =>
      AppState.instance.switchRole(next, context);

  static Future<void> signOut(BuildContext context) =>
      AppState.instance.signOut(context);

  static void openTab(BuildContext context, int index) =>
      AppState.instance.openTab(context, index);
}

class ServEmApp extends StatelessWidget {
  const ServEmApp({super.key});

  @override
  Widget build(BuildContext context) {
    SessionHooks.openCustomerTab = Session.openTab;
    SessionHooks.openMateTab = Session.openTab;
    return MaterialApp(
      title: 'ServEm',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      scrollBehavior: const _AppScrollBehavior(),
      home: const RootGate(),
    );
  }
}

class _AppScrollBehavior extends MaterialScrollBehavior {
  const _AppScrollBehavior();

  @override
  Widget buildOverscrollIndicator(
      BuildContext context, Widget child, ScrollableDetails details) {
    return child;
  }
}

/// Decides the starting screen from the **real** Firebase auth state.
///
///  * Firebase could not start on this platform → setup screen;
///  * signed out → welcome / login / sign-up (the store is empty);
///  * signed in with no role chosen → role select;
///  * signed in as customer / ServMate → the matching shell;
///  * the admin surface opens only when the ID token carries
///    `claims['admin'] == true` — never a locally stored flag.
class RootGate extends StatefulWidget {
  const RootGate({super.key});

  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> {
  StreamSubscription<AppUser?>? _subscription;
  AppUser? _user;
  bool _resolved = false;

  @override
  void initState() {
    super.initState();
    if (FirebaseBootstrap.isReady) {
      _subscription = FirebaseAuthService.authStateChanges().listen((user) {
        if (!mounted) return;
        setState(() {
          _user = user;
          _resolved = true;
        });
        unawaited(AppState.instance.onAuthChanged(user));
      });
    } else {
      _resolved = true;
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!FirebaseBootstrap.isReady) return const FirebaseSetupScreen();
    if (!_resolved) return const SplashGate();
    if (_user == null) return const WelcomeScreen();
    return const _RoleGate();
  }
}

/// Routes on the role stored in the signed-in user's Firestore profile, after a
/// Firestore read has resolved it. Errors surface with a Retry action.
class _RoleGate extends StatelessWidget {
  const _RoleGate();

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<SessionStatus>(
      valueListenable: Session.status,
      builder: (context, status, child) {
        if (status == SessionStatus.error) {
          return SessionErrorScreen(
            message: Session.error.value ??
                'ServEm could not load your account.',
            onRetry: () => AppState.instance.retry(),
          );
        }
        return child!;
      },
      child: ValueListenableBuilder<AppRole?>(
        valueListenable: Session.role,
        builder: (context, role, _) {
          if (role == null) {
            // Signed in but no role recorded on the profile yet: let the person
            // choose, which writes it back to Firestore.
            return Session.status.value == SessionStatus.connecting
                ? const SplashGate()
                : const RoleSelectScreen();
          }
          return ValueListenableBuilder<UserProfile>(
            valueListenable: AppState.instance.userProfile,
            builder: (context, profile, _) {
              if (profile.suspended) return const SuspendedAccountScreen();
              return switch (role) {
                AppRole.customer => const CustomerShell(),
                AppRole.servmate => const ServMateShell(),
                AppRole.admin => const AdminConsoleScreen(),
              };
            },
          );
        },
      ),
    );
  }
}

/// Neutral loading frame while the session and profile are being read.
class SplashGate extends StatelessWidget {
  const SplashGate({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: V.bg,
      body: SafeArea(
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(V.pad, 20, V.pad, 0),
              child: Row(
                children: [
                  ServEmLogo(size: 40),
                  Spacer(),
                  Skeleton(width: 72, height: 32, radius: 16),
                ],
              ),
            ),
            gap24,
            const Expanded(child: SingleChildScrollView(child: SkeletonList(rows: 4))),
            Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: Text('Loading your account…', style: T.bodyMuted),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shown when this platform has no Firebase app registration, so nobody is ever
/// handed a fake session.
class FirebaseSetupScreen extends StatefulWidget {
  const FirebaseSetupScreen({super.key});

  @override
  State<FirebaseSetupScreen> createState() => _FirebaseSetupScreenState();
}

class _FirebaseSetupScreenState extends State<FirebaseSetupScreen> {
  bool _busy = false;

  Future<void> _retry() async {
    setState(() => _busy = true);
    final ready = await FirebaseBootstrap.initialize();
    if (!mounted) return;
    setState(() => _busy = false);
    if (!ready) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            FirebaseBootstrap.initError ?? FirebaseAuthService.configurationProblem,
          ),
        ),
      );
      return;
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Firebase setup needed',
      bottom: CtaBar(
        label: _busy ? 'Trying…' : 'Try again',
        onPressed: _busy ? null : _retry,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const ServEmLogo(size: 44),
          gap20,
          Text('ServEm cannot start a session on this device.', style: T.h3),
          gap12,
          Text(
            FirebaseBootstrap.initError ?? FirebaseAuthService.configurationProblem,
            style: T.bodyMuted,
          ),
          gap18,
          const InfoBanner(
            icon: LucideIcons.settings,
            title: 'Project servem-ph',
            body:
                'Add the Firebase app registration for this platform '
                '(google-services.json or GoogleService-Info.plist) and relaunch. '
                'README.md lists the exact steps.',
          ),
          gap14,
          Text(
            'Time zone Asia/Manila · Currency Philippine peso · Locale $appLocale',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

/// A staff-suspended account: everything is readable, nothing can be created.
class SuspendedAccountScreen extends StatelessWidget {
  const SuspendedAccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Your account is paused',
      bottom: CtaBar(
        label: 'Sign out',
        onPressed: () => Session.signOut(context),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(LucideIcons.shieldAlert, size: 40),
          gap16,
          Text(
            'ServEm support paused this account, so new bookings, listings and '
            'messages are turned off until it is restored.',
            style: T.body.copyWith(fontSize: 16),
          ),
          gap14,
          Text(
            'Your existing bookings, messages and records are still here and '
            'readable. Reply to the support email you received to appeal.',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

/// A failed read/write with a visible reason and a retry action.
class SessionErrorScreen extends StatelessWidget {
  const SessionErrorScreen({
    super.key,
    required this.message,
    required this.onRetry,
  });

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'ServEm can’t load your data',
      bottom: CtaBar(
        label: 'Retry',
        onPressed: () => performAction(context, onRetry),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(LucideIcons.cloudOff, size: 40),
          gap16,
          Text(message, style: T.body.copyWith(fontSize: 16)),
          gap14,
          Text(
            'Your session is still active. Nothing was lost — ServEm simply '
            'could not read your bookings right now.',
            style: T.small,
          ),
          gap16,
          OutlineButton(
            label: 'Sign out instead',
            onPressed: () => Session.signOut(context),
          ),
        ],
      ),
    );
  }
}
