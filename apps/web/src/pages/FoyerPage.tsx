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

      if (roomId) {
        navigate(`/room/${roomId}`);
      } else {
        throw new Error('No roomId returned from API');
      }
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
