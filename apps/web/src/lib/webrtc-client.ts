import { RoomClient } from './room-client';

export interface WebRTCClientOptions {
  roomClient: RoomClient;
  iceServers?: RTCIceServer[];
  onTrack: (stream: MediaStream) => void;
  onConnectionState: (state: RTCPeerConnectionState) => void;
  remoteSafari?: boolean;
}

export class WebRTCClient {
  private pc: RTCPeerConnection;
  private roomClient: RoomClient;
  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;

  constructor(private options: WebRTCClientOptions) {
    this.roomClient = options.roomClient;
    
    this.pc = new RTCPeerConnection({
      iceServers: options.iceServers || [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    this.pc.ontrack = (e) => {
      console.log('[WebRTCClient] ontrack fired, streams:', e.streams.length, 'track:', e.track.kind);
      if (e.streams[0]) {
        console.log('[WebRTCClient] Calling onTrack callback with stream:', e.streams[0].id);
        options.onTrack(e.streams[0]);
      } else {
        console.warn('[WebRTCClient] ontrack event but no stream');
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTCClient] Connection state changed:', this.pc.connectionState);
      options.onConnectionState(this.pc.connectionState);
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[WebRTCClient] ICE connection state changed:', this.pc.iceConnectionState);
    };

    this.pc.onicegatheringstatechange = () => {
      console.log('[WebRTCClient] ICE gathering state changed:', this.pc.iceGatheringState);
    };

    this.pc.onsignalingstatechange = () => {
      console.log('[WebRTCClient] Signaling state changed:', this.pc.signalingState);
    };

    this.pc.onicecandidate = async ({ candidate }) => {
      if (candidate) {
        console.log('[WebRTCClient] Local ICE candidate generated:', candidate.type);
        try {
          await this.roomClient.send('ice', { candidate: candidate.toJSON() });
          console.log('[WebRTCClient] ICE candidate sent successfully');
        } catch (err) {
          console.error('[WebRTCClient] Failed to send ICE candidate:', err);
        }
      } else {
        console.log('[WebRTCClient] ICE gathering complete (null candidate)');
      }
    };

    this.pc.onnegotiationneeded = async () => {
      try {
        console.log('[WebRTCClient] Negotiation needed');
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        console.log('[WebRTCClient] Sending offer/answer:', this.pc.localDescription?.type);
        await this.roomClient.send('sdp', { description: this.pc.localDescription!.toJSON() });
      } catch (err) {
        console.error('[WebRTCClient] Negotiation error:', err);
      } finally {
        this.makingOffer = false;
      }
    };

    this.roomClient.on('msg:sdp', async ({ payload }: any) => {
      try {
        console.log('[WebRTCClient] msg:sdp event received, raw payload:', payload);
        
        if (!payload) {
          console.error('[WebRTCClient] Received SDP with undefined payload');
          return;
        }
        
        if (!payload.description) {
          console.error('[WebRTCClient] Received SDP payload without description field:', payload);
          return;
        }
        
        const description = payload.description;
        
        if (!description.type || !description.sdp) {
          console.error('[WebRTCClient] Invalid SDP description:', description);
          return;
        }
        
        console.log('[WebRTCClient] Received SDP:', description.type);
        const offerCollision =
          description.type === 'offer' &&
          (this.makingOffer || this.pc.signalingState !== 'stable');

        this.ignoreOffer = offerCollision;
        if (this.ignoreOffer) {
          console.log('[WebRTCClient] Ignoring offer due to collision, makingOffer:', this.makingOffer, 'signalingState:', this.pc.signalingState);
          return;
        }

        console.log('[WebRTCClient] Setting remote description, current signaling state:', this.pc.signalingState);
        this.isSettingRemoteAnswerPending = description.type === 'answer';
        await this.pc.setRemoteDescription(description);
        console.log('[WebRTCClient] Remote description set successfully, new signaling state:', this.pc.signalingState);
        this.isSettingRemoteAnswerPending = false;

        if (description.type === 'offer') {
          console.log('[WebRTCClient] Creating answer for received offer');
          await this.pc.setLocalDescription();
          console.log('[WebRTCClient] Answer created, sending back');
          await this.roomClient.send('sdp', { description: this.pc.localDescription!.toJSON() });
          console.log('[WebRTCClient] Answer sent successfully');
        }
      } catch (err) {
        console.error('[WebRTCClient] SDP handling error:', err);
        this.isSettingRemoteAnswerPending = false; // Reset state on error
      }
    });

    this.roomClient.on('msg:ice', async ({ payload }: any) => {
      console.log('[WebRTCClient] msg:ice event received, raw payload:', payload);
      
      if (!payload) {
        console.error('[WebRTCClient] Received ICE with undefined payload');
        return;
      }
      
      if (!payload.candidate) {
        console.error('[WebRTCClient] Received ICE payload without candidate field:', payload);
        return;
      }
      
      try {
        console.log('[WebRTCClient] Adding ICE candidate');
        await this.pc.addIceCandidate(payload.candidate);
        console.log('[WebRTCClient] ICE candidate added successfully');
      } catch (err) {
        if (!this.ignoreOffer) {
          console.error('[WebRTCClient] ICE candidate error:', err);
        }
      }
    });
  }

  async addTrack(track: MediaStreamTrack, stream: MediaStream): Promise<void> {
    console.log('[WebRTCClient] addTrack:', track.kind, track.id, 'stream:', stream.id);
    const sender = this.pc.addTrack(track, stream);
    
    if (track.kind === 'video') {
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      
      params.encodings[0].maxBitrate = 4_500_000;
      params.encodings[0].priority = 'high';
      
      if ('degradationPreference' in params.encodings[0]) {
        (params.encodings[0] as any).degradationPreference = 'maintain-resolution';
      }
      
      await sender.setParameters(params);
      console.log('[WebRTCClient] Video params set: 4.5Mbps, maintain-resolution');
      
      track.contentHint = 'motion';
      
      if (this.options.remoteSafari) {
        const transceivers = this.pc.getTransceivers();
        const videoTransceiver = transceivers.find(t => t.sender === sender);
        if (videoTransceiver && 'setCodecPreferences' in videoTransceiver) {
          const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs || [];
          const h264Codecs = codecs.filter(c => c.mimeType.includes('H264'));
          const otherCodecs = codecs.filter(c => !c.mimeType.includes('H264'));
          (videoTransceiver as any).setCodecPreferences([...h264Codecs, ...otherCodecs]);
          console.log('[WebRTCClient] H.264 codec preference set for Safari');
        }
      }
    }
  }

  async createOffer(): Promise<void> {
    console.log('[WebRTCClient] Manually creating offer...');
    try {
      this.makingOffer = true;
      await this.pc.setLocalDescription();
      console.log('[WebRTCClient] Sending offer:', this.pc.localDescription?.type);
      await this.roomClient.send('sdp', { description: this.pc.localDescription!.toJSON() });
    } catch (err) {
      console.error('[WebRTCClient] Failed to create offer:', err);
    } finally {
      this.makingOffer = false;
    }
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  close(): void {
    this.pc.close();
  }

  async getStats(): Promise<RTCStatsReport | null> {
    try {
      return await this.pc.getStats();
    } catch {
      return null;
    }
  }
}
