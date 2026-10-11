import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RoomClient from '../lib/room-client';
import { useRoomStore } from '../stores/roomStore';
import { useUserPrefsStore } from '../stores/userPrefsStore';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'ready';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { t } = useTranslation();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>('disconnected');
  const [inviteUrl, setInviteUrl] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const roomClientRef = useRef<RoomClient | null>(null);
  const peers = useRoomStore((state) => state.peers);
  const displayName = useUserPrefsStore((state) => state.displayName);

  useEffect(() => {
    if (!roomId) return;

    const peerId = crypto.randomUUID();
    const name = displayName || 'Watcher';

    // Generate invite URL
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/room/${roomId}`;
    setInviteUrl(url);

    // Create RoomClient instance
    const client = new RoomClient(roomId, peerId, name);
    roomClientRef.current = client;

    // Set up event listeners
    const unsubscribeConnected = client.on('connected', () => {
      console.log('RoomPage: connected');
      setConnectionStatus('connected');
    });

    const unsubscribePeerJoined = client.on('peer-joined', (peer) => {
      console.log('RoomPage: peer-joined', peer);
    });

    const unsubscribePeerLeft = client.on('peer-left', (peerId) => {
      console.log('RoomPage: peer-left', peerId);
    });

    const unsubscribeReady = client.on('ready', () => {
      console.log('RoomPage: ready (E2EE established)');
      setConnectionStatus('ready');
    });

    const unsubscribeDisconnected = client.on('disconnected', () => {
      console.log('RoomPage: disconnected');
      setConnectionStatus('disconnected');
    });

    // Connect to room
    setConnectionStatus('connecting');
    client.connect().catch((error) => {
      console.error('RoomPage: connection error', error);
      setConnectionStatus('disconnected');
    });

    // Cleanup on unmount
    return () => {
      unsubscribeConnected();
      unsubscribePeerJoined();
      unsubscribePeerLeft();
      unsubscribeReady();
      unsubscribeDisconnected();
      client.disconnect();
    };
  }, [roomId, displayName]);

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (error) {
      console.error('Failed to copy invite URL:', error);
    }
  };

  const getStatusColor = (status: ConnectionState): string => {
    switch (status) {
      case 'disconnected':
        return '#ef4444'; // red
      case 'connecting':
        return '#f59e0b'; // yellow
      case 'connected':
        return '#3b82f6'; // blue
      case 'ready':
        return '#10b981'; // green
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusText = (status: ConnectionState): string => {
    switch (status) {
      case 'disconnected':
        return t('status_disconnected');
      case 'connecting':
        return t('status_connecting');
      case 'connected':
        return t('status_connected');
      case 'ready':
        return t('status_ready');
      default:
        return status;
    }
  };

  if (!roomId) {
    return <div style={{ padding: '2rem' }}>Invalid room ID</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>{t('app_name')} — Room</h1>

      {/* Room ID */}
      <div style={{ marginTop: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          {t('room_id')}
        </label>
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--color-surface-elevated)',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '1.1rem',
          }}
        >
          {roomId}
        </div>
      </div>

      {/* Invite URL */}
      <div style={{ marginTop: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          {t('invite_url')}
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={inviteUrl}
            readOnly
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
            }}
          />
          <button
            onClick={handleCopyInvite}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: copyFeedback
                ? '#10b981'
                : 'var(--color-accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            {copyFeedback ? '✓' : t('copy_invite')}
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div style={{ marginTop: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          {t('connection_status')}
        </label>
        <div
          style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            backgroundColor: getStatusColor(connectionStatus) + '20',
            color: getStatusColor(connectionStatus),
            border: `2px solid ${getStatusColor(connectionStatus)}`,
            borderRadius: '4px',
            fontWeight: 'bold',
          }}
        >
          {getStatusText(connectionStatus)}
        </div>
      </div>

      {/* Peers List */}
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>
          {t('peers_in_room')} ({peers.length})
        </h2>
        {peers.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Waiting for peers to join...
          </p>
        ) : (
          <ul style={{ listStyle: 'none' }}>
            {peers.map((peer) => (
              <li
                key={peer.id}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  backgroundColor: 'var(--color-surface-elevated)',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 'bold' }}>{peer.displayName}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  {new Date(peer.joinedAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
