import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';

class RescheduleScreen extends StatefulWidget {
  const RescheduleScreen({super.key, required this.booking});

  final Booking booking;

  @override
  State<RescheduleScreen> createState() => _RescheduleScreenState();
}

class _RescheduleScreenState extends State<RescheduleScreen> {
  int _day = 0;
  int _time = 1;

  /// Start times a ServMate can offer; the booking keeps its own duration.
  static const _timeSlots = <String>[
    '8:00 AM',
    '9:30 AM',
    '11:00 AM',
    '1:00 PM',
    '3:00 PM',
  ];

  /// The next four Manila days, so the picker never shows a fixed month.
  late final List<DateTime> _days = List<DateTime>.generate(4, (index) {
    final now = manilaNow();
    return DateTime(
      now.year,
      now.month,
      now.day,
    ).add(Duration(days: index + 1));
  });

  static const _weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  static const _months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  DateTime get _selectedStart {
    final date = _days[_day];
    final parts = _timeSlots[_time].split(' ');
    final hm = parts.first.split(':');
    final hour = int.parse(hm.first) % 12 + (parts.last == 'PM' ? 12 : 0);
    return DateTime(date.year, date.month, date.day, hour, int.parse(hm.last));
  }

  String get _selectedLabel {
    final date = _days[_day];
    final end = _selectedStart.add(Duration(hours: widget.booking.hours));
    final endHour = end.hour % 12 == 0 ? 12 : end.hour % 12;
    final endSuffix = end.hour >= 12 ? 'PM' : 'AM';
    return '${_weekdays[date.weekday - 1]}, ${_months[date.month - 1]} ${date.day} · '
        '${_timeSlots[_time]} – $endHour:00 $endSuffix';
  }

  @override
  Widget build(BuildContext context) {
    final booking = widget.booking;
    return ScreenScaffold(
      title: 'Find another time',
      bottom: CtaBar(
        label: 'Request new time',
        onPressed: () {
          final newWhen = _selectedLabel;
          AppState.instance.rescheduleBooking(
            booking.id,
            _selectedStart,
            booking.hours,
          );
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Rescheduled to $newWhen'),
              backgroundColor: V.brandDeep,
            ),
          );
          Navigator.of(context).pop();
        },
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '${booking.service.provider.name.split(' ').first} will confirm your new schedule.',
            style: T.bodyMuted,
          ),
          gap18,
          BookingSummaryCard(booking: booking),
          gap20,
          Text(
            '${_months[_days.first.month - 1]} ${_days.first.year}',
            style: T.section,
          ),
          gap14,
          Row(
            children: [
              for (var i = 0; i < _days.length; i++) ...[
                if (i > 0) const SizedBox(width: 10),
                Expanded(
                  child: _DateChip(
                    day: _weekdays[_days[i].weekday - 1],
                    number: '${_days[i].day}',
                    selected: _day == i,
                    onTap: () => setState(() => _day = i),
                  ),
                ),
              ],
            ],
          ),
          gap20,
          Text('Available start times', style: T.section),
          gap12,
          ChipRow(
            children: [
              for (var i = 0; i < _timeSlots.length; i++)
                ServChip(
                  label: _timeSlots[i],
                  selected: _time == i,
                  onTap: () => setState(() => _time = i),
                ),
            ],
          ),
          gap18,
          Container(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
            decoration: BoxDecoration(
              color: V.tint,
              borderRadius: BorderRadius.circular(V.cardRadius),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Requested · ${_weekdays[_days[_day].weekday - 1]}, '
                  '${_months[_days[_day].month - 1]} ${_days[_day].day}',
                  style: T.label.copyWith(fontSize: 16, color: V.brandDeep),
                ),
                gap8,
                Text(
                  '${_timeSlots[_time]} · ${widget.booking.hours} hours',
                  style: T.body.copyWith(fontSize: 15.5),
                ),
                gap8,
                Text(
                  'Same service and ${booking.totalLabel} total. Your original booking remains confirmed until ${booking.service.provider.name.split(' ').first} accepts the change.',
                  style: T.small,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DateChip extends StatelessWidget {
  const _DateChip({
    required this.day,
    required this.number,
    required this.selected,
    required this.onTap,
  });

  final String day;
  final String number;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(V.radius),
      side: BorderSide(color: selected ? V.brand : V.line),
    );
    return Material(
      color: selected ? V.tint : V.surface,
      shape: shape,
      child: InkWell(
        borderRadius: BorderRadius.circular(V.radius),
        onTap: onTap,
        child: SizedBox(
          height: 82,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                day,
                style: T.micro.copyWith(
                  fontSize: 11.5,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w500,
                ),
              ),
              gap6,
              Text(
                number,
                style: T.h3.copyWith(
                  fontSize: 23,
                  color: selected ? V.brandDeep : V.ink,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact booking header reused by reschedule and cancel screens.
class BookingSummaryCard extends StatelessWidget {
  const BookingSummaryCard({super.key, required this.booking});

  final Booking booking;

  @override
  Widget build(BuildContext context) {
    return ServCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Photo(booking.service.asset, width: 62, height: 62),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      booking.service.title,
                      style: T.cardTitle.copyWith(fontSize: 18),
                    ),
                    gap4,
                    Text(
                      '${booking.service.provider.name} · Your ServMate',
                      style: T.bodyMuted.copyWith(fontSize: 15),
                    ),
                  ],
                ),
              ),
            ],
          ),
          gap14,
          Text(booking.when, style: T.body.copyWith(fontSize: 15.5)),
          gap8,
          Text(
            '${booking.hours} hours · ${formatPeso(booking.service.price)} / hr',
            style: T.bodyMuted.copyWith(fontSize: 15),
          ),
        ],
      ),
    );
  }
}
