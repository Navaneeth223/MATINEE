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

    const timeout = setTimeout(() => {
      if (rtcClient.getConnectionState() !== 'connected') {
        setIceTimeout(true);
      }
    }, 15000);

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
      clearTimeout(timeout);
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

  const handleStreamReady = (stream: MediaStream, video: HTMLVideoElement) => {
    sourceVideoRef.current = video;
    setIsStreaming(true);
    
    if (rtcClientRef.current) {
      stream.getTracks().forEach(track => {
        rtcClientRef.current!.addTrack(track, stream);
      });
    }

    // Send state updates periodically
    const interval = setInterval(() => {
      if (client && video) {
        client.send('state', {
          paused: video.paused,
          time: video.currentTime,
        });
      }
    }, 1000);

    return () => clearInterval(interval);
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
  const canStream = state === 'together' && !remoteStream;
  const isViewer = !!remoteStream;

  return (
    <div className="min-h-screen bg-[#08070B] text-[#FBF6EC] flex flex-col">
      {/* Top bar */}
      <header className="border-b border-[#15121B] px-4 py-3 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Matinee</h1>
          <div className="px-3 py-1 bg-[#15121B] rounded-[14px] text-sm font-mono text-[#B7AEC0]">
            {roomId}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${youPresent ? 'bg-green-500' : 'bg-gray-600'}`} />
              <span className="text-sm text-[#B7AEC0]">You</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${partnerPresent ? 'bg-green-500' : 'bg-gray-600'}`} />
              <span className="text-sm text-[#B7AEC0]">Partner</span>
            </div>
          </div>
          
          <button
            onClick={handleCopy}
            disabled={!secret}
            className="px-4 py-2 bg-[#E7C98E] text-[#08070B] rounded-[14px] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#E7C98E]"
          >
            {copied ? 'Copied' : 'Copy invite'}
          </button>
        </div>
      </header>

      {/* Status */}
      <div className="px-4 py-3 bg-[#15121B] border-b border-[#15121B]">
        <p className={`text-sm ${state.startsWith('error') ? 'text-[#E07A8F]' : 'text-[#B7AEC0]'}`}>
          {statusText}
        </p>
        {iceTimeout && (
          <p className="text-sm text-[#E07A8F] mt-1">
            Your network needs a relay (not set up yet)
          </p>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Stage */}
        <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {canStream && <SourcePanel onStreamReady={handleStreamReady} />}
          {isViewer && (
            <ViewerPanel
              stream={remoteStream}
              onCommand={handleViewerCommand}
              sourceState={sourceState}
            />
          )}
          {!canStream && !isViewer && (
            <div 
              className="w-full max-w-4xl mx-auto bg-[#15121B] rounded-[14px] flex items-center justify-center text-[#B7AEC0]"
              style={{ aspectRatio: '16 / 9' }}
            >
              {state === 'together' ? 'Stage ready' : 'Waiting to connect'}
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="lg:w-[340px] border-t lg:border-t-0 lg:border-l border-[#15121B] flex flex-col bg-[#15121B]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '400px' }}>
            {messages.map((msg, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-[#E7C98E]">{msg.from === 'you' ? 'You' : 'Partner'}</span>
                <span className="text-[#FBF6EC]">: {msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          
          <div className="p-4 border-t border-[#08070B]">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-[#08070B] text-[#FBF6EC] rounded-[14px] text-sm focus:outline-none focus:ring-2 focus:ring-[#E7C98E] placeholder:text-[#B7AEC0]"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="px-4 py-2 bg-[#E7C98E] text-[#08070B] rounded-[14px] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#E7C98E]"
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
