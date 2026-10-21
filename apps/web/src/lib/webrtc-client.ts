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
      if (e.streams[0]) {
        options.onTrack(e.streams[0]);
      }
    };

    this.pc.onconnectionstatechange = () => {
      options.onConnectionState(this.pc.connectionState);
    };

    this.pc.onicecandidate = async ({ candidate }) => {
      if (candidate) {
        try {
          await this.roomClient.send('ice', { candidate: candidate.toJSON() });
        } catch (err) {
          console.error('[WebRTCClient] Failed to send ICE candidate:', err);
        }
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
      if (!payload || !payload.description) {
        console.error('[WebRTCClient] Received SDP with invalid payload:', payload);
        return;
      }
      
      const description = payload.description;
      console.log('[WebRTCClient] Received SDP:', description.type);
      const offerCollision =
        description.type === 'offer' &&
        (this.makingOffer || this.pc.signalingState !== 'stable');

      this.ignoreOffer = offerCollision;
      if (this.ignoreOffer) {
        console.log('[WebRTCClient] Ignoring offer due to collision');
        return;
      }

      this.isSettingRemoteAnswerPending = description.type === 'answer';
      await this.pc.setRemoteDescription(description);
      console.log('[WebRTCClient] Remote description set, signaling:', this.pc.signalingState);
      this.isSettingRemoteAnswerPending = false;

      if (description.type === 'offer') {
        await this.pc.setLocalDescription();
        console.log('[WebRTCClient] Sending answer');
        await this.roomClient.send('sdp', { description: this.pc.localDescription!.toJSON() });
      }
    });

    this.roomClient.on('msg:ice', async ({ payload }: any) => {
      try {
        await this.pc.addIceCandidate(payload.candidate);
      } catch (err) {
        if (!this.ignoreOffer) {
          console.error('ICE candidate error:', err);
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
