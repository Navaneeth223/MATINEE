import { useState, useEffect, useRef } from 'react';

interface UseMediaOptions {
  audio?: boolean;
  video?: boolean;
  autoStart?: boolean;
}

export function useMedia(options: UseMediaOptions = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const { audio = true, video = true, autoStart = false } = options;

  useEffect(() => {
    // Get available devices
    navigator.mediaDevices.enumerateDevices().then((deviceList) => {
      setDevices(deviceList.filter(d => d.kind === 'audioinput' || d.kind === 'videoinput'));
    });
  }, []);

  const startMedia = async () => {
    try {
      setError(null);
      
      const constraints: MediaStreamConstraints = {
        audio: audio ? (selectedAudioDevice ? { deviceId: selectedAudioDevice } : true) : false,
        video: video ? (selectedVideoDevice ? { deviceId: selectedVideoDevice } : { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        }) : false,
      };

      console.log('[useMedia] Requesting media with constraints:', constraints);
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[useMedia] Got media stream:', mediaStream.id, 'tracks:', mediaStream.getTracks().length);
      
      setStream(mediaStream);
      setIsActive(true);

      // Set up audio analyzer for level meter
      if (audio && mediaStream.getAudioTracks().length > 0) {
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        
        const source = audioCtx.createMediaStreamSource(mediaStream);
        source.connect(analyser);
      }
    } catch (err: any) {
      console.error('[useMedia] Error:', err);
      setError(err.message || 'Failed to access camera/microphone');
      setIsActive(false);
    }
  };

  const stopMedia = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsActive(false);
  };

  const getAudioLevel = (): number => {
    if (!analyserRef.current || !dataArrayRef.current) return 0;
    
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const average = dataArrayRef.current.reduce((a, b) => a + b, 0) / dataArrayRef.current.length;
    return average / 255; // Normalize to 0-1
  };

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
  };

  useEffect(() => {
    if (autoStart) {
      startMedia();
    }
    return () => {
      stopMedia();
    };
  }, [autoStart]);

  return {
    stream,
    error,
    isActive,
    devices,
    selectedAudioDevice,
    selectedVideoDevice,
    setSelectedAudioDevice,
    setSelectedVideoDevice,
    startMedia,
    stopMedia,
    getAudioLevel,
    toggleAudio,
    toggleVideo,
  };
}
