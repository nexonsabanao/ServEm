import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:servem_app/design/components.dart';

/// App-shell tests for the chrome every screen shares. They deliberately avoid
/// Firebase: the signed-in flows are covered by the unit contract tests and by
/// the emulator, while these keep the frame itself honest on small screens.
void main() {
  testWidgets('the app bar shows its title', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: ServEmAppBar(title: 'Your bookings'))),
    );

    expect(find.text('Your bookings'), findsOneWidget);
  });

  testWidgets('a root screen can hide the back control', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: ServEmAppBar(title: 'ServEm', showBack: false)),
      ),
    );

    expect(find.text('ServEm'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back), findsNothing);
  });

  testWidgets('a screen scrolls instead of overflowing on a short phone', (tester) async {
    tester.view.physicalSize = const Size(320, 480);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: ScreenScaffold(
          title: 'Booking details',
          child: Column(
            children: [
              for (var index = 0; index < 20; index++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: ServCard(child: Text('Row $index')),
                ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Booking details'), findsOneWidget);
    expect(find.text('Row 0'), findsOneWidget);
  });
}
