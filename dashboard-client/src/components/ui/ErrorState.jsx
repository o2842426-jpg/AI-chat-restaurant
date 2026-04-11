export default function ErrorState({ error }) {
  if (!error) return null;
  return <p style={{ color: "red" }}>خطأ: {error}</p>;
}
