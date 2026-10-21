import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRoom } from '../lib/useRoom';
import { buildInviteLink } from '@matinee/protocol';
import { WebRTCClient } from '../lib/webrtc-client';
import { SourcePanel } from '../components/SourcePanel';
import { ViewerPanel } from '../components/ViewerPanel';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { state, role, messages, sendMessage, client, secret } = useRoom(roomId);
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [sourceState, setSourceState] = useState<{ paused: boolean; time: number } | null>(null);
  const [iceTimeout, setIceTimeout] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const rtcClientRef = useRef<WebRTCClient | null>(null);
  const sourceVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!client) return;

    const rtcClient = new WebRTCClient({
      roomClient: client,
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      onTrack: (stream) => {
        setRemoteStream(stream);
      },
      onConnectionState: (state) => {
        console.log('WebRTC state:', state);
      },
    });
    rtcClientRef.current = rtcClient;

    // Only check ICE timeout when actually streaming
    let timeout: NodeJS.Timeout | null = null;

    // Test stream event for E2E
    const handleTestStream = (event: any) => {
      const stream = event.detail?.stream;
      if (stream && rtcClient) {
        setIsStreaming(true);
        stream.getTracks().forEach((track: MediaStreamTrack) => {
          rtcClient.addTrack(track, stream);
        });
      }
    };
    window.addEventListener('__test_start_stream', handleTestStream);

    client.on('msg:cmd', async ({ payload }: any) => {
      const video = sourceVideoRef.current;
      if (!video || !isStreaming) return;

      const { action, value } = payload;
      if (action === 'play') await video.play();
      else if (action === 'pause') video.pause();
      else if (action === 'seek') video.currentTime = value;
      else if (action === 'skip') video.currentTime += value;

      client.send('state', {
        paused: video.paused,
        time: video.currentTime,
      });
    });

    client.on('msg:state', ({ payload }: any) => {
      setSourceState({
        paused: payload.paused !== false,
        time: payload.currentTime || 0,
      });
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('__test_start_stream', handleTestStream);
      rtcClient.close();
    };
  }, [client, isStreaming]);

  const handleCopy = () => {
    if (!secret || !roomId) return;
    const inviteUrl = buildInviteLink(window.location.origin, roomId, secret);
    navigator.clipboard?.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleStreamReady = (stream: MediaStream, video?: HTMLVideoElement) => {
    if (video) sourceVideoRef.current = video;
    setIsStreaming(true);
    
    if (rtcClientRef.current) {
      stream.getTracks().forEach(track => {
        rtcClientRef.current!.addTrack(track, stream);
      });
      
      // Start ICE timeout check ONLY when streaming starts
      const timeout = setTimeout(() => {
        if (rtcClientRef.current?.getConnectionState() !== 'connected') {
          setIceTimeout(true);
        }
      }, 15000);
      
      return () => clearTimeout(timeout);
    }

    if (video) {
      const interval = setInterval(() => {
        if (client && video) {
          client.send('state', {
            paused: video.paused,
            time: video.currentTime,
          });
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  };

  const handleViewerCommand = (action: string, value?: number) => {
    if (!client) return;
    client.send('cmd', { action, value });
  };

  const statusText = {
    reading: 'Reading invitation...',
    connecting: 'Connecting...',
    alone: 'Waiting for your partner to join',
    together: 'Connected — ready to watch',
    incomplete: 'This link is incomplete, ask your partner to send it again',
    'error:wrong-secret': 'Wrong secret — check the link',
    'error:full': 'Room is full',
    'error:closed': 'Connection closed',
  }[state];

  const partnerPresent = state === 'together';
  const youPresent = role !== null;
  
  // Sender = the one who started streaming first
  // Viewer = the one who receives remote stream
  const isViewer = !!remoteStream && !isStreaming;
  const canStartStreaming = state === 'together' && !isStreaming && !remoteStream;

  return (
    <div className="page">
      <header className="header">
        <div className="header-left">
          <h1>Matinee</h1>
          <div className="room-chip">{roomId}</div>
        </div>
        
        <div className="header-right">
          <div className="presence">
            <div className="presence-item">
              <div className={`presence-dot ${youPresent ? 'active' : 'inactive'}`} />
              <span>You</span>
            </div>
            <div className="presence-item">
              <div className={`presence-dot ${partnerPresent ? 'active' : 'inactive'}`} />
              <span>Partner</span>
            </div>
          </div>
          
          <button
            onClick={handleCopy}
            disabled={!secret}
            className="btn btn-primary"
            data-invite-url={secret && roomId ? buildInviteLink(window.location.origin, roomId, secret) : ''}
          >
            {copied ? 'Copied' : 'Copy invite'}
          </button>
        </div>
      </header>

      <div className="status-bar">
        <p className={state.startsWith('error') ? 'error' : ''} data-testid="status-text">
          {statusText}
        </p>
        {iceTimeout && (
          <p className="error">
            Your network needs a relay (not set up yet)
          </p>
        )}
      </div>

      <div className="main">
        <div className="stage">
          {canStartStreaming && (
            <SourcePanel 
              onStreamReady={handleStreamReady} 
              isSafari={/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)} 
            />
          )}
          {isViewer && (
            <ViewerPanel
              stream={remoteStream}
              onCommand={handleViewerCommand}
              sourceState={sourceState}
            />
          )}
          {!canStartStreaming && !isViewer && (
            <div className="stage-content">
              {state === 'together' && isStreaming ? 'Streaming...' : (state === 'together' ? 'Ready' : 'Waiting to connect')}
            </div>
          )}
        </div>

        <div className="chat">
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className="chat-message">
                <span className="sender">{msg.from === 'you' ? 'You' : 'Partner'}</span>
                <span className="text">: {msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          
          <div className="chat-input-area">
            <div className="chat-input-group">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="input"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="btn btn-primary"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
