import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:servem_app/app.dart';
import 'package:servem_app/screens/states/states.dart';

/// Responsive smoke tests: the shared blocks the product leans on must render
/// on the narrowest phone and on a tablet without throwing or overflowing.
Widget _host(Widget child) => MaterialApp(
  home: Scaffold(
    body: SingleChildScrollView(
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    ),
  ),
);

void main() {
  for (final width in <double>[320, 360, 414, 768, 1024]) {
    testWidgets('empty state fits a ${width.toInt()}px screen', (tester) async {
      tester.view.physicalSize = Size(width, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _host(
          const StateBlock(
            icon: Icons.inbox_outlined,
            title: 'No bookings yet',
            body: 'When you book a ServMate, the job and its updates appear here.',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('No bookings yet'), findsOneWidget);
    });

    testWidgets('primary action stays readable at ${width.toInt()}px', (
      tester,
    ) async {
      tester.view.physicalSize = Size(width, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _host(PrimaryButton(label: 'Request a booking', onPressed: () {})),
      );

      expect(find.text('Request a booking'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('badge and chip keep their labels', (tester) async {
    await tester.pumpWidget(
      _host(
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            StatusBadge('Confirmed'),
            SizedBox(height: 12),
            ServChip(label: 'On time', selected: true),
          ],
        ),
      ),
    );

    expect(find.text('Confirmed'), findsOneWidget);
    expect(find.text('On time'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a loading list shows skeletons instead of an empty gap', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(const SkeletonList(rows: 3, padding: EdgeInsets.zero)),
    );
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byType(Skeleton), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('skeletons render with reduced motion enabled', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: const Scaffold(
            body: Center(child: Skeleton(width: 120, height: 18)),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.byType(Skeleton), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('screen content fills a phone and is clamped on a wide window', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    tester.view.physicalSize = const Size(390, 844);
    await tester.pumpWidget(
      const MaterialApp(
        home: ScreenScaffold(
          title: 'Bookings',
          child: SizedBox(
            key: Key('content'),
            height: 40,
            width: double.infinity,
          ),
        ),
      ),
    );
    // On a phone the content uses the space it has (390 minus the page padding).
    expect(
      tester.getSize(find.byKey(const Key('content'))).width,
      lessThanOrEqualTo(390),
    );

    tester.view.physicalSize = const Size(1280, 900);
    await tester.pumpAndSettle();
    // On a wide window it is clamped to a readable measure instead of stretching.
    expect(tester.getSize(find.byKey(const Key('content'))).width, 560);
    expect(tester.takeException(), isNull);
  });

  group('shared states', () {
    testWidgets('an empty result explains itself and offers the next step', (
      tester,
    ) async {
      var cleared = false;
      await tester.pumpWidget(
        _host(
          EmptyResults(
            actionLabel: 'Show all services',
            onAction: () => cleared = true,
          ),
        ),
      );

      expect(find.text('No matches just yet'), findsOneWidget);
      await tester.tap(find.text('Show all services'));
      expect(cleared, isTrue);
      expect(tester.takeException(), isNull);
    });

    testWidgets('an empty result without a next step shows no button', (
      tester,
    ) async {
      await tester.pumpWidget(_host(const EmptyResults()));

      expect(find.text('No matches just yet'), findsOneWidget);
      expect(find.byType(SecondaryButton), findsNothing);
    });

    testWidgets('a failed load retries', (tester) async {
      var retried = 0;
      await tester.pumpWidget(_host(LoadFailed(onRetry: () => retried += 1)));

      expect(find.text('That did not load'), findsOneWidget);
      await tester.tap(find.text('Try again'));
      expect(retried, 1);
    });

    testWidgets('offline says nothing was lost', (tester) async {
      await tester.pumpWidget(_host(OfflineNotice(onRetry: () {})));

      expect(find.text('You are offline'), findsOneWidget);
      expect(find.textContaining('nothing was lost'), findsOneWidget);
    });
  });

  group('account suspension', () {
    testWidgets('a suspended account is told what is paused, at every width', (
      tester,
    ) async {
      for (final width in <double>[320, 414, 1024]) {
        tester.view.physicalSize = Size(width, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          const MaterialApp(home: SuspendedAccountScreen()),
        );
        await tester.pumpAndSettle();

        expect(
          tester.takeException(),
          isNull,
          reason: 'threw at ${width.toInt()}px',
        );
        expect(find.textContaining('paused'), findsWidgets);
        expect(find.textContaining('readable'), findsWidgets);
      }
    });

    test('the profile reads the staff suspension flag', () {
      expect(UserProfile.fromMap('uid', {'name': 'Member'}).suspended, isFalse);
      expect(
        UserProfile.fromMap('uid', {
          'name': 'Member',
          'status': 'active',
        }).suspended,
        isFalse,
      );
      expect(
        UserProfile.fromMap('uid', {
          'name': 'Member',
          'status': 'suspended',
        }).suspended,
        isTrue,
      );
    });
  });
}
