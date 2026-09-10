import { Injectable, inject } from '@angular/core';
import { RealtimeService } from './realtime.service';

type RuntimeEnv = { __env?: { iceServers?: RTCIceServer[] } };
type CallSignal =
  | { type: 'offer'; description: RTCSessionDescriptionInit }
  | { type: 'answer'; description: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit };

@Injectable({ providedIn: 'root' })
export class AudioCallService {
  private readonly realtime = inject(RealtimeService);
  private readonly peerConnections = new Map<string, RTCPeerConnection>();
  private readonly audioElements = new Map<string, HTMLAudioElement>();
  private localStream: MediaStream | null = null;
  private sessionId = '';
  private localUserId = '';

  async prepare(sessionId: string, localUserId: string) {
    this.sessionId = sessionId;
    this.localUserId = localUserId;
    await this.ensureLocalStream();
  }

  async connectToPeer(sessionId: string, peerUserId: string, forceOffer = false) {
    if (!peerUserId || peerUserId === this.localUserId) return;
    if (!forceOffer && this.localUserId.localeCompare(peerUserId) > 0) return;
    await this.ensureLocalStream();
    const peer = this.getPeerConnection(sessionId, peerUserId);
    if (peer.signalingState !== 'stable') return;
    const offer = await peer.createOffer({ offerToReceiveAudio: true });
    await peer.setLocalDescription(offer);
    await this.realtime.sendCallSignal(sessionId, peerUserId, { type: 'offer', description: offer } satisfies CallSignal);
  }

  async handleSignal(sessionId: string, fromUserId: string, signal: unknown) {
    if (!fromUserId || fromUserId === this.localUserId || !this.isCallSignal(signal)) return;
    await this.ensureLocalStream();
    const peer = this.getPeerConnection(sessionId, fromUserId);

    if (signal.type === 'offer') {
      await peer.setRemoteDescription(signal.description);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await this.realtime.sendCallSignal(sessionId, fromUserId, { type: 'answer', description: answer } satisfies CallSignal);
      return;
    }

    if (signal.type === 'answer') {
      if (peer.signalingState !== 'stable') await peer.setRemoteDescription(signal.description);
      return;
    }

    if (signal.candidate) await peer.addIceCandidate(signal.candidate).catch(() => undefined);
  }

  stop() {
    this.peerConnections.forEach((peer) => peer.close());
    this.peerConnections.clear();
    this.audioElements.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    this.audioElements.clear();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.sessionId = '';
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  private async ensureLocalStream() {
    if (this.localStream) return this.localStream;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone is not available on this device.');
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    return this.localStream;
  }

  private getPeerConnection(sessionId: string, peerUserId: string) {
    const existing = this.peerConnections.get(peerUserId);
    if (existing) return existing;

    const peer = new RTCPeerConnection({ iceServers: this.iceServers });
    this.localStream?.getTracks().forEach((track) => peer.addTrack(track, this.localStream as MediaStream));
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      void this.realtime.sendCallSignal(sessionId, peerUserId, { type: 'ice-candidate', candidate: event.candidate.toJSON() } satisfies CallSignal).catch(() => undefined);
    };
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) this.attachRemoteAudio(peerUserId, stream);
    };
    peer.onconnectionstatechange = () => {
      if (['closed', 'disconnected', 'failed'].includes(peer.connectionState)) this.removePeer(peerUserId);
    };
    this.peerConnections.set(peerUserId, peer);
    return peer;
  }

  private attachRemoteAudio(peerUserId: string, stream: MediaStream) {
    let audio = this.audioElements.get(peerUserId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      audio.style.display = 'none';
      document.body.appendChild(audio);
      this.audioElements.set(peerUserId, audio);
    }
    if (audio.srcObject !== stream) audio.srcObject = stream;
    void audio.play().catch(() => undefined);
  }

  private removePeer(peerUserId: string) {
    this.peerConnections.get(peerUserId)?.close();
    this.peerConnections.delete(peerUserId);
    const audio = this.audioElements.get(peerUserId);
    if (!audio) return;
    audio.pause();
    audio.srcObject = null;
    audio.remove();
    this.audioElements.delete(peerUserId);
  }

  private get iceServers(): RTCIceServer[] {
    return (globalThis as RuntimeEnv).__env?.iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ];
  }

  private isCallSignal(value: unknown): value is CallSignal {
    if (!value || typeof value !== 'object') return false;
    const signal = value as Partial<CallSignal>;
    return signal.type === 'offer' || signal.type === 'answer' || signal.type === 'ice-candidate';
  }
}
