import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show TextInputFormatter;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'theme.dart';

/* ------------------------------------------------------------- primitives */

const gap4 = SizedBox(height: 4);
const gap6 = SizedBox(height: 6);
const gap8 = SizedBox(height: 8);
const gap10 = SizedBox(height: 10);
const gap12 = SizedBox(height: 12);
const gap14 = SizedBox(height: 14);
const gap16 = SizedBox(height: 16);
const gap18 = SizedBox(height: 18);
const gap20 = SizedBox(height: 20);
const gap22 = SizedBox(height: 22);
const gap24 = SizedBox(height: 24);
const gap28 = SizedBox(height: 28);
const gap32 = SizedBox(height: 32);

/// Push helper so screens read as plain statements.
Future<R?> go<R>(BuildContext context, Widget page) {
  return Navigator.of(context).push<R>(
    MaterialPageRoute(builder: (_) => page),
  );
}

/* ------------------------------------------------------------------ brand */

class ServEmLogo extends StatelessWidget {
  const ServEmLogo({super.key, this.size = 44, this.showWordmark = true});

  final double size;
  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    final mark = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: V.brand,
        borderRadius: BorderRadius.circular(size * 0.26),
      ),
      child: Icon(
        Icons.handshake_outlined,
        color: Colors.white,
        size: size * 0.56,
      ),
    );
    if (!showWordmark) return mark;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        SizedBox(width: size * 0.34),
        Text(
          'ServEm',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: size * 0.74,
            fontWeight: FontWeight.w700,
            letterSpacing: -1,
            color: V.brandDeep,
          ),
        ),
      ],
    );
  }
}

/* -------------------------------------------------------------- scaffolding */

/// Standard screen frame: app bar (back + title), scrolling body, sticky CTA.
/// Keeps a phone-first screen readable on a tablet or a desktop window by
/// centring it at a comfortable measure instead of stretching edge to edge.
class ContentFrame extends StatelessWidget {
  const ContentFrame({super.key, required this.child, this.maxWidth = 560});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) => Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: child,
        ),
      );
}

class ScreenScaffold extends StatelessWidget {
  const ScreenScaffold({
    super.key,
    required this.title,
    required this.child,
    this.bottom,
    this.showBack = true,
    this.actions,
    this.scrollable = true,
    this.padding = const EdgeInsets.fromLTRB(V.pad, 8, V.pad, 24),
    this.resizeToAvoidBottomInset = true,
  });

  final String title;
  final Widget child;
  final Widget? bottom;
  final bool showBack;
  final List<Widget>? actions;
  final bool scrollable;
  final EdgeInsets padding;
  final bool resizeToAvoidBottomInset;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      backgroundColor: V.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            ServEmAppBar(
              title: title,
              showBack: showBack,
              actions: actions,
            ),
            Expanded(
              child: scrollable
                  ? SingleChildScrollView(
                      padding: padding,
                      child: ContentFrame(child: child),
                    )
                  : Padding(padding: padding, child: ContentFrame(child: child)),
            ),
            ?bottom,
          ],
        ),
      ),
    );
  }
}

class ServEmAppBar extends StatelessWidget {
  const ServEmAppBar({
    super.key,
    required this.title,
    this.showBack = true,
    this.actions,
    this.subtitle,
  });

  final String title;
  final bool showBack;
  final List<Widget>? actions;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: subtitle == null ? 60 : 72,
      padding: const EdgeInsets.only(left: 16, right: V.pad),
      child: Row(
        children: [
          if (showBack)
            SizedBox(
              width: 52,
              child: InkWell(
                onTap: () => Navigator.of(context).maybePop(),
                borderRadius: BorderRadius.circular(24),
                child: const Padding(
                  padding: EdgeInsets.only(left: 8, top: 12, bottom: 12),
                  child: Icon(LucideIcons.arrowLeft, size: 23, color: V.ink),
                ),
              ),
            )
          else
            const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(title, style: T.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: Text(subtitle!, style: T.small),
                  ),
              ],
            ),
          ),
          ...?actions,
        ],
      ),
    );
  }
}

/// Sticky bottom CTA area: optional link above a full-width button.
class CtaBar extends StatelessWidget {
  const CtaBar({
    super.key,
    required this.label,
    this.onPressed,
    this.link,
    this.onLink,
    this.note,
    this.secondary,
    this.onSecondary,
    this.below,
  });

  final String label;
  final VoidCallback? onPressed;
  final String? link;
  final VoidCallback? onLink;
  final String? note;

  /// Tinted, lower-emphasis button rendered under the primary one.
  final String? secondary;
  final VoidCallback? onSecondary;

  /// Caption rendered under the buttons.
  final String? below;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: V.bg,
      padding: const EdgeInsets.fromLTRB(V.pad, 12, V.pad, 12),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (link != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10, left: 2),
                child: GestureDetector(
                  onTap: onLink,
                  behavior: HitTestBehavior.opaque,
                  child: Text(link!, style: T.link),
                ),
              ),
            if (note != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(note!, style: T.small),
              ),
            PrimaryButton(label: label, onPressed: onPressed),
            if (secondary != null) ...[
              const SizedBox(height: 12),
              SecondaryButton(label: secondary!, onPressed: onSecondary),
            ],
            if (below != null)
              Padding(
                padding: const EdgeInsets.only(top: 10, left: 2),
                child: Text(below!, style: T.small),
              ),
          ],
        ),
      ),
    );
  }
}

/* ----------------------------------------------------------------- buttons */

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.height = V.button,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Material(
        color: V.brand,
        borderRadius: BorderRadius.circular(V.radius),
        child: InkWell(
          borderRadius: BorderRadius.circular(V.radius),
          onTap: onPressed ?? () {},
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, size: 19, color: Colors.white),
                      const SizedBox(width: 8),
                    ],
                    Text(label, style: T.button),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.height = V.button,
  });

  final String label;
  final VoidCallback? onPressed;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Material(
        color: V.tint,
        borderRadius: BorderRadius.circular(V.radius),
        child: InkWell(
          borderRadius: BorderRadius.circular(V.radius),
          onTap: onPressed ?? () {},
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  style: T.button.copyWith(color: V.brand),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Outline / neutral button used for "Decline", "Keep booking", chips actions.
class OutlineButton extends StatelessWidget {
  const OutlineButton({
    super.key,
    required this.label,
    this.onPressed,
    this.height = 44,
    this.expand = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final double height;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final child = SizedBox(
      height: height,
      child: Material(
        color: V.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(V.radius),
          side: const BorderSide(color: V.line),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(V.radius),
          onTap: onPressed ?? () {},
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  style: T.label.copyWith(fontWeight: FontWeight.w500),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: child) : child;
  }
}

/* ------------------------------------------------------------------ cards */

class ServCard extends StatelessWidget {
  const ServCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.onTap,
    this.color = V.surface,
    this.border = true,
    this.radius = V.cardRadius,
  });

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final Color color;
  final bool border;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radius),
      side: BorderSide(color: border ? V.line : Colors.transparent),
    );
    return Material(
      color: color,
      shape: shape,
      child: InkWell(
        borderRadius: BorderRadius.circular(radius),
        onTap: onTap,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

class CardDivider extends StatelessWidget {
  const CardDivider({super.key, this.vertical = 16});
  final double vertical;

  @override
  Widget build(BuildContext context) =>
      Padding(padding: EdgeInsets.symmetric(vertical: vertical), child: const Divider(height: 1));
}

/* ------------------------------------------------------------------- chips */

class ServChip extends StatelessWidget {
  const ServChip({
    super.key,
    required this.label,
    this.selected = false,
    this.onTap,
    this.height = 46,
    this.horizontalPadding = 18,
    this.trailingIcon,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final double height;
  final double horizontalPadding;
  final IconData? trailingIcon;

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
        child: Container(
          height: height,
          alignment: Alignment.center,
          padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: T.smallStrong.copyWith(
                  fontWeight: FontWeight.w500,
                  color: selected ? V.brandDeep : V.ink,
                ),
              ),
              if (trailingIcon != null) ...[
                const SizedBox(width: 8),
                Icon(trailingIcon, size: 16, color: selected ? V.brand : V.muted),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Filter row that scrolls horizontally.
class ChipRow extends StatelessWidget {
  const ChipRow({super.key, required this.children, this.gap = 10});
  final List<Widget> children;
  final double gap;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: Row(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) SizedBox(width: gap),
            children[i],
          ],
        ],
      ),
    );
  }
}

/// Segmented control with a soft track and a white selected pill.
class Segmented extends StatelessWidget {
  const Segmented({
    super.key,
    required this.labels,
    required this.index,
    required this.onChanged,
  });

  final List<String> labels;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: V.soft,
        borderRadius: BorderRadius.circular(V.radius),
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: i == index ? V.surface : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        labels[i],
                        maxLines: 1,
                        style: T.smallStrong.copyWith(
                          fontSize: 15,
                          fontWeight: i == index ? FontWeight.w600 : FontWeight.w500,
                          color: i == index ? V.ink : V.muted,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.label, {super.key, this.tone = BadgeTone.brand});

  final String label;
  final BadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      BadgeTone.brand => (V.tint, V.brandDeep),
      BadgeTone.warning => (V.warnBg, V.warnFg),
      BadgeTone.neutral => (V.soft, V.muted),
      BadgeTone.danger => (V.dangerBg, V.dangerFg),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: T.micro.copyWith(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: fg,
          height: 1.2,
        ),
      ),
    );
  }
}

enum BadgeTone { brand, warning, neutral, danger }

/* ----------------------------------------------------------------- banners */

class InfoBanner extends StatelessWidget {
  const InfoBanner({
    super.key,
    required this.title,
    this.body,
    this.icon = LucideIcons.info,
    this.tone = BadgeTone.brand,
    this.trailing,
  });

  final String title;
  final String? body;
  final IconData icon;
  final BadgeTone tone;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      BadgeTone.brand => (V.tint, V.brand),
      BadgeTone.warning => (V.warnBg, V.warnFg),
      BadgeTone.neutral => (V.soft, V.muted),
      BadgeTone.danger => (V.dangerBg, V.dangerFg),
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(V.cardRadius),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Icon(icon, size: 21, color: fg),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: T.label.copyWith(fontSize: 15.5)),
                if (body != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 5),
                    child: Text(body!, style: T.small.copyWith(height: 1.5)),
                  ),
              ],
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(width: 8),
            trailing!,
          ],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ fields */

class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key, this.optional = false, this.trailing});

  final String text;
  final bool optional;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(text, style: T.label),
          if (optional)
            Text('  (optional)',
                style: T.label.copyWith(
                    fontWeight: FontWeight.w400, color: V.muted)),
          const Spacer(),
          ?trailing,
        ],
      ),
    );
  }
}

class ServTextField extends StatefulWidget {
  const ServTextField({
    super.key,
    this.controller,
    this.hint,
    this.initialValue,
    this.obscure = false,
    this.maxLines = 1,
    this.keyboardType,
    this.suffixIcon,
    this.onSuffixTap,
    this.suffixTooltip,
    this.error,
    this.onChanged,
    this.onBlur,
    this.readOnly = false,
    this.focusNode,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.inputFormatters,
    this.autofillHints,
    this.semanticsLabel,
  });

  final TextEditingController? controller;
  final String? hint;
  final String? initialValue;
  final bool obscure;
  final int maxLines;
  final TextInputType? keyboardType;

  /// A decorative glyph — a chevron, say. With [onSuffixTap] it becomes a real
  /// button, and [suffixTooltip] is what TalkBack/VoiceOver announces for it.
  final IconData? suffixIcon;
  final VoidCallback? onSuffixTap;
  final String? suffixTooltip;
  final String? error;
  final ValueChanged<String>? onChanged;

  /// Called when the field loses focus, so screens can validate inline.
  final VoidCallback? onBlur;
  final bool readOnly;
  final FocusNode? focusNode;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final List<TextInputFormatter>? inputFormatters;
  final Iterable<String>? autofillHints;
  final String? semanticsLabel;

  @override
  State<ServTextField> createState() => _ServTextFieldState();
}

class _ServTextFieldState extends State<ServTextField> {
  FocusNode? _ownedNode;

  /// The caller's node when supplied, otherwise one owned by this widget.
  FocusNode get _node =>
      widget.focusNode ?? (_ownedNode ??= FocusNode(debugLabel: 'ServTextField'));

  @override
  void initState() {
    super.initState();
    _node.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(covariant ServTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.focusNode != oldWidget.focusNode) {
      (oldWidget.focusNode ?? _ownedNode)?.removeListener(_onFocusChange);
      _node.addListener(_onFocusChange);
    }
  }

  /// TextField has no onBlur of its own, so blur is derived from the node.
  void _onFocusChange() {
    if (!_node.hasFocus) widget.onBlur?.call();
  }

  @override
  void dispose() {
    _node.removeListener(_onFocusChange);
    _ownedNode?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(V.radius),
      borderSide: BorderSide(color: widget.error == null ? V.line : V.dangerFg),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: widget.controller,
          obscureText: widget.obscure,
          maxLines: widget.maxLines,
          readOnly: widget.readOnly,
          keyboardType: widget.keyboardType,
          onChanged: widget.onChanged,
          focusNode: _node,
          textInputAction: widget.textInputAction,
          textCapitalization: widget.textCapitalization,
          inputFormatters: widget.inputFormatters,
          autofillHints: widget.autofillHints,
          style: T.body.copyWith(height: 1.35),
          decoration: InputDecoration(
            hintText: widget.hint,
            hintStyle: T.bodyMuted.copyWith(height: 1.35),
            // errorText keeps the message inside the field's own semantics, so
            // TalkBack/VoiceOver announces it together with the control.
            errorText: widget.error,
            errorStyle: T.small.copyWith(color: V.dangerFg, height: 1.4),
            errorMaxLines: 3,
            labelText: widget.semanticsLabel,
            labelStyle: T.small,
            floatingLabelBehavior: FloatingLabelBehavior.never,
            filled: true,
            fillColor: V.surface,
            contentPadding: EdgeInsets.symmetric(
              horizontal: 18,
              vertical: widget.maxLines > 1 ? 16 : 0,
            ),
            constraints:
                BoxConstraints(minHeight: widget.maxLines > 1 ? 0 : V.button),
            border: border,
            enabledBorder: border,
            focusedBorder: border.copyWith(
              borderSide: BorderSide(
                color: widget.error == null ? V.brand : V.dangerFg,
                width: 1.4,
              ),
            ),
            suffixIcon: widget.suffixIcon == null
                ? null
                : Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: widget.onSuffixTap == null
                        ? Icon(widget.suffixIcon, size: 20, color: V.muted)
                        : IconButton(
                            onPressed: widget.onSuffixTap,
                            tooltip: widget.suffixTooltip,
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                            constraints: const BoxConstraints(
                              minWidth: 44,
                              minHeight: 44,
                            ),
                            icon: Icon(
                              widget.suffixIcon,
                              size: 20,
                              color: V.muted,
                            ),
                          ),
                  ),
            suffixIconConstraints: const BoxConstraints(minWidth: 44),
          ),
        ),
      ],
    );
  }
}

class SearchBox extends StatelessWidget {
  const SearchBox({
    super.key,
    required this.hint,
    this.onTap,
    this.onChanged,
    this.controller,
    this.autofocus = false,
  });

  final String hint;
  final VoidCallback? onTap;
  final ValueChanged<String>? onChanged;
  final TextEditingController? controller;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: V.button,
      decoration: BoxDecoration(
        color: V.surface,
        border: Border.all(color: V.line),
        borderRadius: BorderRadius.circular(V.radius),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          const Icon(LucideIcons.search, size: 21, color: V.muted),
          const SizedBox(width: 12),
          Expanded(
            child: controller == null
                ? GestureDetector(
                    onTap: onTap,
                    behavior: HitTestBehavior.opaque,
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(hint, style: T.bodyMuted.copyWith(height: 1.2)),
                    ),
                  )
                : TextField(
                    controller: controller,
                    autofocus: autofocus,
                    onChanged: onChanged,
                    style: T.body.copyWith(height: 1.2),
                    decoration: InputDecoration(
                      isDense: true,
                      border: InputBorder.none,
                      hintText: hint,
                      hintStyle: T.bodyMuted.copyWith(height: 1.2),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------- lists */

class NavRow extends StatelessWidget {
  const NavRow({
    super.key,
    this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.showChevron = true,
    this.padding = const EdgeInsets.symmetric(vertical: 16),
    this.titleStyle,
  });

  final IconData? icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool showChevron;
  final EdgeInsets padding;
  final TextStyle? titleStyle;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: padding,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 23, color: V.muted),
              const SizedBox(width: 18),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: titleStyle ?? T.body.copyWith(height: 1.3)),
                  if (subtitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Text(subtitle!,
                          style: T.small.copyWith(height: 1.45)),
                    ),
                ],
              ),
            ),
            ?trailing,
            if (showChevron)
              const Padding(
                padding: EdgeInsets.only(left: 6),
                child: Icon(LucideIcons.chevronRight, size: 20, color: V.muted),
              ),
          ],
        ),
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.action,
    this.onAction,
    this.padding = const EdgeInsets.only(bottom: 14),
  });

  final String title;
  final String? action;
  final VoidCallback? onAction;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        children: [
          Expanded(child: Text(title, style: T.section)),
          if (action != null)
            GestureDetector(
              onTap: onAction,
              child: Text(action!, style: T.link),
            ),
        ],
      ),
    );
  }
}

class KeyValueRow extends StatelessWidget {
  const KeyValueRow({
    super.key,
    required this.label,
    required this.value,
    this.valueStyle,
    this.divider = false,
  });

  final String label;
  final String value;
  final TextStyle? valueStyle;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              Expanded(child: Text(label, style: T.bodyMuted.copyWith(height: 1.3))),
              Text(value, style: valueStyle ?? T.body.copyWith(height: 1.3)),
            ],
          ),
        ),
        if (divider) const Divider(height: 1),
      ],
    );
  }
}

/* ------------------------------------------------------------------ visuals */

class Photo extends StatelessWidget {
  const Photo(
    this.asset, {
    super.key,
    this.width,
    this.height,
    this.radius = V.radius,
    this.fit = BoxFit.cover,
  });

  final String asset;
  final double? width;
  final double? height;
  final double radius;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Image.asset(
        asset,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, _, _) => Container(
          width: width,
          height: height,
          color: V.soft,
        ),
      ),
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar(this.asset, {super.key, this.size = 52, this.initials});

  final String asset;
  final double size;
  final String? initials;

  @override
  Widget build(BuildContext context) {
    if (asset.isEmpty && initials != null) {
      return Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: const BoxDecoration(color: V.tint, shape: BoxShape.circle),
        child: Text(
          initials!,
          style: T.label.copyWith(color: V.brandDeep, fontSize: size * 0.33),
        ),
      );
    }
    return ClipOval(
      child: Image.asset(
        asset,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) =>
            Container(width: size, height: size, color: V.soft),
      ),
    );
  }
}

class StarRow extends StatelessWidget {
  const StarRow({super.key, this.rating = 5, this.size = 18, this.color = V.brand});

  final int rating;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < 5; i++)
          Padding(
            padding: EdgeInsets.only(right: i == 4 ? 0 : 3),
            child: Icon(
              i < rating ? Icons.star_rounded : Icons.star_outline_rounded,
              size: size,
              color: i < rating ? color : V.muted,
            ),
          ),
      ],
    );
  }
}

class RatingInline extends StatelessWidget {
  const RatingInline(this.rating, {super.key, this.count});
  final String rating;
  final String? count;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.star_rounded, size: 17, color: V.ink),
        const SizedBox(width: 5),
        Text(rating, style: T.smallStrong.copyWith(fontWeight: FontWeight.w500)),
        if (count != null)
          Text(' · $count', style: T.small),
      ],
    );
  }
}

/// Card that wraps the illustrated map with an address line.
class MapAddressCard extends StatelessWidget {
  const MapAddressCard({
    super.key,
    required this.address,
    this.title = 'Confirmed service address',
    this.caption = 'Illustrative map · sample pin, not live location',
    this.mapHeight = 132,
    this.linkLabel,
    this.onLink,
  });

  final String address;
  final String title;
  final String caption;
  final double mapHeight;
  final String? linkLabel;
  final VoidCallback? onLink;

  @override
  Widget build(BuildContext context) {
    return ServCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: T.label.copyWith(fontSize: 16)),
          gap10,
          Text(address, style: T.body.copyWith(fontSize: 15.5)),
          gap14,
          MapPreview(height: mapHeight, radius: 12),
          gap10,
          Text(caption, style: T.small),
          if (linkLabel != null) ...[
            gap10,
            GestureDetector(
              onTap: onLink,
              behavior: HitTestBehavior.opaque,
              child: Text(linkLabel!, style: T.link),
            ),
          ],
        ],
      ),
    );
  }
}

/// Vertical progress list used by booking and job status screens.
class StatusSteps extends StatelessWidget {
  const StatusSteps({
    super.key,
    required this.steps,
    required this.current,
    this.showBadge = true,
  });

  final List<String> steps;
  final int current;
  final bool showBadge;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < steps.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 7),
            child: Row(
              children: [
                SizedBox(
                  width: 26,
                  height: 26,
                  child: i < current
                      ? Container(
                          decoration: const BoxDecoration(
                            color: V.tint,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(LucideIcons.check,
                              size: 15, color: V.brand),
                        )
                      : i == current
                          ? Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: V.brand, width: 2),
                              ),
                              alignment: Alignment.center,
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: V.brand,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            )
                          : Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: V.line, width: 2),
                              ),
                            ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    steps[i],
                    style: i <= current
                        ? T.body.copyWith(
                            fontSize: 16,
                            fontWeight:
                                i == current ? FontWeight.w600 : FontWeight.w400,
                          )
                        : T.bodyMuted.copyWith(fontSize: 16),
                  ),
                ),
                if (showBadge && i == current)
                  const StatusBadge('Current'),
              ],
            ),
          ),
      ],
    );
  }
}

/// The illustration map used across the booking / job screens.
class MapPreview extends StatelessWidget {
  const MapPreview({
    super.key,
    this.height = 220,
    this.radius = 20,
    this.showPin = true,
    this.coverageCircle = false,
    this.label = 'METRO MANILA · SAMPLE',
  });

  final double height;
  final double radius;
  final bool showPin;
  final bool coverageCircle;
  final String? label;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: Stack(
          children: [
            const Positioned.fill(child: ColoredBox(color: Color(0xFFF1F6F2))),
            Positioned.fill(
              child: Padding(
                padding: const EdgeInsets.all(9),
                child: Column(
                  children: [
                    for (var r = 0; r < 4; r++) ...[
                      if (r > 0) const SizedBox(height: 9),
                      Expanded(
                        child: Row(
                          children: [
                            for (var c = 0; c < 4; c++) ...[
                              if (c > 0) const SizedBox(width: 9),
                              Expanded(
                                flex: [6, 7, 7, 4][c],
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFE7EFE9),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (coverageCircle)
              Center(
                child: Container(
                  width: height * 1.15,
                  height: height * 1.15,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: V.brand.withValues(alpha: 0.06),
                    border: Border.all(color: V.brand, width: 1.2),
                  ),
                ),
              ),
            if (showPin)
              Center(
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: V.brand.withValues(alpha: 0.16),
                      ),
                    ),
                    Container(
                      width: 34,
                      height: 34,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: V.brand,
                      ),
                      alignment: Alignment.center,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (showPin)
              Center(
                child: Padding(
                  padding: const EdgeInsets.only(left: 118),
                  child: Container(
                    width: 110,
                    height: 42,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD8EEE1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            if (label != null)
              Positioned(
                left: 26,
                bottom: 24,
                child: Text(
                  label!,
                  style: T.micro.copyWith(
                    fontSize: 10.5,
                    letterSpacing: 1.4,
                    fontWeight: FontWeight.w500,
                    color: const Color(0xFF8B9C92),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Centered empty / success / error state used by the shared UI-state screens.
class StateBlock extends StatelessWidget {
  const StateBlock({
    super.key,
    required this.icon,
    required this.title,
    this.body,
    this.iconTone = BadgeTone.brand,
    this.children = const [],
  });

  final IconData icon;
  final String title;
  final String? body;
  final BadgeTone iconTone;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (iconTone) {
      BadgeTone.brand => (V.tint, V.brand),
      BadgeTone.warning => (V.warnBg, V.warnFg),
      BadgeTone.neutral => (V.soft, V.muted),
      BadgeTone.danger => (V.dangerBg, V.dangerFg),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 76,
          height: 76,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Icon(icon, size: 32, color: fg),
        ),
        const SizedBox(height: 22),
        Text(title, textAlign: TextAlign.center, style: T.h2),
        if (body != null) ...[
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(body!, textAlign: TextAlign.center, style: T.bodyMuted),
          ),
        ],
        ...children,
      ],
    );
  }
}

/* ---------------------------------------------------------------- nav bar */

class NavItem {
  const NavItem(this.icon, this.label);
  final IconData icon;
  final String label;
}

const customerNav = [
  NavItem(LucideIcons.home, 'Home'),
  NavItem(LucideIcons.search, 'Explore'),
  NavItem(LucideIcons.calendar, 'Bookings'),
  NavItem(LucideIcons.messageCircle, 'Messages'),
  NavItem(LucideIcons.user2, 'Profile'),
];

const mateNav = [
  NavItem(LucideIcons.home, 'Home'),
  NavItem(LucideIcons.inbox, 'Requests'),
  NavItem(LucideIcons.calendar, 'My Jobs'),
  NavItem(LucideIcons.wallet, 'Earnings'),
  NavItem(LucideIcons.user2, 'Profile'),
];

/// A pushed screen that keeps the tab bar (search results, categories, …).
class ShellScreen extends StatelessWidget {
  const ShellScreen({
    super.key,
    required this.title,
    required this.child,
    this.navIndex = 0,
    this.items = customerNav,
    this.actions,
    this.scrollable = true,
    this.padding = const EdgeInsets.fromLTRB(V.pad, 8, V.pad, 24),
    this.bottom,
  });

  final String title;
  final Widget child;
  final int navIndex;
  final List<NavItem> items;
  final List<Widget>? actions;
  final bool scrollable;
  final EdgeInsets padding;
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: V.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            ServEmAppBar(title: title, actions: actions),
            Expanded(
              child: scrollable
                  ? SingleChildScrollView(padding: padding, child: child)
                  : Padding(padding: padding, child: child),
            ),
            ?bottom,
            BottomNav(
              items: items,
              index: navIndex,
              onChanged: (i) {
                if (items == customerNav) {
                  SessionHooks.openCustomerTab(context, i);
                } else {
                  SessionHooks.openMateTab(context, i);
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// Indirection so this file does not import the app root (avoiding a cycle).
class SessionHooks {
  SessionHooks._();
  static void Function(BuildContext, int) openCustomerTab = (_, _) {};
  static void Function(BuildContext, int) openMateTab = (_, _) {};
}

class BottomNav extends StatelessWidget {
  const BottomNav({
    super.key,
    required this.items,
    required this.index,
    required this.onChanged,
  });

  final List<NavItem> items;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFFBFDFC),
        border: Border(top: BorderSide(color: V.line)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 66,
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: InkWell(
                    onTap: () => onChanged(i),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          items[i].icon,
                          size: 23,
                          color: i == index ? V.brand : V.muted,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          items[i].label,
                          style: T.micro.copyWith(
                            fontSize: 11.5,
                            height: 1.1,
                            fontWeight:
                                i == index ? FontWeight.w600 : FontWeight.w400,
                            color: i == index ? V.brand : V.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A screen that only exists as a state: icon tile, headline, body, CTA.
class StateScreen extends StatelessWidget {
  const StateScreen({
    super.key,
    required this.title,
    required this.stateTitle,
    required this.icon,
    this.body,
    this.cta,
    this.onCta,
    this.link,
    this.onLink,
    this.iconTone = BadgeTone.brand,
    this.children = const [],
    this.showBack = true,
  });

  final String title;
  final String stateTitle;
  final String? body;
  final IconData icon;
  final BadgeTone iconTone;
  final String? cta;
  final VoidCallback? onCta;
  final String? link;
  final VoidCallback? onLink;
  final List<Widget> children;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: title,
      showBack: showBack,
      padding: const EdgeInsets.fromLTRB(V.pad, 28, V.pad, 24),
      bottom: cta == null
          ? null
          : CtaBar(label: cta!, onPressed: onCta, link: link, onLink: onLink),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          StateBlock(
            icon: icon,
            title: stateTitle,
            body: body,
            iconTone: iconTone,
            children: children,
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------- skeletons */

/// A placeholder block for content that is still loading. The pulse stops and
/// holds a mid tone when the platform asks for reduced motion.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.width, this.height = 14, this.radius = 8});

  final double? width;
  final double height;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.stop();
      _controller.value = 0.45;
    } else if (!_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: Color.lerp(V.soft, V.tint, _controller.value * 0.6),
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

/// The loading frame for a list screen: a title bar and [rows] placeholder
/// cards that keep the layout from jumping when the real data arrives.
class SkeletonList extends StatelessWidget {
  const SkeletonList({
    super.key,
    this.rows = 4,
    this.padding = const EdgeInsets.all(V.pad),
  });

  final int rows;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Skeleton(width: 160, height: 22),
          gap20,
          for (var index = 0; index < rows; index++) ...[
            Row(
              children: [
                const Skeleton(width: 56, height: 56, radius: 14),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Skeleton(height: 16),
                      gap8,
                      Skeleton(width: index.isEven ? 200 : 150, height: 12),
                    ],
                  ),
                ),
              ],
            ),
            if (index < rows - 1) gap18,
          ],
        ],
      ),
    );
  }
}

/* --------------------------------------------------------------- sheet util */

Future<R?> showServEmSheet<R>(BuildContext context, Widget child) {
  return showModalBottomSheet<R>(
    context: context,
    backgroundColor: V.surface,
    isScrollControlled: true,
    barrierColor: V.ink.withValues(alpha: 0.42),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (_) => SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(V.pad, 26, V.pad, 20),
        child: child,
      ),
    ),
  );
}
