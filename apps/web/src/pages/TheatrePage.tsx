import { useParams } from 'react-router-dom';

export default function TheatrePage() {
  const { roomId } = useParams<{ roomId: string }>();
  
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Theatre</h1>
      <p>Room: {roomId}</p>
    </div>
  );
}
