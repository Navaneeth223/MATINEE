import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function FoyerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      // Use relative URL for deployment compatibility (Fix #6)
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to create room: ${response.statusText}`);
      }

      const data = await response.json();
      const { roomId } = data;

      if (!roomId) {
        throw new Error('No roomId returned from API');
      }

      // Generate 16-byte room secret client-side (Law 3)
      const roomSecret = crypto.getRandomValues(new Uint8Array(16));
      
      // Encode as base64url (RFC 4648 §5)
      const base64 = btoa(String.fromCharCode(...roomSecret));
      const base64url = base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Build invite URL with fragment (server never sees secret)
      const origin = window.location.origin;
      const inviteUrl = `${origin}/r/${roomId}#k=${base64url}`;

      // Navigate to room page with secret in state
      navigate(`/r/${roomId}`, { state: { roomSecret } });
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{t('app_name')} — Foyer</h1>
      <p>{t('tagline')}</p>
      <button
        onClick={handleCreateRoom}
        disabled={isCreating}
        style={{
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          backgroundColor: 'var(--color-accent-primary)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        {isCreating ? '...' : t('create_room')}
      </button>
    </div>
  );
}
