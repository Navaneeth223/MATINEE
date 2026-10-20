import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { RoomClient } from '../lib/room-client';
import { WebRTCClient } from '../lib/webrtc-client';
import { fromB64u, toB64u } from '@matinee/protocol';

// Read secret from hash ONCE before React can run effects twice
function readAndStripSecret(roomId: string): Uint8Array | null {
  const stored = sessionStorage.getItem(`matinee-secret-${roomId}`);
  if (stored) return fromB64u(stored);

  const fragment = window.location.hash;
  const match = fragment.match(/k=([A-Za-z0-9_-]+)/);
  if (!match) return null;
  
  const secretB64 = match[1];
  const secret = fromB64u(secretB64);
  sessionStorage.setItem(`matinee-secret-${roomId}`, secretB64);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return secret;
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [status, setStatus] = useState<string>('Reading secret...');
  const [messages, setMessages] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSource, setIsSource] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [rtcState, setRtcState] = useState('');
  
  const clientRef = useRef<RoomClient | null>(null);
  const rtcClientRef = useRef<WebRTCClient | null>(null);
  const secretRef = useRef<Uint8Array | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const localGainRef = useRef<GainNode | null>(null);

  const handleCopyInvite = () => {
    if (!secretRef.current || !roomId) return;
    const secret = toB64u(secretRef.current);
    const inviteUrl = `${window.location.origin}/r/${roomId}#k=${secret}`;
    const btn = document.querySelector('[data-testid="copy-invite"]');
    if (btn) btn.setAttribute('data-invite-url', inviteUrl);
    navigator.clipboard?.writeText(inviteUrl).then(() => {
      console.log('Invite copied:', inviteUrl);
    }).catch(err => console.error('Copy failed:', err));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !videoRef.current) return;

    const video = videoRef.current;
    video.src = URL.createObjectURL(file);
    video.load();
    await video.play();

    setIsSource(true);

    // WebAudio branch: MediaElementSource -> local gain -> speakers + MediaStreamDestination
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaElementSource(video);
    const localGain = audioCtx.createGain();
    localGainRef.current = localGain;
    const dest = audioCtx.createMediaStreamDestination();

    source.connect(localGain);
    localGain.connect(audioCtx.destination);
    source.connect(dest);

    // Capture video + audio
    const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    // Add to peer connection
    if (rtcClientRef.current) {
      combined.getTracks().forEach(track => {
        rtcClientRef.current!.addTrack(track, combined);
      });
    }
  };

  const handleStartWatching = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.play();
      setViewerReady(true);
    }
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

    client.on('msg:chat', ({ payload }: any) => {
      const text = (payload as { text: string }).text;
      setMessages((prev) => [...prev, `Peer: ${text}`]);
    });

    // WebRTC
    const rtcClient = new WebRTCClient({
      roomClient: client,
      onTrack: (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          setIsViewer(true);
        }
      },
      onConnectionState: (state) => {
        setRtcState(state);
      },
    });
    rtcClientRef.current = rtcClient;

    setStatus('Connecting...');
    client.connect(secret).catch((err) => {
      setStatus(`Connection failed: ${err.message}`);
    });

    return () => {
      rtcClient.close();
      client.disconnect();
      audioCtxRef.current?.close();
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
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Room: {roomId}</h1>
      <p data-testid="status-text">Status: {status} {rtcState && `(WebRTC: ${rtcState})`}</p>
      
      <button onClick={handleCopyInvite} data-testid="copy-invite" data-invite-url="" style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}>
        Copy
      </button>

      {/* Stream a film panel */}
      {!isSource && !isViewer && (
        <div style={{ marginTop: '2rem', padding: '1rem', border: '2px solid #333' }}>
          <h2>Stream a film</h2>
          <input 
            type="file" 
            accept="video/*" 
            onChange={handleFileSelect}
            data-testid="file-picker"
          />
        </div>
      )}

      {/* Source video (local preview) */}
      {isSource && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Your film (local)</h3>
          <video ref={videoRef} width="640" height="360" controls style={{ border: '2px solid blue' }} />
        </div>
      )}

      {/* Viewer: remote video behind Start button */}
      {isViewer && !viewerReady && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button 
            onClick={handleStartWatching}
            data-testid="start-watching"
            style={{ 
              fontSize: '2rem', 
              padding: '2rem 4rem', 
              cursor: 'pointer',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px'
            }}
          >
            Start watching
          </button>
        </div>
      )}

      {isViewer && viewerReady && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Remote stream</h3>
          <video 
            ref={remoteVideoRef} 
            width="640" 
            height="360" 
            controls 
            muted
            data-testid="remote-video"
            style={{ border: '2px solid red' }} 
          />
        </div>
      )}

      {/* Chat */}
      <div style={{ marginTop: '2rem', border: '1px solid #ccc', padding: '1rem', height: '200px', overflowY: 'auto', backgroundColor: '#f9f9f9' }}>
        {messages.map((msg, i) => (
          <div key={i} data-testid="chat-message">{msg}</div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
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
