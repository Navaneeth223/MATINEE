import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>404 — Not Found</h1>
      <p>
        <Link to="/">Return to Foyer</Link>
      </p>
    </div>
  );
}
