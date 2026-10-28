import 'package:flutter/material.dart';

import '../../app.dart';
import '../../design/theme.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ShellScreen(
      title: 'Notifications',
      navIndex: 4,
      child: ValueListenableBuilder<List<AppNotification>>(
        valueListenable: AppState.instance.notifications,
        builder: (context, notifications, _) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Text('Today', style: T.section),
                  const Spacer(),
                  GestureDetector(
                    onTap: () {
                      AppState.instance.markAllNotificationsRead();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('All notifications marked as read.'),
                          backgroundColor: V.brandDeep,
                        ),
                      );
                    },
                    child: Text('Mark all as read', style: T.link),
                  ),
                ],
              ),
              gap14,
              if (notifications.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(
                    child: Text('No new notifications.', style: T.bodyMuted),
                  ),
                )
              else
                for (var i = 0; i < notifications.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _NotificationRow(item: notifications[i]),
                ],
            ],
          );
        },
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({required this.item});

  final AppNotification item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: V.tint,
              borderRadius: BorderRadius.circular(15),
            ),
            child: Icon(item.icon, size: 22, color: V.brand),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        style: T.cardTitle.copyWith(fontSize: 16.5),
                      ),
                    ),
                    Text(item.when, style: T.micro.copyWith(fontSize: 13)),
                  ],
                ),
                gap6,
                Text(
                  item.body,
                  style: T.bodyMuted.copyWith(fontSize: 14.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
