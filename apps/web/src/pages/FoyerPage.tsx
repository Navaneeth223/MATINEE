import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { newRoomSecret, toB64u, newRoomId } from '@matinee/protocol';

export default function FoyerPage() {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    setCreating(true);

    const roomId = newRoomId();
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
