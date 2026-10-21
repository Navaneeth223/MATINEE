import { useState, useEffect, useRef } from 'react';
import { RoomClient } from './room-client';
import { parseInviteFragment } from '@matinee/protocol';

export type RoomState = 
  | 'reading'
  | 'connecting'
  | 'alone'
  | 'together'
  | 'incomplete'
  | 'error:wrong-secret'
  | 'error:full'
  | 'error:closed';

function readAndStripSecret(roomId: string): Uint8Array | null {
  const stored = sessionStorage.getItem(`matinee-secret-${roomId}`);
  if (stored) {
    const bytes = parseInviteFragment(`#k=${stored}`);
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return bytes;
  }

  const fragment = window.location.hash;
  if (!fragment) return null;

  const secret = parseInviteFragment(fragment);
  if (!secret) return null;

  const secretB64 = fragment.match(/k=([A-Za-z0-9_-]+)/)?.[1];
  if (secretB64) {
    sessionStorage.setItem(`matinee-secret-${roomId}`, secretB64);
  }

  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return secret;
}

function getPeerId(roomId: string): string {
  const key = `matinee-peerid-${roomId}`;
  const stored = sessionStorage.getItem(key);
  if (stored) return stored;

  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const peerId = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem(key, peerId);
  return peerId;
}

export function useRoom(roomId: string | undefined) {
  const [state, setState] = useState<RoomState>('reading');
  const [role, setRole] = useState<'creator' | 'joiner' | null>(null);
  const [messages, setMessages] = useState<Array<{ from: 'you' | 'partner'; text: string }>>([]);
  const clientRef = useRef<RoomClient | null>(null);
  const secretRef = useRef<Uint8Array | null>(null);
  const peerIdRef = useRef<string | null>(null);

  const [secret] = useState(() => {
    if (!roomId) return null;
    const s = readAndStripSecret(roomId);
    if (!s) {
      setState('incomplete');
      return null;
    }
    return s;
  });

  useEffect(() => {
    if (!roomId || !secret) return;

    let cancelled = false;
    secretRef.current = secret;
    peerIdRef.current = getPeerId(roomId);
    setState('connecting');

    const client = new RoomClient(roomId);
    clientRef.current = client;

    const handleConnected = ({ role }: { role: 'creator' | 'joiner' }) => {
      if (cancelled) return;
      setRole(role);
      setState('alone');
    };

    const handlePartnerArrived = () => {
      if (cancelled) return;
      setState('together');
    };

    const handlePartnerLeft = () => {
      if (cancelled) return;
      setState('alone');
    };

    const handleError = (err: { message: string }) => {
      if (cancelled) return;
      if (err.message.includes('Wrong secret')) {
        setState('error:wrong-secret');
      } else if (err.message.includes('full')) {
        setState('error:full');
      } else {
        setState('error:closed');
      }
    };

    const handleChat = ({ payload }: { payload: { text: string } }) => {
      if (cancelled) return;
      setMessages(prev => [...prev, { from: 'partner', text: payload.text }]);
    };

    client.on('connected', handleConnected);
    client.on('partner-arrived', handlePartnerArrived);
    client.on('partner-left', handlePartnerLeft);
    client.on('error', handleError);
    client.on('msg:chat', handleChat);

    client.connect(secret).catch(err => {
      if (cancelled) return;
      console.error('Connection failed:', err);
      setState('error:closed');
    });

    return () => {
      cancelled = true;
      client.disconnect();
      clientRef.current = null;
    };
  }, [roomId, secret]);

  const sendMessage = async (text: string) => {
    if (!clientRef.current || !text.trim()) return;
    try {
      await clientRef.current.send('chat', { text });
      setMessages(prev => [...prev, { from: 'you', text }]);
    } catch (err) {
      console.error('Send failed:', err);
    }
  };

  return {
    state,
    role,
    messages,
    sendMessage,
    client: clientRef.current,
    secret: secretRef.current,
    peerId: peerIdRef.current,
  };
}
