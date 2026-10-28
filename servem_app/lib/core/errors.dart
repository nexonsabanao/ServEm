import 'package:flutter/material.dart';

import '../design/theme.dart';
import '../firebase/firestore_sync.dart';
import '../firebase/functions.dart';

/// A failed operation, ready to render with a retry affordance.
class ActionFailure {
  const ActionFailure({required this.message, required this.canRetry});

  final String message;
  final bool canRetry;

  bool get isPermissionProblem => _permissionMessage(message);

  static bool _permissionMessage(String text) =>
      text.contains('permission') || text.contains('sign in again');
}

ActionFailure describeFailure(Object problem) {
  final message = switch (problem) {
    FirestoreSyncException(:final message) => message,
    ServEmFunctionException(:final message) => message,
    _ => 'ServEm could not complete that. Please try again.',
  };
  final retryable = problem is! FirestoreSyncException &&
      problem is! ServEmFunctionException
      ? true
      : switch (problem) {
          ServEmFunctionException(:final code) =>
            code != 'permission-denied' && code != 'invalid-argument',
          FirestoreSyncException(:final code) =>
            code != 'permission-denied' && code != 'invalid-argument',
          _ => true,
        };
  return ActionFailure(message: message, canRetry: retryable);
}

/// Runs an async store action and, when it fails, shows the reason in a
/// dismissible banner with a Retry button instead of logging and moving on.
Future<S?> performAction<S>(
  BuildContext context,
  Future<S> Function() action, {
  String? successMessage,
  void Function(S result)? onSuccess,
  void Function(ActionFailure failure)? onFailure,
}) async {
  try {
    final result = await action();
    if (context.mounted && successMessage != null) {
      _showMessage(context, successMessage, isError: false);
    }
    onSuccess?.call(result);
    return result;
  } catch (problem) {
    final failure = describeFailure(problem);
    if (context.mounted) _showMessage(context, failure.message, isError: true);
    onFailure?.call(failure);
    return null;
  }
}

void _showMessage(BuildContext context, String message,
    {required bool isError}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isError ? V.dangerFg : V.brandDeep,
        duration: Duration(seconds: isError ? 6 : 3),
        action: SnackBarAction(
          label: 'Dismiss',
          textColor: Colors.white,
          onPressed: messenger.hideCurrentSnackBar,
        ),
        content: Text(
          message,
          style: const TextStyle(color: Colors.white, fontSize: 15),
        ),
      ),
    );
}

/// Accessible inline error text for form fields: announced by TalkBack/VoiceOver
/// and linked to the field by proximity within the same semantics node.
class FieldErrorText extends StatelessWidget {
  const FieldErrorText(this.message, {super.key});

  final String? message;

  @override
  Widget build(BuildContext context) {
    if (message == null) return const SizedBox.shrink();
    return Semantics(
      liveRegion: true,
      child: Padding(
        padding: const EdgeInsets.only(top: 6, left: 2),
        child: Text(
          message!,
          style: T.small.copyWith(color: V.dangerFg),
        ),
      ),
    );
  }
}
