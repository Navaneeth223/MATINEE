import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { RoomClient } from '../lib/room-client';
import { fromB64u, toB64u } from '@matinee/protocol';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [status, setStatus] = useState<string>('Reading secret...');
  const [messages, setMessages] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [decryptErrors, setDecryptErrors] = useState(0);
  const clientRef = useRef<RoomClient | null>(null);
  const secretRef = useRef<Uint8Array | null>(null);

  const handleCopyInvite = () => {
    if (!secretRef.current || !roomId) return;
    
    // Build invite URL with secret in fragment
    const secret = toB64u(secretRef.current);
    const inviteUrl = `${window.location.origin}/r/${roomId}#k=${secret}`;
    
    // Store in data attribute for Playwright
    const btn = document.querySelector('[data-invite-url]');
    if (btn) {
      btn.setAttribute('data-invite-url', inviteUrl);
    }
    
    navigator.clipboard.writeText(inviteUrl).then(() => {
      console.log('Invite URL copied:', inviteUrl);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  };

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
    secretRef.current = secret;
    secretB64Ref.current = secretB64;
    roomIdRef.current = roomId;

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

    client.on('msg:chat', ({ payload, envelope }: any) => {
      console.log('Received msg:chat event', { payload, envelope });
      const text = (payload as { text: string }).text;
      setMessages((prev) => [...prev, `Peer: ${text}`]);
    });
    
    client.on('decrypt-error', ({ error }: any) => {
      console.error('Decryption failed:', error);
      setDecryptErrors(prev => prev + 1);
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
      {decryptErrors > 0 && (
        <p style={{ color: 'red' }}>Decrypt errors: {decryptErrors}</p>
      )}
      
      <button onClick={handleCopyInvite} data-invite-url="" style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}>
        Copy
      </button>

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
