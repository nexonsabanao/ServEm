import 'package:flutter/material.dart';

import 'app.dart';
import 'firebase/firebase_auth_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FirebaseBootstrap.initialize();
  runApp(const ServEmApp());
}
