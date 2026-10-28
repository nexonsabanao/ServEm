import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import 'review_confirm.dart';

/// Pin confirmation between the address step and the price review.
class ConfirmLocationScreen extends StatelessWidget {
  const ConfirmLocationScreen({
    super.key,
    required this.draft,
    required this.address,
  });

  final BookingDraft draft;
  final Address address;

  @override
  Widget build(BuildContext context) {
    final area = [
      if (address.barangay.isNotEmpty) address.barangay,
      if (address.city.isNotEmpty) address.city,
    ].join(', ');
    final postal = address.province.isEmpty
        ? address.postalCode
        : '${address.province} ${address.postalCode}';

    return ScreenScaffold(
      title: 'Confirm service location',
      bottom: CtaBar(
        label: 'Confirm address',
        link: 'Edit address',
        onLink: () => Navigator.of(context).pop(),
        onPressed: () {
          draft.address = address;
          go(context, ReviewConfirmScreen(draft: draft, address: address));
        },
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Address confirmation · Booking step',
              style: T.bodyMuted.copyWith(fontSize: 15)),
          gap14,
          MapPreview(
            height: 216,
            label: area.isEmpty
                ? 'PHILIPPINES · SAMPLE'
                : '${area.toUpperCase()} · ${address.postalCode}',
          ),
          gap10,
          Text('Illustrative map · sample pin, not live location',
              style: T.small),
          gap16,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const StatusBadge('Selected address'),
                gap12,
                Text(
                  [
                    if (address.street.isNotEmpty) address.street,
                    if (address.unit.isNotEmpty) address.unit,
                  ].join(', '),
                  style: T.h3.copyWith(fontSize: 22),
                ),
                gap6,
                Text(
                  [
                    if (area.isNotEmpty) area,
                    if (postal.trim().isNotEmpty) postal,
                  ].join(' · '),
                  style: T.bodyMuted,
                ),
                if (address.detail.isNotEmpty) ...[
                  gap12,
                  Text(address.detail, style: T.body.copyWith(fontSize: 15)),
                ],
              ],
            ),
          ),
          gap16,
          const InfoBanner(
            icon: LucideIcons.mapPin,
            title: 'Check the address, not the pin',
            body:
                'This sample pin is illustrative. In a supported map, drag to adjust before confirming.',
          ),
          gap14,
          KeyValueRow(
            label: 'Your slot',
            value: draft.whenLabel,
          ),
          Text(
            'Times are Philippine time ($appTimeZone). Your exact address is '
            'shared only after your ServMate accepts.',
            style: T.bodyMuted.copyWith(fontSize: 15),
          ),
        ],
      ),
    );
  }
}
