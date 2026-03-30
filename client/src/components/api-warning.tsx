export function ApiWarning({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-amber-600/70 bg-amber-950/50 px-4 py-3 text-sm text-amber-100"
    >
      <span className="font-semibold text-amber-50">No live data. </span>
      {message}
    </div>
  );
}
