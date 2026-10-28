import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/errors.dart';
import '../../core/localization.dart';
import '../../design/payment_icons.dart';
import '../../design/theme.dart';
import 'booking_sent.dart';

/// Booking step 3 of 3: review the price and confirm.
///
/// The amounts shown here are an **estimate**. On confirm, the
/// `createBooking` Cloud Function (region `asia-southeast1`) recomputes the
/// labour subtotal, the 10% platform service fee and the total server-side and
/// returns them; the client never sends a fee.
class ReviewConfirmScreen extends StatefulWidget {
  const ReviewConfirmScreen({
    super.key,
    required this.draft,
    this.address,
  });

  final BookingDraft draft;
  final Address? address;

  @override
  State<ReviewConfirmScreen> createState() => _ReviewConfirmScreenState();
}

class _ReviewConfirmScreenState extends State<ReviewConfirmScreen> {
  bool _busy = false;

  Address? get _address => widget.address ?? widget.draft.address;

  Future<void> _confirm() async {
    final address = _address;
    if (address == null) {
      _showMessage('Add a service address before confirming.');
      return;
    }
    final method = findPaymentMethod(widget.draft.paymentMethod);
    if (method == null) {
      _showMessage('Choose how you want to pay.');
      return;
    }
    setState(() => _busy = true);
    final booking = await performAction<Booking>(
      context,
      () => AppState.instance.placeBooking(
        service: widget.draft.service,
        manilaStart: widget.draft.manilaStart,
        hours: widget.draft.hours,
        address: address.line,
        notes: widget.draft.notes,
        paymentMethod: method.id,
        serviceAddress: address,
      ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (booking != null) {
      go(context, BookingSentScreen(booking: booking));
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final service = widget.draft.service;
    final estimate = widget.draft.estimate;
    final address = _address;
    final total = estimate.total;

    return ScreenScaffold(
      title: 'Review price & confirm',
      bottom: CtaBar(
        label: _busy
            ? 'Confirming…'
            : 'Confirm booking · ${formatPeso(total, showCents: true)}',
        onPressed: _busy ? null : _confirm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Step 3 of 3 · Review price',
              style: T.bodyMuted.copyWith(fontSize: 15)),
          gap16,
          ServCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Photo(service.asset, width: 62, height: 62),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(service.title,
                              style: T.cardTitle.copyWith(fontSize: 18)),
                          gap4,
                          Text(
                            '${service.provider.name} · Your ServMate',
                            style: T.bodyMuted.copyWith(fontSize: 15),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                gap14,
                Text(widget.draft.whenLabel,
                    style: T.body.copyWith(fontSize: 15.5)),
                gap8,
                Text(
                  '${widget.draft.hours} hours · ${service.priceLabel}',
                  style: T.bodyMuted.copyWith(fontSize: 15),
                ),
              ],
            ),
          ),
          gap14,
          if (address != null)
            ServCard(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(LucideIcons.mapPin, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(address.label, style: T.label),
                        gap4,
                        Text(address.line, style: T.small),
                        if (address.detail.isNotEmpty) ...[
                          gap6,
                          Text(address.detail, style: T.small),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            )
          else
            const InfoBanner(
              icon: LucideIcons.mapPin,
              title: 'No address yet',
              body: 'Go back and add the place that needs help.',
              tone: BadgeTone.warning,
            ),
          gap14,
          KeyValueRow(
            label: 'Labour · ${widget.draft.hours} hours × '
                '${formatPeso(service.price)} / hr',
            value: estimate.subtotalLabel,
          ),
          KeyValueRow(
            label: 'Platform service fee (10%)',
            value: estimate.feeLabel,
          ),
          const Divider(height: 24),
          Row(
            children: [
              Text('Total', style: T.price.copyWith(fontSize: 22)),
              const Spacer(),
              Text(
                estimate.totalLabel,
                style: T.price.copyWith(fontSize: 24, color: V.brand),
              ),
            ],
          ),
          gap8,
          Text(
            'Estimated. ServEm confirms the exact ${formatPeso(estimate.fee)} '
            'service fee when the booking is created.',
            style: T.small,
          ),
          gap22,
          Text('Payment method', style: T.section),
          gap12,
          PaymentMethodPicker(
            selected: widget.draft.paymentMethod,
            onSelect: (id) => setState(() => widget.draft.paymentMethod = id),
          ),
          gap18,
          const InfoBanner(
            icon: LucideIcons.shieldCheck,
            title: 'Pay after the job is done',
            body: 'GCash, Maya and bank transfer are collected by ServEm on '
                'completion; cash on completion goes directly to your '
                'ServMate. Your provider never sees your wallet details.',
          ),
        ],
      ),
    );
  }
}
