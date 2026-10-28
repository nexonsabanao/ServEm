export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    // The track stays 18px tall to match the board, but the switch itself is a
    // 24px-tall target (WCAG 2.5.8) with the track centred inside it.
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-[24px] w-[34px] shrink-0 items-center disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={`relative block h-[18px] w-[34px] rounded-full transition-colors ${
          checked ? 'bg-[var(--color-brand)]' : 'bg-[#dfe8e2]'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`}
        />
      </span>
    </button>
  );
}
