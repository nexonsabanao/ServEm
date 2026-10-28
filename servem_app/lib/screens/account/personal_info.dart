import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app.dart';
import '../../design/theme.dart';

class PersonalInfoScreen extends StatefulWidget {
  const PersonalInfoScreen({super.key});

  @override
  State<PersonalInfoScreen> createState() => _PersonalInfoScreenState();
}

class _PersonalInfoScreenState extends State<PersonalInfoScreen> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _preferredCtrl;

  @override
  void initState() {
    super.initState();
    final profile = AppState.instance.userProfile.value;
    _nameCtrl = TextEditingController(text: profile.name);
    _emailCtrl = TextEditingController(text: profile.email);
    _phoneCtrl = TextEditingController(text: profile.phone);
    _preferredCtrl = TextEditingController(text: profile.preferredName);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _preferredCtrl.dispose();
    super.dispose();
  }

  void _save() {
    AppState.instance.updateUserProfile(
      name: _nameCtrl.text.trim(),
      email: _emailCtrl.text.trim(),
      phone: _phoneCtrl.text.trim(),
      preferredName: _preferredCtrl.text.trim(),
    );
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Changes saved successfully.'),
        backgroundColor: V.brandDeep,
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Personal information',
      bottom: CtaBar(
        label: 'Save changes',
        onPressed: _save,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Avatar(AppState.instance.userProfile.value.avatar, size: 84),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GestureDetector(
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Photo upload isn’t available on mobile yet'),
                            backgroundColor: V.brandDeep,
                          ),
                        );
                      },
                      child: Text('Change photo', style: T.link.copyWith(fontSize: 16)),
                    ),
                    gap6,
                    Text('JPG or PNG ·\nup to 5 MB', style: T.small.copyWith(fontSize: 14.5)),
                  ],
                ),
              ),
            ],
          ),
          gap22,
          const FieldLabel('Full name'),
          ServTextField(controller: _nameCtrl),
          gap16,
          const FieldLabel('Email address'),
          ServTextField(controller: _emailCtrl, keyboardType: TextInputType.emailAddress),
          gap16,
          const FieldLabel('Phone number'),
          ServTextField(controller: _phoneCtrl, keyboardType: TextInputType.phone),
          gap16,
          const FieldLabel('Preferred name', optional: true),
          ServTextField(controller: _preferredCtrl),
          gap18,
          const InfoBanner(
            icon: LucideIcons.lock,
            title: 'Your information stays yours',
            body:
                'Your phone and service address are shared with your ServMate only for a confirmed booking.',
          ),
        ],
      ),
    );
  }
}
