/**
 * Icons drawn as geometry rather than typographic glyphs.
 *
 * A text glyph cannot be centred by CSS in a fixed box: `place-items: center`
 * centres the line box, but the ink of a character sits around the font's math
 * axis, which is not the line box's centre. The × ink landed 2.4px below the
 * centre of a 34px button and 6.9px below a 42px one, and changing line-height
 * does not help because the offset between the ink and the line box centre is
 * independent of line-height. These paths are symmetric about the middle of
 * their viewBox, so centring the viewBox centres the mark.
 */

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M4 4l8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="6.9" cy="6.9" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.4 10.4 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** A work docket: the shape of a request in this product. */
export function DocketIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M3.6 1.6h8.8v12.8l-2.2-1.6-2.2 1.6-2.2-1.6-2.2 1.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6 5h4M6 7.6h4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M3 5h10M3 8h10M3 11h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A heart for the feed's like control. */
export function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M10 17.2s-6.7-4.1-6.7-8.6a3.9 3.9 0 0 1 6.7-2.7 3.9 3.9 0 0 1 6.7 2.7c0 4.5-6.7 8.6-6.7 8.6Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CommentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M3.5 5.2A1.7 1.7 0 0 1 5.2 3.5h9.6a1.7 1.7 0 0 1 1.7 1.7v6.2a1.7 1.7 0 0 1-1.7 1.7H8l-3.4 2.6a.6.6 0 0 1-1-.46v-2.14H5.2a1.7 1.7 0 0 1-1.7-1.7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M10 3.2v9.6M10 3.2 6.6 6.6M10 3.2l3.4 3.4M4.5 11.6v3.2a1.6 1.6 0 0 0 1.6 1.6h7.8a1.6 1.6 0 0 0 1.6-1.6v-3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M3.4 9.3 10 3.6l6.6 5.7v6.3a1.2 1.2 0 0 1-1.2 1.2H4.6a1.2 1.2 0 0 1-1.2-1.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7.8 16.8v-4.4h4.4v4.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function CompassIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.6 7.4-1.5 3.7-3.7 1.5 1.5-3.7Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}


export function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M5.5 3.8h9v12.4l-4.5-3-4.5 3Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M3.5 6.4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v4.4a2 2 0 0 1-2 2H9l-3.3 2.4a.6.6 0 0 1-1-.46v-1.94H5.5a2 2 0 0 1-2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 3.2a1.3 1.3 0 0 1 1.3 1.3v.5a5.6 5.6 0 0 1 1.3.76l.43-.25a1.3 1.3 0 0 1 1.76.48 1.3 1.3 0 0 1-.3 1.76l-.43.25c.1.42.1.86 0 1.28l.43.25a1.3 1.3 0 0 1 .3 1.76 1.3 1.3 0 0 1-1.76.48l-.43-.25a5.6 5.6 0 0 1-1.3.76v.5A1.3 1.3 0 0 1 10 16.8a1.3 1.3 0 0 1-1.3-1.3v-.5a5.6 5.6 0 0 1-1.3-.76l-.43.25a1.3 1.3 0 0 1-1.76-.48 1.3 1.3 0 0 1 .3-1.76l.43-.25a5.6 5.6 0 0 1 0-1.28l-.43-.25a1.3 1.3 0 0 1-.3-1.76 1.3 1.3 0 0 1 1.76-.48l.43.25a5.6 5.6 0 0 1 1.3-.76v-.5A1.3 1.3 0 0 1 10 3.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 4.6v10.8M4.6 10h10.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M6.2 8.4a3.8 3.8 0 0 1 7.6 0c0 3 1.2 4.2 1.2 4.2H5s1.2-1.2 1.2-4.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.4 15a1.7 1.7 0 0 0 3.2 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M4.6 6.6h10.8l.8 8.8a1.2 1.2 0 0 1-1.2 1.3H5a1.2 1.2 0 0 1-1.2-1.3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7.6 8.4V5.6a2.4 2.4 0 0 1 4.8 0v2.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function StarIcon({ filled = true }: { filled?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="m10 3.4 2.1 4.3 4.7.7-3.4 3.3.8 4.7L10 14.2l-4.2 2.2.8-4.7L3.2 8.4l4.7-.7Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VerifiedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="m10 2.2 2.1 1.5 2.6-.3 1 2.4 2.2 1.4-.7 2.5.7 2.5-2.2 1.4-1 2.4-2.6-.3L10 17.8l-2.1-1.5-2.6.3-1-2.4L2.1 12.8l.7-2.5-.7-2.5 2.2-1.4 1-2.4 2.6.3Z"
        fill="currentColor"
      />
      <path d="m7.2 10 2 2 3.6-3.8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="4.6" cy="10" r="1.4" fill="currentColor" />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" />
      <circle cx="15.4" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function FlashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M11.4 2.6 5 11.2h3.6l-.8 6.2 6.4-8.8h-3.6Z" fill="currentColor" />
    </svg>
  );
}

export function LocationIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M10 17.4s5.4-4.3 5.4-8.6A5.4 5.4 0 0 0 4.6 8.8c0 4.3 5.4 8.6 5.4 8.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="8.6" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}


export function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="m4 6.5 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="m6.5 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A paper plane — the send/message glyph used in the top bar. */
export function SendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M22 2 11 13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2 15 22 11 13 2 9z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="7" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.8 17c.6-3.2 3.2-5 6.2-5s5.6 1.8 6.2 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

