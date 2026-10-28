/// The privileged operations the platform polices.
///
/// The mobile client writes them directly to Firestore and `firestore.rules`
/// re-checks the actor, the fee, the total and the status transitions. The enum
/// survives as the vocabulary for error copy.
enum ServEmFunction {
  createBooking('createBooking'),
  updateBookingStatus('updateBookingStatus'),
  sendMessage('sendMessage'),
  submitVerification('submitVerification'),
  requestPayout('requestPayout'),
  adminDecision('adminDecision');

  const ServEmFunction(this.name);
  final String name;
}

class ServEmFunctionException implements Exception {
  ServEmFunctionException({
    required this.function,
    required this.code,
    required this.message,
  });

  final ServEmFunction function;
  final String code;
  final String message;

  bool get isPermissionProblem =>
      code == 'permission-denied' || code == 'unauthenticated';

  @override
  String toString() => '${function.name}: $code — $message';
}

