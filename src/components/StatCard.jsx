
export default function StatCard({ icon, label, value, note, color }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${color}`}>
        {icon}
      </div>

      <div className="stat-content">
        <p>{label}</p>
        <h2>{value}</h2>
        <span>{note}</span>
      </div>
    </article>
  );
}
