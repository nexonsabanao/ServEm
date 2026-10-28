import { Link } from 'react-router-dom';
import { CloudOff } from 'lucide-react';
import { SiteHeader } from '../components/SiteHeader';

/**
 * The only state this module ships: the 404. The full state gallery lives in
 * `src/dev/StateGallery.tsx`, which is mounted only in development.
 */
export function NotFoundPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width flex flex-col items-center py-24 text-center">
        <CloudOff size={28} className="text-[var(--color-brand)]" />
        <h1 className="mt-4 text-[26px] font-semibold">This page moved</h1>
        <p className="mt-2 max-w-[400px] text-[13px] text-[var(--color-muted)]">
          The page you were looking for isn’t here. Head back to your neighborhood.
        </p>
        <Link to="/app/home" className="btn btn-primary mt-6">
          Go home
        </Link>
      </main>
    </div>
  );
}