import 'package:flutter/material.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../states/states.dart';
import 'chat.dart';

class CustomerMessagesScreen extends StatefulWidget {
  const CustomerMessagesScreen({super.key});

  @override
  State<CustomerMessagesScreen> createState() => _CustomerMessagesScreenState();
}

class _CustomerMessagesScreenState extends State<CustomerMessagesScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Customer messages',
      child: ValueListenableBuilder<List<Thread>>(
        valueListenable: AppState.instance.customerThreads,
        builder: (context, threads, _) {
          final needle = _query.trim().toLowerCase();
          final matches = needle.isEmpty
              ? threads
              : threads
                  .where((thread) => thread.name.toLowerCase().contains(needle))
                  .toList();

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SearchBox(
                hint: 'Search customer messages',
                onChanged: (value) => setState(() => _query = value),
              ),
              gap14,
              const Align(
                alignment: Alignment.centerLeft,
                child: StatusBadge('ServMate inbox'),
              ),
              gap6,
              if (threads.isEmpty && Session.status.value == SessionStatus.connecting)
                const SkeletonList(rows: 3, padding: EdgeInsets.zero)
              else if (matches.isEmpty)
                EmptyResults(
                  title: needle.isEmpty
                      ? 'No customer messages yet'
                      : 'No messages match that name',
                  body: needle.isEmpty
                      ? 'When a customer books you, the conversation appears here with the job details.'
                      : 'Try another name, or clear the search to see every conversation.',
                  actionLabel: needle.isEmpty ? null : 'Clear search',
                  onAction: needle.isEmpty ? null : () => setState(() => _query = ''),
                )
              else
                for (var i = 0; i < matches.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _Row(thread: matches[i]),
                ],
              gap18,
              const InfoBanner(
                title: 'Keep it in ServEm',
                body:
                    'Messages are available from your dashboard and job details. There’s no extra navigation tab.',
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.thread});

  final Thread thread;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => go(
        context,
        ChatScreen(
          name: thread.name,
          initials: thread.initials,
          roleLabel: 'Customer',
          service: thread.service,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Avatar('', size: 56, initials: thread.initials),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          thread.name,
                          style: T.cardTitle.copyWith(fontSize: 17.5),
                        ),
                      ),
                      Text(thread.when, style: T.micro.copyWith(fontSize: 13)),
                    ],
                  ),
                  gap4,
                  Text(
                    thread.service,
                    style: T.small.copyWith(color: V.brand, fontSize: 14),
                  ),
                  gap6,
                  Text(
                    thread.preview,
                    style: T.bodyMuted.copyWith(fontSize: 15),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
