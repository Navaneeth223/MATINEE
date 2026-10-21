import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRoom } from '../lib/useRoom';
import { buildInviteLink } from '@matinee/protocol';
import { WebRTCClient } from '../lib/webrtc-client';
import { SourcePanel } from '../components/SourcePanel';
import { ViewerPanel } from '../components/ViewerPanel';
import { FaceBubble } from '../components/FaceBubble';
import { useMedia } from '../lib/useMedia';
import { useKeyboard } from '../lib/useKeyboard';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { state, role, messages, sendMessage, client, secret } = useRoom(roomId);
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteCameraStream, setRemoteCameraStream] = useState<MediaStream | null>(null);
  const [sourceState, setSourceState] = useState<{ paused: boolean; time: number } | null>(null);
  const [iceTimeout, setIceTimeout] = useState(false);
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const rtcClientRef = useRef<WebRTCClient | null>(null);
  const sourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Camera and microphone
  const localMedia = useMedia({ audio: true, video: true, autoStart: false });

  useEffect(() => {
    if (!client) return;

    const rtcClient = new WebRTCClient({
      roomClient: client,
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      onTrack: (stream) => {
        console.log('[RoomPage] Remote stream received:', stream.id, 'tracks:', stream.getTracks().length);
        
        // If we already have a remote stream (movie), this must be camera/mic
        if (remoteStream) {
          console.log('[RoomPage] Setting as remote camera stream');
          setRemoteCameraStream(stream);
        } else {
          console.log('[RoomPage] Setting as remote movie stream');
          setRemoteStream(stream);
        }
      },
      onConnectionState: (state) => {
        console.log('[RoomPage] WebRTC state:', state);
        if (state === 'connected') {
          setIceTimeout(false);
        }
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

  const handleStreamReady = async (stream: MediaStream, video?: HTMLVideoElement) => {
    try {
      console.log('[RoomPage] Stream ready:', stream.id, 'tracks:', stream.getTracks().length, 'video:', !!video);
      if (video) sourceVideoRef.current = video;
      setIsStreaming(true);
      
      if (rtcClientRef.current) {
        // Add all tracks
        for (const track of stream.getTracks()) {
          console.log('[RoomPage] Adding track:', track.kind, track.id);
          await rtcClientRef.current.addTrack(track, stream);
        }
        
        // Manually trigger negotiation (onnegotiationneeded sometimes doesn't fire)
        console.log('[RoomPage] Triggering manual negotiation...');
        await rtcClientRef.current.createOffer();
        
        // Start ICE timeout check ONLY when streaming starts
        setTimeout(() => {
          if (rtcClientRef.current?.getConnectionState() !== 'connected') {
            console.warn('[RoomPage] ICE timeout - not connected after 15s');
            setIceTimeout(true);
          }
        }, 15000);
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
    } catch (err) {
      console.error('[RoomPage] handleStreamReady ERROR:', err);
    }
  };

  const handleViewerCommand = (action: string, value?: number) => {
    if (!client) return;
    client.send('cmd', { action, value });
  };

  const handleStartCamera = async () => {
    try {
      await localMedia.startMedia();
      
      // Add camera/mic tracks to WebRTC
      if (localMedia.stream && rtcClientRef.current) {
        console.log('[RoomPage] Adding camera/mic tracks to WebRTC');
        for (const track of localMedia.stream.getTracks()) {
          await rtcClientRef.current.addTrack(track, localMedia.stream);
        }
        
        // Trigger negotiation if this is the first time adding tracks
        if (!isStreaming) {
          console.log('[RoomPage] Triggering camera negotiation...');
          await rtcClientRef.current.createOffer();
        }
      }
      
      setShowCameraControls(true);
    } catch (err) {
      console.error('[RoomPage] Camera start error:', err);
    }
  };

  const handleStopCamera = () => {
    localMedia.stopMedia();
    setShowCameraControls(false);
  };

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    
    if (!document.fullscreenElement) {
      stageRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  const handlePlayPause = () => {
    if (isViewer) {
      // Viewer controls the source
      const action = sourceState?.paused ? 'play' : 'pause';
      handleViewerCommand(action);
    } else if (sourceVideoRef.current) {
      // Sender controls their own video
      if (sourceVideoRef.current.paused) {
        sourceVideoRef.current.play();
      } else {
        sourceVideoRef.current.pause();
      }
    }
  };

  const handleSeek = (seconds: number) => {
    if (isViewer) {
      handleViewerCommand('skip', seconds);
    } else if (sourceVideoRef.current) {
      sourceVideoRef.current.currentTime += seconds;
    }
  };

  // Keyboard shortcuts
  useKeyboard({
    onSpace: handlePlayPause,
    onLeftArrow: () => handleSeek(-10),
    onRightArrow: () => handleSeek(10),
    onF: toggleFullscreen,
    onM: localMedia.toggleAudio,
    onEscape: () => {
      if (isFullscreen) {
        toggleFullscreen();
      }
    },
  }, isStreaming || isViewer);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
        <div className="stage" ref={stageRef}>
          {/* Fullscreen button */}
          {(isStreaming || isViewer) && (
            <button
              onClick={toggleFullscreen}
              className="fullscreen-btn"
              title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? '⛶' : '⛶'}
            </button>
          )}
          
          {(canStartStreaming || isStreaming) && (
            <SourcePanel 
              onStreamReady={handleStreamReady} 
              isSafari={/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)}
              isStreaming={isStreaming}
            />
          )}
          {isViewer && (
            <ViewerPanel
              stream={remoteStream}
              onCommand={handleViewerCommand}
              sourceState={sourceState}
            />
          )}
          {!canStartStreaming && !isStreaming && !isViewer && (
            <div className="stage-content">
              {state === 'together' ? 'Ready — waiting for someone to share' : 'Waiting to connect'}
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
            {state === 'together' && !localMedia.isActive && (
              <button
                onClick={handleStartCamera}
                className="btn btn-primary w-full"
                style={{ marginBottom: '0.5rem' }}
              >
                📷 Start Camera & Mic
              </button>
            )}
            
            {localMedia.isActive && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button
                  onClick={localMedia.toggleVideo}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  🎥 {localMedia.stream?.getVideoTracks()[0]?.enabled ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={localMedia.toggleAudio}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  🎤 {localMedia.stream?.getAudioTracks()[0]?.enabled ? 'Mute' : 'Unmute'}
                </button>
                <button
                  onClick={handleStopCamera}
                  className="btn"
                  style={{ background: 'var(--rose)', color: 'white' }}
                >
                  ✕
                </button>
              </div>
            )}
            
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

      {/* Face Bubbles */}
      {localMedia.isActive && localMedia.stream && (
        <FaceBubble stream={localMedia.stream} localStream={true} />
      )}
      {remoteCameraStream && (
        <FaceBubble stream={remoteCameraStream} localStream={false} />
      )}
    </div>
  );
}
