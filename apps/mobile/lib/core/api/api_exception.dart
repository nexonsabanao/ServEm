sealed class ApiException implements Exception {
  const ApiException(this.message);

  final String message;
}

final class ApiNotConfiguredException extends ApiException {
  const ApiNotConfiguredException()
      : super('The app API address has not been configured.');
}

final class ApiNetworkException extends ApiException {
  const ApiNetworkException()
      : super('We could not reach ServEm. Check your connection and try again.');
}

final class ApiResponseException extends ApiException {
  const ApiResponseException({
    required this.statusCode,
    required this.code,
    required this.requestId,
  }) : super('ServEm could not complete this request.');

  final int statusCode;
  final String? code;
  final String? requestId;
}

final class ApiContractException extends ApiException {
  const ApiContractException()
      : super('ServEm returned data in an unexpected format.');
}
