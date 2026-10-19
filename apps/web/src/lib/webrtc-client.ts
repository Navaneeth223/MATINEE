import { RoomClient } from './room-client';

export interface WebRTCClientOptions {
  roomClient: RoomClient;
  onTrack: (stream: MediaStream) => void;
  onConnectionState: (state: RTCPeerConnectionState) => void;
}

export class WebRTCClient {
  private pc: RTCPeerConnection;
  private roomClient: RoomClient;
  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;

  constructor(private options: WebRTCClientOptions) {
    this.roomClient = options.roomClient;
    
    // ICE servers
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    // Track from remote
    this.pc.ontrack = (e) => {
      if (e.streams[0]) {
        options.onTrack(e.streams[0]);
      }
    };

    // Connection state
    this.pc.onconnectionstatechange = () => {
      options.onConnectionState(this.pc.connectionState);
    };

    // ICE candidate
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.roomClient.send('ice', { candidate: candidate.toJSON() });
      }
    };

    // Perfect negotiation
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

    // Listen for remote SDP/ICE
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
        if (!this.ignoreOffer) throw err;
      }
    });
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream) {
    this.pc.addTrack(track, stream);
  }

  close() {
    this.pc.close();
  }
}
