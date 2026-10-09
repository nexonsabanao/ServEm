class AppConfig {
  const AppConfig({required this.apiBaseUrl});

  final Uri? apiBaseUrl;

  static AppConfig fromEnvironment() {
    const rawBaseUrl = String.fromEnvironment('API_BASE_URL');
    if (rawBaseUrl.isEmpty) {
      return const AppConfig(apiBaseUrl: null);
    }

    final uri = Uri.tryParse(rawBaseUrl);
    if (uri == null ||
        !uri.hasAuthority ||
        (uri.scheme != 'https' && uri.scheme != 'http')) {
      return const AppConfig(apiBaseUrl: null);
    }

    final path = uri.path.replaceFirst(RegExp(r'/$'), '');
    return AppConfig(apiBaseUrl: uri.replace(path: '$path/'));
  }
}
