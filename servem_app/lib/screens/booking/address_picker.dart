import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../core/errors.dart';
import '../../core/localization.dart';
import '../../design/theme.dart';
import 'confirm_location.dart';

/// Booking step 2 of 3: pick or enter the Philippine service address.
class AddressPickerScreen extends StatefulWidget {
  const AddressPickerScreen({super.key, required this.draft});

  final BookingDraft draft;

  @override
  State<AddressPickerScreen> createState() => _AddressPickerScreenState();
}

class _AddressPickerScreenState extends State<AddressPickerScreen> {
  int _selected = 0;

  Address? _chosen(List<Address> addresses) {
    if (addresses.isEmpty) return null;
    return addresses[_selected.clamp(0, addresses.length - 1)];
  }

  void _continue(Address address) {
    go(
      context,
      ConfirmLocationScreen(draft: widget.draft, address: address),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<Address>>(
      valueListenable: AppState.instance.addresses,
      builder: (context, addresses, _) {
        final chosen = _chosen(addresses) ??
            (AppState.instance.userProfile.value.displayLocation.isEmpty
                ? null
                : Address(
                    label: 'Use my account area',
                    icon: LucideIcons.mapPin,
                    city: AppState.instance.userProfile.value.city,
                    province: AppState.instance.userProfile.value.province,
                    barangay: AppState.instance.userProfile.value.barangay,
                    postalCode:
                        AppState.instance.userProfile.value.postalCode,
                  ));

        return ScreenScaffold(
          title: 'Where do you need help?',
          bottom: chosen == null
              ? null
              : CtaBar(
                  label: 'Use selected address',
                  onPressed: () => _continue(chosen),
                ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Step 2 of 3 · Confirm your address',
                  style: T.bodyMuted.copyWith(fontSize: 15)),
              gap6,
              Text(
                'ServEm works in Metro Manila, Cebu and Davao. '
                'Slot: ${widget.draft.whenLabel}',
                style: T.small,
              ),
              gap18,
              SearchBox(
                hint: 'Search a street, barangay or subdivision',
                onTap: () => go(
                  context,
                  EnterAddressScreen(draft: widget.draft),
                ),
              ),
              gap20,
              Text('Saved addresses', style: T.section),
              gap14,
              if (addresses.isEmpty)
                const InfoBanner(
                  icon: LucideIcons.mapPin,
                  title: 'No saved addresses yet',
                  body: 'Enter the unit, street, barangay, city or municipality, '
                      'province and 4-digit postal code of the place that needs '
                      'help.',
                )
              else
                for (var i = 0; i < addresses.length; i++) ...[
                  _AddressTile(
                    address: addresses[i],
                    selected: chosen != null && chosen.id == addresses[i].id,
                    onTap: () => setState(() => _selected = i),
                  ),
                  gap14,
                ],
              gap6,
              GestureDetector(
                onTap: () => go(
                  context,
                  EnterAddressScreen(draft: widget.draft),
                ),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text('+ Enter address manually', style: T.link),
                ),
              ),
              gap20,
              const InfoBanner(
                icon: LucideIcons.lock,
                title: 'Your address stays private',
                body:
                    'Your ServMate only sees the exact address after accepting the booking.',
              ),
              gap18,
              Text(
                'Location access is optional. You can always type an address '
                'instead.',
                style: T.bodyMuted.copyWith(fontSize: 15),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _AddressTile extends StatelessWidget {
  const _AddressTile({
    required this.address,
    required this.selected,
    required this.onTap,
  });

  final Address address;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(V.cardRadius),
      side: BorderSide(color: selected ? V.brand : V.line),
    );
    return Material(
      color: selected ? V.tint : V.surface,
      shape: shape,
      child: InkWell(
        borderRadius: BorderRadius.circular(V.cardRadius),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(
                selected ? LucideIcons.checkCircle2 : address.icon,
                size: 24,
                color: selected ? V.brand : V.ink,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${address.label}${address.isDefault ? ' · default' : ''}',
                      style: T.cardTitle.copyWith(fontSize: 17),
                    ),
                    gap4,
                    Text(address.line,
                        style: T.small.copyWith(fontSize: 14.5)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Philippine address entry: Unit/Floor, Street, Barangay, City or
/// Municipality, Province and a 4-digit Postal code.
///
/// From the booking flow it carries a [draft] and hands the address to the pin
/// confirmation step. From "Your saved places" there is no booking in flight, so
/// the draft is omitted and the screen just saves the place and closes; passing
/// [editing] plus [editIndex] turns it into an edit of an existing place.
class EnterAddressScreen extends StatefulWidget {
  const EnterAddressScreen({
    super.key,
    this.draft,
    this.editing,
    this.editIndex = -1,
  });

  final BookingDraft? draft;
  final Address? editing;
  final int editIndex;

  bool get isEditing => editing != null;

  @override
  State<EnterAddressScreen> createState() => _EnterAddressScreenState();
}

class _EnterAddressScreenState extends State<EnterAddressScreen> {
  static const _labels = ['Home', 'Work', 'Other'];

  final _street = TextEditingController();
  final _unit = TextEditingController();
  final _barangay = TextEditingController();
  final _city = TextEditingController();
  final _province = TextEditingController();
  final _postal = TextEditingController();
  final _arrival = TextEditingController();

  final _postalFocus = FocusNode();

  int _labelIndex = 0;
  String? _streetError;
  String? _cityError;
  String? _provinceError;
  String? _postalError;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final profile = AppState.instance.userProfile.value;
    final editing = widget.editing;
    if (editing != null) {
      _labelIndex = switch (editing.label) {
        'Work' => 1,
        'Home' => 0,
        _ => _labels.indexOf(editing.label).clamp(0, _labels.length - 1),
      };
      _street.text = editing.street;
      _unit.text = editing.unit;
      _barangay.text = editing.barangay;
      _city.text = editing.city;
      _province.text = editing.province;
      _postal.text = editing.postalCode;
      _arrival.text = editing.detail;
    } else {
      _city.text = profile.city.isNotEmpty
          ? profile.city
          : defaultPhilippineLocation.city;
      _province.text = profile.province.isNotEmpty
          ? profile.province
          : defaultPhilippineLocation.province;
      _postal.text = profile.postalCode.isNotEmpty
          ? profile.postalCode
          : defaultPhilippineLocation.postalCode;
      _barangay.text = profile.barangay;
    }
    _postalFocus.addListener(_validatePostal);
  }

  @override
  void dispose() {
    _postalFocus.removeListener(_validatePostal);
    _postalFocus.dispose();
    _street.dispose();
    _unit.dispose();
    _barangay.dispose();
    _city.dispose();
    _province.dispose();
    _postal.dispose();
    _arrival.dispose();
    super.dispose();
  }

  void _validatePostal() {
    if (_postalFocus.hasFocus) return;
    setState(() => _postalError = _postalErrorFor());
  }

  String? _postalErrorFor() {
    if (_postal.text.trim().isEmpty) {
      return 'A Philippine postal code is required.';
    }
    if (!validatePhilippinePostalCode(_postal.text)) {
      return 'Philippine postal codes are exactly 4 digits, e.g. 1108.';
    }
    return null;
  }

  String? _required(String value, String message) =>
      value.trim().isEmpty ? message : null;

  Address get _address => Address(
        label: _labels[_labelIndex],
        icon: switch (_labelIndex) {
          0 => LucideIcons.home,
          1 => LucideIcons.briefcase,
          _ => LucideIcons.mapPin,
        },
        street: _street.text.trim(),
        unit: _unit.text.trim(),
        barangay: _barangay.text.trim(),
        city: _city.text.trim(),
        province: _province.text.trim(),
        postalCode: _postal.text.trim(),
        detail: _arrival.text.trim(),
        isDefault: widget.editing?.isDefault ??
            AppState.instance.addresses.value.isEmpty,
      );

  Future<void> _submit() async {
    setState(() {
      _streetError = _required(_street.text, 'Enter the street, subdivision or purok.');
      _cityError = _required(_city.text, 'Enter the city or municipality.');
      _provinceError = _required(_province.text, 'Enter the province.');
      _postalError = _postalErrorFor();
      _saving = true;
    });
    final hasError = _streetError != null ||
        _cityError != null ||
        _provinceError != null ||
        _postalError != null;
    if (hasError) {
      if (mounted) setState(() => _saving = false);
      return;
    }

    final address = _address;
    // Saving to `savedPlaces` may legitimately fail (e.g. the session expired);
    // show why, but still let the person book with the address they typed.
    final editIndex = widget.editIndex;
    await performAction<void>(
      context,
      () => editIndex >= 0
          ? AppState.instance.updateAddress(editIndex, address)
          : AppState.instance.addAddress(address),
    );
    if (!mounted) return;
    setState(() => _saving = false);
    final draft = widget.draft;
    if (draft == null) {
      Navigator.of(context).pop(address);
      return;
    }
    Navigator.of(context).pop();
    _continueWith(address, draft);
  }

  void _continueWith(Address address, BookingDraft draft) {
    draft.address = address;
    go(
      context,
      ConfirmLocationScreen(draft: draft, address: address),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Enter service address',
      bottom: CtaBar(
        label: _saving
            ? 'Saving…'
            : widget.draft == null
                ? 'Save this address'
                : 'Continue to pin confirmation',
        onPressed: _saving ? null : _submit,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('No location permission needed.', style: T.bodyMuted),
          gap18,
          const FieldLabel('Unit / floor'),
          ServTextField(
            controller: _unit,
            hint: 'Apt 3B · Unit 12-05 · House 8',
            textCapitalization: TextCapitalization.words,
            semanticsLabel: 'Unit or floor',
          ),
          gap16,
          const FieldLabel('Street / subdivision / purok'),
          ServTextField(
            controller: _street,
            textCapitalization: TextCapitalization.words,
            semanticsLabel: 'Street address',
            error: _streetError,
            onChanged: (_) {
              if (_streetError != null) setState(() => _streetError = null);
            },
          ),
          gap16,
          const FieldLabel('Barangay'),
          ServTextField(
            controller: _barangay,
            hint: 'e.g. Brgy. Teachers Village',
            textCapitalization: TextCapitalization.words,
            semanticsLabel: 'Barangay',
          ),
          gap16,
          const FieldLabel('City or municipality'),
          ServTextField(
            controller: _city,
            textCapitalization: TextCapitalization.words,
            semanticsLabel: 'City or municipality',
            error: _cityError,
            onChanged: (_) {
              if (_cityError != null) setState(() => _cityError = null);
            },
          ),
          gap16,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FieldLabel('Province'),
                    ServTextField(
                      controller: _province,
                      textCapitalization: TextCapitalization.words,
                      semanticsLabel: 'Province',
                      error: _provinceError,
                      onChanged: (_) {
                        if (_provinceError != null) {
                          setState(() => _provinceError = null);
                        }
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FieldLabel('Postal code'),
                    ServTextField(
                      controller: _postal,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.done,
                      inputFormatters: const [PhilippinePostalCodeFormatter()],
                      focusNode: _postalFocus,
                      semanticsLabel: '4-digit postal code',
                      error: _postalError,
                    ),
                  ],
                ),
              ),
            ],
          ),
          gap16,
          const FieldLabel('Arrival instructions', optional: true),
          ServTextField(
            controller: _arrival,
            maxLines: 3,
            hint: 'Gate code, landmark, where to park.',
            textCapitalization: TextCapitalization.sentences,
            semanticsLabel: 'Arrival instructions',
          ),
          gap16,
          ChipRow(
            children: [
              for (var i = 0; i < _labels.length; i++)
                ServChip(
                  label: _labels[i],
                  selected: _labelIndex == i,
                  height: 44,
                  onTap: () => setState(() => _labelIndex = i),
                ),
            ],
          ),
          gap16,
          Text(
            'ServEm serves Metro Manila, Cebu and Davao. Postal codes are the '
            '4-digit Philippine ones.',
            style: T.small,
          ),
        ],
      ),
    );
  }
}
