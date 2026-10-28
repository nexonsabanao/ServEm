import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';

class EarningsTab extends StatelessWidget {
  const EarningsTab({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ListenableBuilder(
        listenable: Listenable.merge([
          AppState.instance.availableBalance,
          AppState.instance.todayEarnings,
          AppState.instance.totalEarnings,
          AppState.instance.historyJobs,
          AppState.instance.transactions,
        ]),
        builder: (context, _) {
          final balance = AppState.instance.availableBalance.value;
          final today = AppState.instance.todayEarnings.value;
          final total = AppState.instance.totalEarnings.value;
          final completedCount = AppState.instance.historyJobs.value.length;
          final txList = AppState.instance.transactions.value;

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(V.pad, 6, V.pad, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Your earnings', style: T.h1),
                gap20,
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
                  decoration: BoxDecoration(
                    color: V.tint,
                    borderRadius: BorderRadius.circular(V.cardRadius),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Available balance', style: T.body.copyWith(fontSize: 15.5)),
                      gap8,
                      Text(
                        formatPeso(balance),
                        style: T.h1.copyWith(fontSize: 38, color: V.brandDeep),
                      ),
                      gap10,
                      Text('Pending settlement', style: T.small.copyWith(fontSize: 14.5)),
                    ],
                  ),
                ),
                gap14,
                Row(
                  children: [
                    Expanded(
                      child: _StatCard(
                        label: 'Today',
                        value: formatPeso(today),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: _StatCard(
                        label: 'Total · October',
                        value: formatPeso(total),
                      ),
                    ),
                  ],
                ),
                gap12,
                Text(
                  '$completedCount completed jobs',
                  style: T.small,
                ),
                gap18,
                Text('Transaction history', style: T.section),
                gap12,
                ServCard(
                  child: Column(
                    children: [
                      if (txList.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 20),
                          child: Center(
                            child: Text('No transactions yet.', style: T.bodyMuted),
                          ),
                        )
                      else
                        for (var i = 0; i < txList.length; i++) ...[
                          if (i > 0) const Divider(height: 1),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        txList[i].title,
                                        style: T.body.copyWith(fontSize: 16),
                                      ),
                                      gap4,
                                      Text(
                                        txList[i].subtitle,
                                        style: T.small.copyWith(fontSize: 14.5),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  txList[i].amount,
                                  style: T.body.copyWith(
                                    fontSize: 15.5,
                                    color: txList[i].isWithdrawal ? V.ink : V.brand,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                    ],
                  ),
                ),
                gap12,
                Text(
                  'Balances include completed jobs and pending settlements. Payouts are reviewed before release.',
                  style: T.small,
                ),
                gap18,
                PrimaryButton(
                  label: 'Request payout',
                  onPressed: () => go(context, const WithdrawScreen()),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        color: V.surface,
        border: Border.all(color: V.line),
        borderRadius: BorderRadius.circular(V.cardRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(label, style: T.small.copyWith(fontSize: 14.5)),
          ),
          gap8,
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: T.cardTitle.copyWith(fontSize: 22)),
          ),
        ],
      ),
    );
  }
}

class WithdrawScreen extends StatefulWidget {
  const WithdrawScreen({super.key});

  @override
  State<WithdrawScreen> createState() => _WithdrawScreenState();
}

class _WithdrawScreenState extends State<WithdrawScreen> {
  final _payoutMethod = TextEditingController();
  final _amount = TextEditingController(text: '200.00');

  @override
  void dispose() {
    _payoutMethod.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _onWithdraw() async {
    final raw = _amount.text.replaceAll('\$', '').trim();
    final parsed = double.tryParse(raw);
    final available = AppState.instance.availableBalance.value;

    if (parsed == null || parsed <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid amount to withdraw.'),
          backgroundColor: V.brandDeep,
        ),
      );
      return;
    }

    if (parsed > available) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Amount exceeds your available balance of ${formatPeso(available)}.',
          ),
          backgroundColor: V.brandDeep,
        ),
      );
      return;
    }

    await AppState.instance.withdrawEarnings(
      parsed,
      _payoutMethod.text.trim(),
    );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Payout request for ${formatPeso(parsed)} sent to ${_payoutMethod.text}. An admin reviews it before release.',
        ),
        backgroundColor: V.brandDeep,
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: AppState.instance.availableBalance,
      builder: (context, balance, _) {
        return ScreenScaffold(
          title: 'Withdraw your earnings',
          bottom: CtaBar(
            label: 'Request payout',
            onPressed: _onWithdraw,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const InfoBanner(
                icon: LucideIcons.wallet,
                tone: BadgeTone.warning,
                title: 'PAYOUT REQUESTS',
                body:
                    'No bank connection is made and no money is transferred. Use sample details only.',
              ),
              gap16,
              Container(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
                decoration: BoxDecoration(
                  color: V.tint,
                  borderRadius: BorderRadius.circular(V.cardRadius),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Available to withdraw', style: T.body.copyWith(fontSize: 15.5)),
                    gap8,
                    Text(
                      formatPeso(balance),
                      style: T.h1.copyWith(fontSize: 38, color: V.brandDeep),
                    ),
                  ],
                ),
              ),
              gap16,
              const FieldLabel('Payout method'),
              ServTextField(
                controller: _payoutMethod,
                suffixIcon: LucideIcons.chevronDown,
              ),
              gap10,
              GestureDetector(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Payout account management'),
                      backgroundColor: V.brandDeep,
                    ),
                  );
                },
                behavior: HitTestBehavior.opaque,
                child: Text('Set up or change payout account', style: T.link),
              ),
              gap18,
              const FieldLabel('Withdrawal amount'),
              ServTextField(
                controller: _amount,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              gap8,
              Text(
                'Minimum ${formatPeso(1000)} · ${formatPeso(balance)} available',
                style: T.small,
              ),
              gap12,
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final preset in [50, 100, 200])
                    if (preset <= balance)
                      ServChip(
                        label: '\$$preset',
                        selected: _amount.text.replaceAll('\$', '').trim() == '$preset.00' ||
                            _amount.text.replaceAll('\$', '').trim() == '$preset',
                        onTap: () => setState(() => _amount.text = '$preset.00'),
                      ),
                  ServChip(
                    label: 'All (\$$balance)',
                    selected: _amount.text.replaceAll('\$', '').trim() == balance.toStringAsFixed(2),
                    onTap: () => setState(() => _amount.text = balance.toStringAsFixed(2)),
                  ),
                ],
              ),
              gap20,
              Text('Withdrawal history', style: T.section),
              gap12,
              ServCard(
                child: Column(
                  children: [
                    for (var i = 0; i < 2; i++) ...[
                      if (i > 0) const Divider(height: 1),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    i == 0
                                        ? 'GCash ···· 6789'
                                        : 'Bank transfer ···· 4321',
                                    style: T.body.copyWith(fontSize: 16),
                                  ),
                                  gap4,
                                  Text(
                                    i == 0 ? 'Oct 20, 2026' : 'Oct 17, 2026',
                                    style: T.small.copyWith(fontSize: 14.5),
                                  ),
                                ],
                              ),
                            ),
                            Text('Payout requested',
                                style: T.body.copyWith(fontSize: 15.5, color: V.brand)),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
