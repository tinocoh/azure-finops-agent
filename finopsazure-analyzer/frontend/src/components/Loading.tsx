export default function Loading({ text = 'Cargando…' }: { text?: string }) {
  return <div className="loading">{text}</div>;
}
