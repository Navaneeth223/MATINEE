import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { RoomClient } from '../lib/room-client';
import { fromB64u } from '@matinee/protocol';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [status, setStatus] = useState<string>('Reading secret...');
  const [messages, setMessages] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const clientRef = useRef<RoomClient | null>(null);

  useEffect(() => {
    if (!roomId) {
      setStatus('Error: No room ID');
      return;
    }

    // Read secret from fragment
    const fragment = window.location.hash;
    const match = fragment.match(/k=([A-Za-z0-9_-]+)/);

    if (!match) {
      setStatus('Error: No secret in URL');
      return;
    }

    const secretB64 = match[1];
    const secret = fromB64u(secretB64);

    // Strip fragment from URL (never send to server)
    window.history.replaceState({}, '', window.location.pathname);

    // Connect
    const client = new RoomClient(roomId);
    clientRef.current = client;

    client.on('connected', ({ role }: any) => {
      setStatus(`Connected (${role})`);
    });

    client.on('error', (err: any) => {
      setStatus(`Error: ${err.message}`);
    });

    client.on('msg:chat', ({ payload }: any) => {
      const text = (payload as { text: string }).text;
      setMessages((prev) => [...prev, `Peer: ${text}`]);
    });

    client.on('presence', (data: any) => {
      setMessages((prev) => [...prev, `[${data.status}]`]);
    });

    setStatus('Connecting...');
    client.connect(secret).catch((err) => {
      setStatus(`Connection failed: ${err.message}`);
    });

    return () => {
      client.disconnect();
    };
  }, [roomId]);

  const handleSend = async () => {
    if (!clientRef.current || !inputText.trim()) return;

    try {
      await clientRef.current.send('chat', { text: inputText });
      setMessages((prev) => [...prev, `You: ${inputText}`]);
      setInputText('');
    } catch (err: any) {
      setStatus(`Send failed: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Room: {roomId}</h1>
      <p>Status: {status}</p>

      <div
        style={{
          border: '1px solid #ccc',
          padding: '1rem',
          height: '300px',
          overflowY: 'auto',
          marginBottom: '1rem',
          backgroundColor: '#f9f9f9',
        }}
      >
        {messages.map((msg, i) => (
          <div key={i}>{msg}</div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button onClick={handleSend} style={{ padding: '0.5rem 1rem' }}>
          Send
        </button>
      </div>
    </div>
  );
}
