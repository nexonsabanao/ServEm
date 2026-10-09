export default function Loading() {
  return (
    <main className="loading-page" aria-live="polite" aria-busy="true">
      <span>Loading services…</span>
      <div className="loading-line" />
      <div className="loading-grid" aria-hidden="true">
        <div /><div /><div /><div />
      </div>
    </main>
  );
}
