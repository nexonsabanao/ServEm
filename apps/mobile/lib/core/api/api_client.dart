import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../app/configuration/app_config.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient({
    required AppConfig config,
    HttpClient? httpClient,
  })  : _baseUrl = config.apiBaseUrl,
        _httpClient = httpClient ?? HttpClient();

  final Uri? _baseUrl;
  final HttpClient _httpClient;

  Future<Map<String, Object?>> getJson(
    String path, {
    Map<String, String> query = const {},
  }) async {
    final baseUrl = _baseUrl;
    if (baseUrl == null) {
      throw const ApiNotConfiguredException();
    }

    final normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    final requestUri = baseUrl.resolve(normalizedPath).replace(
          queryParameters: query.isEmpty ? null : query,
        );

    try {
      final request = await _httpClient.getUrl(requestUri).timeout(
            const Duration(seconds: 12),
          );
      request.headers.accept.add('application/json');
      final response = await request.close().timeout(
            const Duration(seconds: 20),
          );
      final body = await utf8.decoder.bind(response).join().timeout(
            const Duration(seconds: 20),
          );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw _responseException(response.statusCode, body);
      }

      final decoded = jsonDecode(body);
      if (decoded is! Map<String, Object?>) {
        throw const ApiContractException();
      }
      return decoded;
    } on ApiException {
      rethrow;
    } on TimeoutException {
      throw const ApiNetworkException();
    } on SocketException {
      throw const ApiNetworkException();
    } on HttpException {
      throw const ApiNetworkException();
    } on FormatException {
      throw const ApiContractException();
    }
  }

  ApiResponseException _responseException(int statusCode, String body) {
    String? code;
    String? requestId;
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, Object?>) {
        code = decoded['code'] as String?;
        requestId = decoded['requestId'] as String?;
      }
    } on FormatException {
      // Error bodies may be empty or non-JSON. Do not surface their contents.
    }
    return ApiResponseException(
      statusCode: statusCode,
      code: code,
      requestId: requestId,
    );
  }

  void close() => _httpClient.close(force: true);
}
