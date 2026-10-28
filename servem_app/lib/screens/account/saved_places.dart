import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../booking/address_picker.dart';

class SavedPlacesScreen extends StatelessWidget {
  const SavedPlacesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ShellScreen(
      title: 'Your saved places',
      navIndex: 4,
      bottom: CtaBar(
        label: 'Add an address',
        onPressed: () => go(context, const EnterAddressScreen()),
      ),
      child: ValueListenableBuilder<List<Address>>(
        valueListenable: AppState.instance.addresses,
        builder: (context, addresses, _) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Less typing, more getting things done.', style: T.bodyMuted),
              gap18,
              for (var i = 0; i < addresses.length; i++) ...[
                ServCard(
                  padding: const EdgeInsets.fromLTRB(20, 18, 18, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(addresses[i].icon, size: 24, color: V.muted),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(addresses[i].label,
                                    style: T.body.copyWith(fontSize: 17)),
                                gap4,
                                Text(addresses[i].line,
                                    style: T.small.copyWith(fontSize: 14.5)),
                              ],
                            ),
                          ),
                          const Icon(LucideIcons.chevronRight, size: 20, color: V.muted),
                        ],
                      ),
                      if (addresses[i].isDefault) ...[
                        gap12,
                        const StatusBadge('Default service address'),
                      ],
                      const Divider(height: 24),
                      Row(
                        children: [
                          GestureDetector(
                            onTap: () => go(
                              context,
                              EnterAddressScreen(
                                editing: addresses[i],
                                editIndex: i,
                              ),
                            ),
                            child: Text('Edit', style: T.link),
                          ),
                          Text('  ·  ', style: T.link),
                          GestureDetector(
                            onTap: () {
                              AppState.instance.removeAddress(i);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Address removed'),
                                  backgroundColor: V.brandDeep,
                                ),
                              );
                            },
                            child: Text('Remove', style: T.link),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                gap14,
              ],
              gap4,
              Text(
                'Exact addresses stay private until a ServMate accepts your booking.',
                style: T.bodyMuted.copyWith(fontSize: 15),
              ),
            ],
          );
        },
      ),
    );
  }
}
