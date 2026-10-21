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
    <div className="min-h-screen bg-[#08070B] text-[#FBF6EC] flex items-center justify-center p-4">
      <div className="text-center space-y-8">
        <h1 className="text-6xl font-bold tracking-tight">Matinee</h1>
        <p className="text-xl text-[#B7AEC0]">Watch together from anywhere</p>
        <button
          onClick={handleCreate}
          className="px-8 py-4 text-lg font-medium bg-[#E7C98E] text-[#08070B] rounded-[14px] hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#E7C98E] focus:ring-offset-2 focus:ring-offset-[#08070B]"
        >
          Create our room
        </button>
      </div>
    </div>
  );
}
