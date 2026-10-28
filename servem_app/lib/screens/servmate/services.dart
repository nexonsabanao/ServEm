import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../customer/service_detail.dart';

/// The signed-in ServMate's own listing, once they have published one.
Service? _ownListing() {
  final me = AppState.instance.mateProfile.value.id;
  if (me.isEmpty) return null;
  for (final service in AppState.instance.services.value) {
    if (service.provider.id == me) return service;
  }
  return null;
}

/// The standard week a ServMate starts from; custom hours are edited in the
/// availability flow, not invented per screen.
const _weeklyHours = <(String, String)>[
  ('Monday', '8:00 AM – 6:00 PM'),
  ('Tuesday', '8:00 AM – 6:00 PM'),
  ('Wednesday', '8:00 AM – 6:00 PM'),
  ('Thursday', '8:00 AM – 6:00 PM'),
  ('Friday', '8:00 AM – 6:00 PM'),
  ('Saturday', '9:00 AM – 3:00 PM'),
  ('Sunday', 'Unavailable'),
];

/// Previews a listing, or explains how to get one when nothing is published.
void _openPublicListing(BuildContext context) {
  final listing = _ownListing();
  if (listing == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Publish your first service to preview the public listing.')),
    );
    return;
  }
  go(context, ServiceDetailScreen(service: listing));
}

class CreateServiceScreen extends StatefulWidget {
  const CreateServiceScreen({super.key});

  @override
  State<CreateServiceScreen> createState() => _CreateServiceScreenState();
}

class _CreateServiceScreenState extends State<CreateServiceScreen> {
  final _title = TextEditingController(text: 'Furniture assembly');
  final _category = TextEditingController(text: 'Assembly');
  final _price = TextEditingController();
  final _duration = TextEditingController(text: '2-hour minimum');
  final _requirements = TextEditingController(text: 'Boxes ready; clear space');
  final _description = TextEditingController(
    text: 'I assemble desks, shelves and beds with care. Tools included, and I tidy up after.',
  );
  final _availability = TextEditingController(text: 'Every day · 9:00 AM–5:00 PM');

  @override
  void dispose() {
    _title.dispose();
    _category.dispose();
    _price.dispose();
    _duration.dispose();
    _requirements.dispose();
    _description.dispose();
    _availability.dispose();
    super.dispose();
  }

  void _publish() {
    final title = _title.text.trim();
    if (title.isEmpty) return;

    final priceInt = int.tryParse(_price.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 45;

    final newService = Service(
      title: title,
      category: _category.text.trim().isNotEmpty ? _category.text.trim() : 'Assembly',
      price: priceInt.toDouble(),
      rating: 'New',
      asset: 'assets/images/assembly_hero.jpg',
      provider: AppState.instance.mateProfile.value,
      description: _description.text.trim().isNotEmpty
          ? _description.text.trim()
          : 'Careful, reliable local service from a verified ServMate.',
    );

    AppState.instance.addService(newService);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('"$title" added to public services!'),
        backgroundColor: V.brandDeep,
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Create a service',
      bottom: CtaBar(
        label: 'Publish Service',
        onPressed: _publish,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Put your skills to work in your neighborhood.',
            style: T.bodyMuted,
          ),
          gap18,
          const FieldLabel('Service title'),
          ServTextField(controller: _title),
          gap16,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FieldLabel('Category'),
                    ServTextField(controller: _category, suffixIcon: LucideIcons.chevronDown),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FieldLabel('Hourly price'),
                    ServTextField(controller: _price),
                  ],
                ),
              ),
            ],
          ),
          gap16,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FieldLabel('Duration'),
                    ServTextField(controller: _duration, suffixIcon: LucideIcons.chevronDown),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FieldLabel('Requirements'),
                    ServTextField(controller: _requirements, maxLines: 2),
                  ],
                ),
              ),
            ],
          ),
          gap16,
          const FieldLabel('Description'),
          ServTextField(controller: _description, maxLines: 3),
          gap18,
          FieldLabel(
            'Photos',
            trailing: Text('2 of 5 added', style: T.small),
          ),
          SizedBox(
            height: 104,
            child: ListView(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              children: [
                Photo(_ownListing()?.asset ?? '', width: 110, height: 104, radius: 12),
                const SizedBox(width: 10),
                Photo('assets/images/interior_window.jpg', width: 110, height: 104, radius: 12),
                const SizedBox(width: 10),
                Container(
                  width: 100,
                  height: 104,
                  decoration: BoxDecoration(
                    color: V.surface,
                    border: Border.all(color: V.line),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(LucideIcons.plus, size: 22, color: V.brand),
                      gap6,
                      Text('Add photo',
                          style: T.small.copyWith(color: V.brand, fontSize: 13.5)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          gap18,
          const FieldLabel('Availability'),
          ServTextField(
            controller: _availability,
            suffixIcon: LucideIcons.chevronDown,
          ),
        ],
      ),
    );
  }
}

class EditServiceScreen extends StatefulWidget {
  const EditServiceScreen({super.key});

  @override
  State<EditServiceScreen> createState() => _EditServiceScreenState();
}

class _EditServiceScreenState extends State<EditServiceScreen> {
  bool _active = true;
  late final TextEditingController _editTitle;
  late final TextEditingController _editCategory;
  late final TextEditingController _editPrice;
  late final TextEditingController _editDescription;

  @override
  void initState() {
    super.initState();
    final listing = _ownListing();
    _editTitle = TextEditingController(text: listing?.title ?? '');
    _editCategory = TextEditingController(text: listing?.category ?? '');
    _editPrice = TextEditingController(
      text: listing == null ? '' : '${listing.price.round()}',
    );
    _editDescription = TextEditingController(text: listing?.description ?? '');
  }

  @override
  void dispose() {
    _editTitle.dispose();
    _editCategory.dispose();
    _editPrice.dispose();
    _editDescription.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Edit your service',
      bottom: CtaBar(
        label: 'Save service',
        link: 'Preview listing',
        onLink: () => _openPublicListing(context),
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Service changes saved!'),
              backgroundColor: V.brandDeep,
            ),
          );
          Navigator.of(context).pop();
        },
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              StatusBadge(_active ? 'Active' : 'Inactive',
                  tone: _active ? BadgeTone.brand : BadgeTone.neutral),
              const Spacer(),
              GestureDetector(
                onTap: () => _openPublicListing(context),
                child: Text('View public listing', style: T.link),
              ),
            ],
          ),
          gap18,
          const FieldLabel('Service title'),
          ServTextField(controller: _editTitle),
          gap16,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FieldLabel('Category'),
                    ServTextField(controller: _editCategory, suffixIcon: LucideIcons.chevronDown),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FieldLabel('Hourly price'),
                    ServTextField(controller: _editPrice),
                  ],
                ),
              ),
            ],
          ),
          gap16,
          const FieldLabel('Description'),
          ServTextField(controller: _editDescription, maxLines: 3),
          gap16,
          Row(
            children: [
              Expanded(
                child: Photo(_ownListing()?.asset ?? '', height: 120, radius: 12),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Photo('assets/images/interior_window.jpg', height: 120, radius: 12),
              ),
            ],
          ),
          gap14,
          Text('2-hour minimum · Boxes ready before arrival',
              style: T.body.copyWith(fontSize: 15)),
          gap18,
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Service is active', style: T.body.copyWith(fontSize: 16)),
                    gap4,
                    Text('Turn off to hide from search',
                        style: T.small.copyWith(fontSize: 14.5)),
                  ],
                ),
              ),
              Switch(
                value: _active,
                onChanged: (v) => setState(() => _active = v),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class WorkingHoursScreen extends StatefulWidget {
  const WorkingHoursScreen({super.key});

  @override
  State<WorkingHoursScreen> createState() => _WorkingHoursScreenState();
}

class _WorkingHoursScreenState extends State<WorkingHoursScreen> {
  final List<String> _unavailableDates = ['Nov 2, 2026', 'Nov 3, 2026'];

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Set your working hours',
      bottom: CtaBar(
        label: 'Save availability',
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Working hours updated!'),
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
            'Customers can request a time during your available hours.',
            style: T.bodyMuted,
          ),
          gap16,
          ServCard(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Column(
              children: [
                for (var i = 0; i < _weeklyHours.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _weeklyHours[i].$1,
                            style: T.body.copyWith(fontSize: 16),
                          ),
                        ),
                        Text(
                          _weeklyHours[i].$2,
                          style: T.body.copyWith(
                            fontSize: 15.5,
                            color: _weeklyHours[i].$2 == 'Unavailable' ? V.muted : V.brand,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          gap20,
          Text('Unavailable dates', style: T.section),
          gap12,
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final date in _unavailableDates)
                ServChip(
                  label: '$date  ×',
                  height: 44,
                  onTap: () => setState(() => _unavailableDates.remove(date)),
                ),
            ],
          ),
          gap14,
          GestureDetector(
            onTap: () {
              final nextDate = 'Nov ${_unavailableDates.length + 4}, 2026';
              setState(() => _unavailableDates.add(nextDate));
            },
            behavior: HitTestBehavior.opaque,
            child: Text('+ Add unavailable date', style: T.link),
          ),
          gap16,
          Text('Time zone · Asia/Manila (PHT)', style: T.small),
        ],
      ),
    );
  }
}

class MateServiceAreaScreen extends StatefulWidget {
  const MateServiceAreaScreen({super.key});

  @override
  State<MateServiceAreaScreen> createState() => _MateServiceAreaScreenState();
}

class _MateServiceAreaScreenState extends State<MateServiceAreaScreen> {
  int _radius = 1;
  static const _radii = ['2 miles', '5 miles', '10 miles'];
  late final TextEditingController _baseArea;
  late final TextEditingController _areaDescription;

  @override
  void initState() {
    super.initState();
    _baseArea = TextEditingController();
    _areaDescription = TextEditingController(
      text: 'Set the barangays and cities you cover around Metro Manila.',
    );
  }

  @override
  void dispose() {
    _baseArea.dispose();
    _areaDescription.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Where do you work?',
      bottom: CtaBar(
        label: 'Save service area',
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Service area saved!'),
              backgroundColor: V.brandDeep,
            ),
          );
          Navigator.of(context).pop();
        },
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const FieldLabel('Base neighborhood'),
          ServTextField(controller: _baseArea),
          gap16,
          const FieldLabel('Service-area description'),
          ServTextField(controller: _areaDescription, maxLines: 3),
          gap20,
          Text('Coverage radius', style: T.section),
          gap12,
          ChipRow(
            children: [
              for (var i = 0; i < _radii.length; i++)
                ServChip(
                  label: _radii[i],
                  selected: _radius == i,
                  onTap: () => setState(() => _radius = i),
                ),
            ],
          ),
          gap16,
          const MapPreview(height: 220, coverageCircle: true),
          gap10,
          Text('Illustrative map · sample pin, not live location', style: T.small),
          gap14,
          const InfoBanner(
            icon: LucideIcons.mapPin,
            title: 'Approximate coverage only',
            body:
                'This sample radius illustrates your service area. It doesn’t use live GPS or geocoding.',
          ),
          gap14,
          Text(
            'Customers see your general service area, not your private home address.',
            style: T.bodyMuted.copyWith(fontSize: 15),
          ),
        ],
      ),
    );
  }
}
