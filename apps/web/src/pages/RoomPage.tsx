import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { RoomClient } from '../lib/room-client';
import { fromB64u, toB64u } from '@matinee/protocol';

// Read secret from hash ONCE before React can run effects twice
function readAndStripSecret(roomId: string): Uint8Array | null {
  // Check sessionStorage first (survives refresh, scoped to tab)
  const stored = sessionStorage.getItem(`matinee-secret-${roomId}`);
  if (stored) {
    return fromB64u(stored);
  }

  // Read from hash
  const fragment = window.location.hash;
  const match = fragment.match(/k=([A-Za-z0-9_-]+)/);
  
  if (!match) return null;
  
  const secretB64 = match[1];
  const secret = fromB64u(secretB64);
  
  // Store in sessionStorage
  sessionStorage.setItem(`matinee-secret-${roomId}`, secretB64);
  
  // Strip hash immediately
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  
  return secret;
}

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
    
    const secret = toB64u(secretRef.current);
    const inviteUrl = `${window.location.origin}/r/${roomId}#k=${secret}`;
    
    // Store in data attribute for Playwright
    const btn = document.querySelector('[data-testid="copy-invite"]');
    if (btn) {
      btn.setAttribute('data-invite-url', inviteUrl);
    }
    
    navigator.clipboard?.writeText(inviteUrl).then(() => {
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

    const secret = readAndStripSecret(roomId);
    
    if (!secret) {
      setStatus('Error: No secret in URL');
      return;
    }

    secretRef.current = secret;

    // Connect
    const client = new RoomClient(roomId);
    clientRef.current = client;

    client.on('connected', ({ role }: any) => {
      setStatus(`Connected (${role})`);
      const statusEl = document.querySelector('[data-testid="status-text"]');
      if (statusEl) {
        if (role === 'creator') statusEl.setAttribute('data-testid-role', 'status-connected');
        if (role === 'joiner') statusEl.setAttribute('data-testid-role', 'status-connected');
      }
    });

    client.on('error', (err: any) => {
      setStatus(`Error: ${err.message}`);
      const statusEl = document.querySelector('[data-testid="status-text"]');
      if (statusEl && err.message.includes('full')) {
        statusEl.setAttribute('data-testid-role', 'status-full');
      } else if (statusEl && (err.message.includes('denied') || err.message.includes('Wrong secret'))) {
        statusEl.setAttribute('data-testid-role', 'status-denied');
      }
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
      <p data-testid="status-text">Status: {status}</p>
      {decryptErrors > 0 && (
        <p style={{ color: 'red' }}>Decrypt errors: {decryptErrors}</p>
      )}
      
      <button onClick={handleCopyInvite} data-testid="copy-invite" data-invite-url="" style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}>
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
          <div key={i} data-testid="chat-message">{msg}</div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          data-testid="chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button onClick={handleSend} data-testid="chat-send" style={{ padding: '0.5rem 1rem' }}>
          Send
        </button>
      </div>
    </div>
  );
}
