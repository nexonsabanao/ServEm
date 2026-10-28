import 'package:flutter/material.dart';

import '../app.dart';
import '../design/components.dart';
import '../design/theme.dart';
import 'auth/create_account.dart';
import 'auth/login.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: V.bg,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final heroHeight = (constraints.maxHeight * 0.36).clamp(180.0, 300.0);
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(V.pad, 6, V.pad, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const ServEmLogo(size: 44),
                      const SizedBox(height: 32),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: Image.asset(
                          'assets/images/hero_welcome.jpg',
                          height: heroHeight,
                          width: double.infinity,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(height: 30),
                      Text('Find help. Share\nyour skills.', style: T.display),
                      const SizedBox(height: 16),
                      Text(
                        'Good people. Everyday tasks, taken care of.',
                        style: T.bodyMuted,
                      ),
                      const SizedBox(height: 32),
                      PrimaryButton(
                        label: 'Get Started',
                        onPressed: () => go(context, const CreateAccountScreen()),
                      ),
                      const SizedBox(height: 12),
                      SecondaryButton(
                        label: 'Log In',
                        onPressed: () => go(context, const LoginScreen()),
                      ),
                      const SizedBox(height: 26),
                      Center(
                        child: Text(
                          'Local skills. A little peace of mind.',
                          style: T.small,
                        ),
                      ),
                      const SizedBox(height: 4),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
