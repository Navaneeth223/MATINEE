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

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.roomClient.send('ice', { candidate: candidate.toJSON() });
      }
    };

    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        this.roomClient.send('sdp', { description: this.pc.localDescription!.toJSON() });
      } catch (err) {
        console.error('Negotiation error:', err);
      } finally {
        this.makingOffer = false;
      }
    };

    this.roomClient.on('msg:sdp', async ({ payload }: any) => {
      const description = payload.description;
      const offerCollision =
        description.type === 'offer' &&
        (this.makingOffer || this.pc.signalingState !== 'stable');

      this.ignoreOffer = offerCollision;
      if (this.ignoreOffer) return;

      this.isSettingRemoteAnswerPending = description.type === 'answer';
      await this.pc.setRemoteDescription(description);
      this.isSettingRemoteAnswerPending = false;

      if (description.type === 'offer') {
        await this.pc.setLocalDescription();
        this.roomClient.send('sdp', { description: this.pc.localDescription!.toJSON() });
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
      
      track.contentHint = 'motion';
      
      if (this.options.remoteSafari) {
        const transceivers = this.pc.getTransceivers();
        const videoTransceiver = transceivers.find(t => t.sender === sender);
        if (videoTransceiver && 'setCodecPreferences' in videoTransceiver) {
          const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs || [];
          const h264Codecs = codecs.filter(c => c.mimeType.includes('H264'));
          const otherCodecs = codecs.filter(c => !c.mimeType.includes('H264'));
          (videoTransceiver as any).setCodecPreferences([...h264Codecs, ...otherCodecs]);
        }
      }
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
