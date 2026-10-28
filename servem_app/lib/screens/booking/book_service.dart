import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import 'address_picker.dart';

/// Booking step 1 of 3: what, when and how long.
///
/// Produces a [BookingDraft] holding a real `Asia/Manila` start time, so the
/// later steps never deal in free-text dates or hand-computed totals.
class BookServiceScreen extends StatefulWidget {
  const BookServiceScreen({super.key, required this.service});

  final Service service;

  @override
  State<BookServiceScreen> createState() => _BookServiceScreenState();
}

class _BookServiceScreenState extends State<BookServiceScreen> {
  late final BookingDraft _draft;
  late final TextEditingController _details;

  @override
  void initState() {
    super.initState();
    final store = AppState.instance;
    _draft = BookingDraft(
      service: widget.service,
      slotLabels: store.timeSlots,
      durationLabels: store.durations,
    );
    _details = TextEditingController();
    _details.addListener(_syncNotes);
  }

  void _syncNotes() => _draft.notes = _details.text;

  @override
  void dispose() {
    _details.removeListener(_syncNotes);
    _details.dispose();
    super.dispose();
  }

  Future<void> _pickDay() async {
    final choice = await showServEmSheet<int>(
      context,
      Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Choose a date', style: T.h3),
          gap6,
          Text('Dates and times are shown in Philippine time (Asia/Manila).',
              style: T.small),
          gap18,
          for (var i = 0; i < _draft.dayChoices.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: ServChip(
                label: _dayLabelFor(i),
                selected: _draft.dayIndex == i,
                onTap: () => Navigator.of(context).pop(i),
              ),
            ),
        ],
      ),
    );
    if (choice != null) setState(() => _draft.dayIndex = choice);
  }

  String _dayLabelFor(int index) {
    final day = _draft.dayChoices[index];
    final today = manilaNow();
    final isTomorrow =
        day.difference(DateTime(today.year, today.month, today.day)) ==
            const Duration(days: 1);
    final label = formatManilaDateTime(day, withTime: false);
    return isTomorrow ? 'Tomorrow · $label' : label;
  }

  Future<void> _pickDuration() async {
    final choice = await showServEmSheet<int>(
      context,
      Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('How long do you need?', style: T.h3),
          gap18,
          for (var i = 0; i < _draft.durationLabels.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: ServChip(
                label: _draft.durationLabels[i],
                selected: _draft.durationIndex == i,
                onTap: () => Navigator.of(context).pop(i),
              ),
            ),
        ],
      ),
    );
    if (choice != null) setState(() => _draft.durationIndex = choice);
  }

  @override
  Widget build(BuildContext context) {
    final estimate = _draft.estimate;
    return ScreenScaffold(
      title: 'Book your service',
      bottom: CtaBar(
        label: 'Continue to address',
        onPressed: () => go(context, AddressPickerScreen(draft: _draft)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Photo(widget.service.asset, width: 64, height: 64),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.service.title,
                        style: T.cardTitle.copyWith(fontSize: 18)),
                    gap4,
                    Text(
                      '${widget.service.provider.name} · ${widget.service.priceLabel}',
                      style: T.bodyMuted.copyWith(fontSize: 15),
                    ),
                    gap4,
                    Text(
                      '${widget.service.provider.area} · ${widget.service.distance}',
                      style: T.small,
                    ),
                  ],
                ),
              ),
            ],
          ),
          gap24,
          const FieldLabel('Date'),
          _PickerTile(
            label: _dayLabelFor(_draft.dayIndex),
            icon: LucideIcons.calendar,
            onTap: _pickDay,
          ),
          gap18,
          const FieldLabel('Start time'),
          Row(
            children: [
              for (var i = 0; i < _draft.slotLabels.length; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Expanded(
                  child: ServChip(
                    label: _draft.slotLabels[i],
                    selected: _draft.slotIndex == i,
                    onTap: () => setState(() => _draft.slotIndex = i),
                    horizontalPadding: 8,
                  ),
                ),
              ],
            ],
          ),
          gap18,
          const FieldLabel('Duration'),
          _PickerTile(
            label: _draft.durationLabel,
            icon: LucideIcons.clock,
            onTap: _pickDuration,
          ),
          gap18,
          const FieldLabel('Task details', optional: true),
          ServTextField(
            maxLines: 3,
            controller: _details,
            hint: 'Describe the job, e.g. assemble a wardrobe in the spare room.',
            textCapitalization: TextCapitalization.sentences,
            semanticsLabel: 'Task details',
          ),
          gap24,
          KeyValueRow(
            label: 'Labour · ${_draft.hours} hours × ${formatPeso(widget.service.price)} / hr',
            value: estimate.subtotalLabel,
          ),
          KeyValueRow(
            label: 'Platform service fee (10%, estimated)',
            value: estimate.feeLabel,
          ),
          gap6,
          Row(
            children: [
              Text('Estimated total', style: T.label.copyWith(fontSize: 16.5)),
              const Spacer(),
              Text(
                estimate.totalLabel,
                style: T.label.copyWith(fontSize: 17),
              ),
            ],
          ),
          gap16,
          Text(
            'The service fee is confirmed by ServEm when you book. '
            'You choose how to pay on the last step.',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

class _PickerTile extends StatelessWidget {
  const _PickerTile({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(V.radius),
      child: Container(
        height: V.button,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          color: V.surface,
          border: Border.all(color: V.line),
          borderRadius: BorderRadius.circular(V.radius),
        ),
        child: Row(
          children: [
            Expanded(child: Text(label, style: T.body.copyWith(height: 1.2))),
            Icon(icon, size: 20, color: V.muted),
          ],
        ),
      ),
    );
  }
}
