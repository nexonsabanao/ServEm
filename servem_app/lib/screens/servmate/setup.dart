import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';
import '../customer/service_detail.dart';
import 'services.dart';

class BecomeServMateScreen extends StatelessWidget {
  const BecomeServMateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final account = AppState.instance.userProfile.value;
    final holderName = account.name.isEmpty ? 'Your account' : account.name;
    final holderEmail =
        account.email.isEmpty ? 'Sign in to sync your details' : account.email;
    return ScreenScaffold(
      title: 'Become a ServMate',
      bottom: CtaBar(
        label: 'Start ServMate setup',
        onPressed: () => go(context, const MateProfileSetupScreen()),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: Image.asset(
              'assets/images/assembly_scene.jpg',
              height: 176,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
          gap16,
          Text('Your skills. Someone’s day made.', style: T.h3),
          gap10,
          Text(
            'Offer local services, set your hours, and make everyday life a little easier.',
            style: T.bodyMuted,
          ),
          gap18,
          Container(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
            decoration: BoxDecoration(
              color: V.tint,
              borderRadius: BorderRadius.circular(V.cardRadius),
              border: Border.all(color: V.brand),
            ),
            child: Row(
              children: [
                const Icon(LucideIcons.checkCircle2, size: 24, color: V.brand),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Set up as an individual',
                          style: T.label.copyWith(fontSize: 16)),
                      gap4,
                      Text('$holderName · $holderEmail',
                          style: T.small.copyWith(fontSize: 14.5)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          gap14,
          ServCard(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Column(
              children: [
                NavRow(
                  icon: LucideIcons.user2,
                  title: 'Build your profile',
                  subtitle: 'Show customers what you do best',
                  onTap: () => go(context, const MateProfileSetupScreen()),
                ),
                const Divider(height: 1),
                NavRow(
                  icon: LucideIcons.wrench,
                  title: 'Add your services',
                  subtitle: 'Choose prices, hours and service area',
                  onTap: () => go(context, const MateServiceAreaScreen()),
                ),
                const Divider(height: 1),
                NavRow(
                  icon: LucideIcons.clipboardCheck,
                  title: 'Verify your identity',
                  subtitle: 'Government ID · reviewed by our team',
                  onTap: () => go(context, const VerificationScreen()),
                ),
              ],
            ),
          ),
          gap14,
          Text(
            'By continuing, you agree to the ServMate terms and service policy.',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

class MateProfileSetupScreen extends StatefulWidget {
  const MateProfileSetupScreen({super.key});

  @override
  State<MateProfileSetupScreen> createState() => _MateProfileSetupScreenState();
}

class _MateProfileSetupScreenState extends State<MateProfileSetupScreen> {
  late final TextEditingController _displayName;
  late final TextEditingController _bio;
  late final TextEditingController _experience;
  late final TextEditingController _contactEmail;
  late final String _avatar;
  final Set<String> _skills = {'Furniture assembly', 'Small repairs'};

  @override
  void initState() {
    super.initState();
    final mate = AppState.instance.mateProfile.value;
    final account = AppState.instance.userProfile.value;
    _avatar = mate.asset.isNotEmpty ? mate.asset : account.avatar;
    _displayName = TextEditingController(text: mate.name);
    _bio = TextEditingController(
      text: mate.bio.isNotEmpty
          ? mate.bio
          : 'Careful assembly and small repairs. I bring my tools and leave your space tidy.',
    );
    _experience = TextEditingController(text: '5 years of hands-on assembly');
    _contactEmail = TextEditingController(text: account.email);
  }

  @override
  void dispose() {
    _displayName.dispose();
    _bio.dispose();
    _experience.dispose();
    _contactEmail.dispose();
    super.dispose();
  }

  void _save() {
    AppState.instance.updateMateProfile(
      name: _displayName.text.trim(),
      bio: _bio.text.trim(),
      tags: _skills.toList(),
    );
    go(context, const VerificationScreen());
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Tell your neighborhood',
      bottom: CtaBar(
        label: 'Save & continue',
        onPressed: _save,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Avatar(_avatar, size: 84),
              const SizedBox(width: 18),
              GestureDetector(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Photo upload isn’t available on mobile yet'),
                      backgroundColor: V.brandDeep,
                    ),
                  );
                },
                child: Text('Change profile photo', style: T.link.copyWith(fontSize: 16)),
              ),
            ],
          ),
          gap20,
          const FieldLabel('Display name'),
          ServTextField(controller: _displayName),
          gap16,
          const FieldLabel('Bio'),
          ServTextField(controller: _bio, maxLines: 3),
          gap14,
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final skill in ['Furniture assembly', 'Small repairs', 'Painting', 'Mounting'])
                ServChip(
                  label: skill,
                  height: 44,
                  selected: _skills.contains(skill),
                  onTap: () {
                    setState(() {
                      if (!_skills.remove(skill)) {
                        _skills.add(skill);
                      }
                    });
                  },
                ),
            ],
          ),
          gap18,
          const FieldLabel('Experience'),
          ServTextField(controller: _experience),
          gap16,
          const FieldLabel('Contact email'),
          ServTextField(controller: _contactEmail),
          gap14,
          Text('Contact preference · In-app messages first',
              style: T.bodyMuted.copyWith(fontSize: 15)),
          gap6,
          Text('Your phone is shared only for accepted jobs.', style: T.small),
        ],
      ),
    );
  }
}

class VerificationScreen extends StatelessWidget {
  const VerificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Verification',
      bottom: CtaBar(
        label: 'Submit for review',
        onPressed: () => go(context, const VerificationPendingScreen()),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const InfoBanner(
            icon: LucideIcons.shieldCheck,
            title: 'Checked by our team',
            body:
                'Your government ID is reviewed before your listing goes live. '
                'Only verified ServMates can accept bookings.',
          ),
          gap18,
          Text('Add your ID', style: T.h3),
          gap10,
          Text(
            'Upload a clear photo of your government ID to start the review.',
            style: T.bodyMuted,
          ),
          gap16,
          CustomPaint(
            painter: _DashedBorderPainter(),
            child: Container(
              height: 200,
              width: double.infinity,
              color: Colors.transparent,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(LucideIcons.upload, size: 30, color: V.brand),
                  gap16,
                  Text('Choose a document',
                      style: T.label.copyWith(fontSize: 16.5)),
                  gap10,
                  Text('JPG, PNG or PDF · up to 10 MB', style: T.small),
                ],
              ),
            ),
          ),
          gap18,
          const FieldLabel('Document type'),
          Container(
            height: V.button,
            padding: const EdgeInsets.symmetric(horizontal: 18),
            decoration: BoxDecoration(
              color: V.surface,
              border: Border.all(color: V.line),
              borderRadius: BorderRadius.circular(V.radius),
            ),
            child: Row(
              children: [
                Expanded(child: Text('Government ID', style: T.body.copyWith(height: 1.2))),
                const Icon(LucideIcons.chevronDown, size: 20, color: V.muted),
              ],
            ),
          ),
          gap16,
          ServCard(
            padding: const EdgeInsets.fromLTRB(20, 18, 18, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(LucideIcons.fileText, size: 24, color: V.muted),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('government-id.jpg', style: T.body.copyWith(fontSize: 16)),
                          gap4,
                          Text('Required · 1 file', style: T.small.copyWith(fontSize: 14.5)),
                        ],
                      ),
                    ),
                    const Icon(LucideIcons.chevronRight, size: 20, color: V.muted),
                  ],
                ),
                const Divider(height: 24),
                GestureDetector(
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Photo upload isn’t available on mobile yet'),
                        backgroundColor: V.brandDeep,
                      ),
                    );
                  },
                  child: Text('Replace file', style: T.link),
                ),
              ],
            ),
          ),
          gap14,
          const Align(
            alignment: Alignment.centerLeft,
            child: StatusBadge('Not submitted', tone: BadgeTone.neutral),
          ),
          gap12,
          Text(
            'Review usually finishes within 24 hours. We’ll notify you the moment '
            'your profile goes live.',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

/// The waiting state after a ServMate sends their documents for review.
class VerificationPendingScreen extends StatelessWidget {
  const VerificationPendingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Verification',
      bottom: CtaBar(
        label: 'Continue to your profile',
        onPressed: () => go(context, const PublicProfileScreen()),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const StateBlock(
            icon: LucideIcons.fileText,
            title: 'Documents submitted',
            body:
                'Your ID is queued for review. Our team checks every submission '
                'before your listing appears to customers.',
          ),
          gap20,
          const InfoBanner(
            icon: LucideIcons.clock,
            tone: BadgeTone.warning,
            title: 'Under review',
            body: 'Expect a decision within 24 hours. We’ll send a notification.',
          ),
        ],
      ),
    );
  }
}

class PublicProfileScreen extends StatelessWidget {
  const PublicProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([
        AppState.instance.mateProfile,
        AppState.instance.reviews,
        AppState.instance.services,
      ]),
      builder: (context, _) {
        final provider = AppState.instance.mateProfile.value;
        final reviewsMap = AppState.instance.reviews.value;
        final providerReviews = reviewsMap[provider.name] ?? [];
        final services = AppState.instance.services.value;
        final providerServices = services.where((s) => s.provider.name == provider.name).toList();

        final avg = providerReviews.isNotEmpty
            ? (providerReviews.map((r) => r.rating).reduce((a, b) => a + b) / providerReviews.length)
                .toStringAsFixed(1)
            : provider.rating;

        return ShellScreen(
          title: 'Your public profile',
          navIndex: 4,
          items: mateNav,
          bottom: CtaBar(
            label: 'Edit profile',
            onPressed: () => go(context, const MateProfileSetupScreen()),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Align(
                alignment: Alignment.centerLeft,
                child: StatusBadge('Customer preview'),
              ),
              gap12,
              Row(
                children: [
                  Avatar(provider.asset, size: 62),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(provider.name, style: T.cardTitle.copyWith(fontSize: 18)),
                        gap4,
                        Text(
                          '★ $avg · ${providerReviews.length + 84} reviews · ${provider.jobs} jobs',
                          style: T.small,
                        ),
                      ],
                    ),
                  ),
                  const Icon(LucideIcons.chevronRight, size: 20, color: V.brand),
                ],
              ),
              gap12,
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Icon(Icons.star_rounded, size: 26, color: V.brandDeep),
                  const SizedBox(width: 6),
                  Text(avg, style: T.h2.copyWith(color: V.brandDeep)),
                  const SizedBox(width: 6),
                  Text('${providerReviews.length + 84} reviews · ${provider.jobs} completed jobs',
                      style: T.small),
                ],
              ),
              gap16,
              Text('About ${provider.name.split(' ').first}', style: T.section),
              gap8,
              Text(
                provider.bio.isNotEmpty
                    ? provider.bio
                    : 'Careful assembly and small repairs, backed by five years of hands-on experience. Tools included, with a tidy finish.',
                style: T.bodyMuted,
              ),
              gap14,
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final tag in provider.tags)
                    ServChip(label: tag, height: 44),
                ],
              ),
              gap16,
              Text(
                'Service area · Within 5 km of ${provider.area}',
                style: T.body.copyWith(fontSize: 15),
              ),
              gap16,
              Text('Available services', style: T.section),
              gap12,
              for (final service in providerServices) ...[
                ServCard(
                  onTap: () => go(context, ServiceDetailScreen(service: service)),
                  child: Row(
                    children: [
                      Photo(service.asset, width: 76, height: 76),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(service.title, style: T.cardTitle),
                            gap6,
                            Text('${service.provider.name} · ${service.distance}',
                                style: T.small),
                            gap8,
                            Row(
                              children: [
                                Text(service.priceLabel,
                                    style: T.smallStrong.copyWith(
                                        fontSize: 16, color: V.brand)),
                                const Spacer(),
                                Text('★ ${service.rating}', style: T.small),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                gap14,
              ],
              if (providerReviews.isNotEmpty) ...[
                ServCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(providerReviews.first.author, style: T.label.copyWith(fontSize: 16)),
                          const SizedBox(width: 8),
                          StarRow(rating: providerReviews.first.rating, size: 18),
                        ],
                      ),
                      gap10,
                      Text(
                        providerReviews.first.text.startsWith('“')
                            ? providerReviews.first.text
                            : '“${providerReviews.first.text}”',
                        style: T.body.copyWith(fontSize: 15.5),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = V.line
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(14),
    );
    final path = Path()..addRRect(rrect);
    const dash = 6.0;
    const gap = 5.0;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(
          metric.extractPath(distance, distance + dash),
          paint,
        );
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
