import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { newRoomSecret, toB64u } from '@matinee/protocol';

function generateRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford Base32
  let id = '';
  for (let i = 0; i < 10; i++) {
    const val = i < 8 ? bytes[Math.floor(i * 5 / 8)] ?? 0 : 0;
    const shift = (i * 5) % 8;
    const index = (val >> (8 - 5 - shift)) & 0x1F;
    id += alphabet[index];
  }
  return id;
}

export default function FoyerPage() {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    setCreating(true);

    const roomId = generateRoomId();
    const secret = newRoomSecret();
    const secretB64 = toB64u(secret);

    const url = `/r/${roomId}#k=${secretB64}`;
    navigate(url);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Matinee</h1>
      <p>Watch films together, in sync, end-to-end encrypted.</p>

      <button
        onClick={handleCreateRoom}
        disabled={creating}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.2rem',
          marginTop: '2rem',
          cursor: creating ? 'wait' : 'pointer',
        }}
      >
        {creating ? 'Creating room...' : 'Create Room'}
      </button>
    </div>
  );
}
