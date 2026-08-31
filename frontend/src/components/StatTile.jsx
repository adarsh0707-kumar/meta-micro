export default function StatTile({ label, value, tone = "primary" }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/20 text-ink",
    muted: "bg-muted/60 text-ink/70",
  };
  return (
    <div className="card">
      <p className="text-sm font-medium text-ink/60">{label}</p>
      <p className={`mt-2 inline-block rounded-2xl px-3 py-1 font-heading text-h3 ${tones[tone]}`}>{value}</p>
    </div>
  );
}
