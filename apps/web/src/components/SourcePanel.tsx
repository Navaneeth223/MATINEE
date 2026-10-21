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
    
    // WebAudio branch: source -> localGain -> speakers + destination -> peer
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

    // Capture video + audio
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
    <div className="space-y-4">
      <div className="bg-[#15121B] rounded-[14px] p-6 space-y-4">
        <h2 className="text-xl font-medium">Stream a film</h2>
        
        <input
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="block w-full text-sm text-[#B7AEC0] file:mr-4 file:py-2 file:px-4 file:rounded-[14px] file:border-0 file:text-sm file:font-medium file:bg-[#E7C98E] file:text-[#08070B] hover:file:opacity-90 file:cursor-pointer"
        />

        {audioWarning && (
          <div className="bg-[#E07A8F] bg-opacity-10 border border-[#E07A8F] rounded-[14px] p-4 space-y-2">
            <p className="text-sm text-[#E07A8F] font-medium">
              No sound: this file's audio (probably Dolby/AC-3) can't play in the browser
            </p>
            <div className="bg-[#08070B] rounded-[14px] p-3 font-mono text-xs text-[#FBF6EC] overflow-x-auto">
              {ffmpegCommand}
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(ffmpegCommand)}
              className="text-xs text-[#E7C98E] hover:underline"
            >
              Copy command
            </button>
          </div>
        )}

        {file && (
          <>
            <div className="space-y-2">
              <video
                ref={videoRef}
                controls
                className="w-full rounded-[14px] bg-black"
                style={{ maxHeight: '300px' }}
              />
              
              <div className="space-y-1">
                <label className="text-sm text-[#B7AEC0]">Local volume: {volume}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full accent-[#E7C98E]"
                />
              </div>
            </div>

            <button
              onClick={handleStartStreaming}
              className="w-full px-6 py-3 bg-[#E7C98E] text-[#08070B] rounded-[14px] font-medium hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#E7C98E]"
            >
              Start streaming
            </button>
          </>
        )}
      </div>
    </div>
  );
}
