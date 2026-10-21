import { useState, useRef, useEffect } from 'react';

interface SourcePanelProps {
  onStreamReady: (stream: MediaStream, videoElement: HTMLVideoElement) => void;
}

export function SourcePanel({ onStreamReady }: SourcePanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [volume, setVolume] = useState(100);
  const [audioWarning, setAudioWarning] = useState(false);
  const [ffmpegCommand, setFfmpegCommand] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const localGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!videoRef.current || !file) return;

    const video = videoRef.current;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.load();

    const checkAudio = async () => {
      try {
        await video.play();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const videoEl = video as any;
        const decodedBytes = videoEl.webkitAudioDecodedByteCount || 0;
        const canPlay = video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
        
        if (decodedBytes === 0 || !canPlay) {
          setAudioWarning(true);
          setFfmpegCommand(`ffmpeg -i "${file.name}" -map 0:v:0 -map 0:a:0 -c:v copy -c:a aac -b:a 192k -movflags +faststart "${file.name.replace(/\.[^.]+$/, '-web.mp4')}"`);
        }
        
        video.currentTime = 0;
        video.pause();
      } catch (err) {
        console.error('Format check failed:', err);
      }
    };

    checkAudio();

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setAudioWarning(false);
    }
  };

  const handleStartStreaming = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaElementSource(video);
    const localGain = audioCtx.createGain();
    localGainRef.current = localGain;
    localGain.gain.value = volume / 100;
    const dest = audioCtx.createMediaStreamDestination();

    source.connect(localGain);
    localGain.connect(audioCtx.destination);
    source.connect(dest);

    const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    onStreamReady(combined, video);
  };

  useEffect(() => {
    if (localGainRef.current) {
      localGainRef.current.gain.value = volume / 100;
    }
  }, [volume]);

  return (
    <div className="source-panel">
      <div className="card space-y-4">
        <h2>Stream a film</h2>
        
        <input
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
        />

        {audioWarning && (
          <div className="warning-card">
            <p>No sound: this file's audio (probably Dolby/AC-3) can't play in the browser</p>
            <div className="code-block">
              {ffmpegCommand}
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(ffmpegCommand)}
              className="link-btn"
              style={{ marginTop: '0.5rem' }}
            >
              Copy command
            </button>
          </div>
        )}

        {file && (
          <div className="space-y-2">
            <video
              ref={videoRef}
              controls
              style={{ maxHeight: '300px' }}
            />
            
            <div className="slider-group">
              <div className="slider-label">
                <span>Local volume: {volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </div>

            <button
              onClick={handleStartStreaming}
              className="btn btn-primary w-full"
            >
              Start streaming
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
