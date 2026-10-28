import 'package:flutter/material.dart';

import '../../app.dart';
import '../../design/theme.dart';
import 'dashboard.dart';
import 'earnings.dart';
import 'jobs.dart';
import 'profile.dart';
import 'requests.dart';

class ServMateShell extends StatelessWidget {
  const ServMateShell({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: Session.mateTab,
      builder: (context, index, _) {
        return Scaffold(
          backgroundColor: V.bg,
          body: IndexedStack(
            index: index,
            children: const [
              DashboardTab(),
              RequestsTab(),
              MyJobsTab(),
              EarningsTab(),
              MateProfileTab(),
            ],
          ),
          bottomNavigationBar: BottomNav(
            items: mateNav,
            index: index,
            onChanged: (i) => Session.mateTab.value = i,
          ),
        );
      },
    );
  }
}
