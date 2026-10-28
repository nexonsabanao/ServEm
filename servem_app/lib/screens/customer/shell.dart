import 'package:flutter/material.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../account/profile.dart';
import '../bookings/list.dart';
import '../messages/list.dart';
import 'explore.dart';
import 'home.dart';

class CustomerShell extends StatelessWidget {
  const CustomerShell({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: Session.customerTab,
      builder: (context, index, _) {
        return Scaffold(
          backgroundColor: V.bg,
          body: IndexedStack(
            index: index,
            children: const [
              HomeTab(),
              ExploreTab(),
              BookingsTab(),
              MessagesTab(),
              ProfileTab(),
            ],
          ),
          bottomNavigationBar: BottomNav(
            items: customerNav,
            index: index,
            onChanged: (i) => Session.customerTab.value = i,
          ),
        );
      },
    );
  }
}
