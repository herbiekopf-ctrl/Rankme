export default function RankingLoading() {
  return (
    <div className="shell loading-page" aria-label="Loading ranking builder">
      <div className="skeleton skeleton-title" />
      <div className="builder-grid">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </div>
    </div>
  );
}
