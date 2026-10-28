import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.name,
    this.threadId = '',
    this.avatar = '',
    this.initials = '',
    this.roleLabel = 'Your ServMate',
    this.service = 'Furniture assembly',
  });

  final String name;
  final String threadId;
  final String avatar;
  final String initials;
  final String roleLabel;
  final String service;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _input = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _input.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _send() {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    if (widget.threadId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'This conversation is not linked to a booking yet. Open it from the booking to send a message.',
          ),
        ),
      );
      return;
    }
    _input.clear();

    AppState.instance.sendChatMessage(widget.name, text, widget.threadId);

    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: V.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Header
            SizedBox(
              height: 72,
              child: Row(
                children: [
                  SizedBox(
                    width: 52,
                    child: InkWell(
                      onTap: () => Navigator.of(context).maybePop(),
                      child: const Padding(
                        padding: EdgeInsets.only(left: 8),
                        child: Icon(
                          LucideIcons.arrowLeft,
                          size: 23,
                          color: V.ink,
                        ),
                      ),
                    ),
                  ),
                  Avatar(widget.avatar, size: 44, initials: widget.initials),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          widget.name,
                          style: T.title.copyWith(fontSize: 20),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          widget.roleLabel,
                          style: T.small.copyWith(fontSize: 14.5),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: V.pad - 8),
                ],
              ),
            ),
            // Booking strip
            Container(
              width: double.infinity,
              color: V.tint,
              padding: const EdgeInsets.fromLTRB(V.pad, 16, V.pad, 16),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.service,
                          style: T.label.copyWith(
                            fontSize: 15.5,
                            color: V.brandDeep,
                          ),
                        ),
                        // The booking's real slot is shown from its own screen;
                        // this strip keeps the service context without inventing one.
                        gap4,
                      ],
                    ),
                  ),
                  const Icon(
                    LucideIcons.chevronRight,
                    size: 20,
                    color: V.brand,
                  ),
                ],
              ),
            ),
            Expanded(
              child: ValueListenableBuilder<Map<String, List<ChatLine>>>(
                valueListenable: AppState.instance.chatMessages,
                builder: (context, map, _) {
                  final lines = map[widget.name] ?? const <ChatLine>[];

                  return ListView(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(V.pad, 18, V.pad, 12),
                    children: [
                      Center(
                        child: Text(
                          'Today, October 24',
                          style: T.small.copyWith(fontSize: 14),
                        ),
                      ),
                      gap16,
                      for (final line in lines) _Bubble(line: line),
                    ],
                  );
                },
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(V.pad, 10, V.pad, 12),
              child: SafeArea(
                top: false,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 54),
                        decoration: BoxDecoration(
                          color: V.surface,
                          border: Border.all(color: V.line),
                          borderRadius: BorderRadius.circular(V.radius),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 18),
                        child: TextField(
                          controller: _input,
                          onSubmitted: (_) => _send(),
                          style: T.body.copyWith(height: 1.3),
                          decoration: InputDecoration(
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              vertical: 17,
                            ),
                            hintText: 'Write a message...',
                            hintStyle: T.bodyMuted.copyWith(height: 1.3),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Material(
                      color: V.brand,
                      borderRadius: BorderRadius.circular(V.radius),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(V.radius),
                        onTap: _send,
                        child: const SizedBox(
                          width: 54,
                          height: 54,
                          child: Icon(
                            LucideIcons.arrowUp,
                            size: 22,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.line});

  final ChatLine line;

  @override
  Widget build(BuildContext context) {
    final mine = line.mine;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: mine
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        children: [
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.sizeOf(context).width * 0.78,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
            decoration: BoxDecoration(
              color: mine ? V.brand : V.surface,
              borderRadius: BorderRadius.circular(18),
              border: mine ? null : Border.all(color: V.line),
            ),
            child: Text(
              line.text,
              style: T.body.copyWith(
                fontSize: 15.5,
                height: 1.45,
                color: mine ? Colors.white : V.ink,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(line.time, style: T.micro.copyWith(fontSize: 12.5)),
              if (mine && line.read) ...[
                const SizedBox(width: 6),
                const Icon(LucideIcons.checkCheck, size: 14, color: V.brand),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
