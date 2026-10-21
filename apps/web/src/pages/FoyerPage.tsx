import { useNavigate } from 'react-router-dom';
import { newRoomId } from '@matinee/protocol';

export default function FoyerPage() {
  const navigate = useNavigate();

  const handleCreate = () => {
    const roomId = newRoomId();
    const secret = crypto.getRandomValues(new Uint8Array(16));
    const secretB64 = btoa(String.fromCharCode(...secret))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    navigate(`/r/${roomId}#k=${secretB64}`);
  };

  return (
    <div className="foyer">
      <div>
        <h1>Matinee</h1>
        <p>Watch together from anywhere</p>
        <button onClick={handleCreate} className="btn btn-primary btn-lg">
          Create our room
        </button>
      </div>
    </div>
  );
}
