import 'package:flutter/material.dart';

import '../../app.dart';
import '../../design/theme.dart';
import 'chat.dart';

class MessagesTab extends StatefulWidget {
  const MessagesTab({super.key});

  @override
  State<MessagesTab> createState() => _MessagesTabState();
}

class _MessagesTabState extends State<MessagesTab> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ValueListenableBuilder<List<Thread>>(
        valueListenable: AppState.instance.customerThreads,
        builder: (context, threads, _) {
          final query = _search.text.trim().toLowerCase();
          final filtered = threads.where((t) {
            if (query.isEmpty) return true;
            return t.name.toLowerCase().contains(query) ||
                t.service.toLowerCase().contains(query) ||
                t.preview.toLowerCase().contains(query);
          }).toList();

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(V.pad, 6, V.pad, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Messages', style: T.h1),
                gap20,
                SearchBox(
                  hint: 'Search messages',
                  controller: _search,
                  onChanged: (_) => setState(() {}),
                ),
                gap14,
                if (filtered.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: Text('No messages match your search.', style: T.bodyMuted),
                    ),
                  )
                else
                  for (var i = 0; i < filtered.length; i++) ...[
                    if (i > 0) const Divider(height: 1),
                    _ThreadRow(thread: filtered[i]),
                  ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ThreadRow extends StatelessWidget {
  const _ThreadRow({required this.thread});

  final Thread thread;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => go(
        context,
        ChatScreen(
          name: thread.name,
          avatar: thread.asset,
          roleLabel: 'Your ServMate',
          service: thread.service,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Avatar(thread.asset, size: 56),
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          thread.preview,
                          style: T.bodyMuted.copyWith(fontSize: 15),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (thread.unread) ...[
                        const SizedBox(width: 8),
                        Container(
                          width: 9,
                          height: 9,
                          decoration: const BoxDecoration(
                            color: V.brand,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
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
