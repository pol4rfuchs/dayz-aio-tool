export function StatusCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <article className="card glass"><span>{label}</span><strong>{value}</strong>{note ? <p>{note}</p> : null}</article>;
}
