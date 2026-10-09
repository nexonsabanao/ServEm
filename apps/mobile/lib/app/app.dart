import 'package:flutter/material.dart';

import '../core/api/api_client.dart';
import '../features/search/data/services_repository.dart';
import '../features/search/presentation/discover_screen.dart';
import 'configuration/app_config.dart';
import 'theme/app_theme.dart';

class ServEmApp extends StatefulWidget {
  const ServEmApp({super.key});

  @override
  State<ServEmApp> createState() => _ServEmAppState();
}

class _ServEmAppState extends State<ServEmApp> {
  late final ApiClient _apiClient;
  late final ServicesRepository _servicesRepository;

  @override
  void initState() {
    super.initState();
    _apiClient = ApiClient(config: AppConfig.fromEnvironment());
    _servicesRepository = ServicesRepository(_apiClient);
  }

  @override
  void dispose() {
    _apiClient.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ServEm',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: DiscoverScreen(repository: _servicesRepository),
    );
  }
}
