import React, { useState, useRef, useEffect } from 'react';
import { MicIcon, ChevronRightIcon, SquareIcon } from './Icons';

interface RecordViewProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
}

const VISUALIZER_BARS = 20; // Number of bars in the visualizer

const RecordView: React.FC<RecordViewProps> = ({ onRecordingComplete, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  
  // Audio Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  
  // UI Refs
  const visualizerRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);

  // Slider Refs
  const sliderRef = useRef<HTMLDivElement>(null);
  const [sliderX, setSliderX] = useState(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    return () => {
      stopResources();
    };
  }, []);

  const stopResources = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(err => console.error("Error closing audio context:", err));
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(blob);
        stopResources();
      };

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64; 
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      mediaRecorder.start();
      setIsRecording(true);
      
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      animateVisualizer();

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const animateVisualizer = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate volume
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    const normalizedVolume = Math.min(1, average / 128);

    // Animate Pulse
    if (pulseRef.current) {
      const scale = 1 + (normalizedVolume * 0.3);
      pulseRef.current.style.transform = `scale(${scale})`;
      pulseRef.current.style.opacity = `${0.3 + (normalizedVolume * 0.4)}`;
    }

    // Animate Bars
    if (visualizerRef.current) {
      const bars = visualizerRef.current.children;
      const step = Math.floor(bufferLength / VISUALIZER_BARS);
      
      for (let i = 0; i < VISUALIZER_BARS && i < bars.length; i++) {
        const dataIndex = Math.min(i * step, bufferLength - 1);
        const value = dataArray[dataIndex];
        const height = Math.max(4, (value / 255) * 60);
        
        const bar = bars[i] as HTMLElement;
        bar.style.height = `${height}px`;
        
        // Calm Sage Colors
        if (value > 180) {
            bar.style.backgroundColor = '#52796F'; // Dark Sage
        } else if (value > 100) {
            bar.style.backgroundColor = '#84A98C'; // Medium Sage
        } else {
            bar.style.backgroundColor = '#CAD2C5'; // Light Sage
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(animateVisualizer);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- Slider Logic ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isRecording) return;
    isDraggingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const knobWidth = 48; // w-12 = 48px
    const padding = 8; 
    const maxSlide = rect.width - knobWidth - 8; 
    
    let newX = e.clientX - rect.left - (knobWidth / 2);
    
    // Clamp
    newX = Math.max(0, Math.min(newX, maxSlide));
    setSliderX(newX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !sliderRef.current) return;
    isDraggingRef.current = false;
    (e.target as Element).releasePointerCapture(e.pointerId);

    const rect = sliderRef.current.getBoundingClientRect();
    const knobWidth = 48;
    const maxSlide = rect.width - knobWidth - 8;

    if (sliderX > maxSlide * 0.9) { // 90% threshold
      setSliderX(maxSlide);
      stopRecording();
    } else {
      setSliderX(0); // Snap back
    }
  };

  return (
    <div className="flex flex-col items-center h-full p-6 animate-in fade-in duration-500 bg-[#F9FBFB]">
      
      {/* Top Section */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-[#354F52] mb-2">Live Meeting</h2>
          <p className="text-[#52796F]">{isRecording ? "Recording in progress..." : "Capture clear audio"}</p>
        </div>

        {/* Main Indicator */}
        <div className="relative group mb-12 flex items-center justify-center">
           {/* Dynamic Pulse Ring */}
           <div 
             ref={pulseRef}
             className={`absolute inset-0 rounded-full transition-transform duration-75 ease-out ${isRecording ? 'bg-[#52796F]' : 'bg-transparent'}`}
             style={{ width: '100%', height: '100%', opacity: 0.3 }}
           />
          
          <button
            onClick={!isRecording ? startRecording : undefined}
            disabled={isRecording}
            className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
              isRecording 
                ? 'bg-[#F9FBFB] border-4 border-[#EFF2F1]' 
                : 'bg-gradient-to-br from-[#52796F] to-[#354F52] hover:from-[#84A98C] hover:to-[#52796F] active:scale-95 cursor-pointer'
            }`}
          >
            {isRecording ? (
               <div className="flex flex-col items-center justify-center">
                 <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mb-1" />
                 <span className="text-xs font-bold text-[#354F52] tracking-wider">REC</span>
               </div>
            ) : (
               <MicIcon className="w-12 h-12 text-[#F9FBFB]" />
            )}
          </button>
        </div>

        {/* Timer */}
        <div className="text-5xl font-mono font-medium text-[#354F52] mb-8 tabular-nums tracking-tight">
          {formatTime(duration)}
        </div>

        {/* Audio Visualizer Bars */}
        <div 
          ref={visualizerRef}
          className="h-12 flex items-end justify-center gap-1 mb-8 w-full"
        >
          {isRecording ? (
            Array.from({ length: VISUALIZER_BARS }).map((_, i) => (
              <div 
                key={i}
                className="w-1.5 bg-[#CAD2C5] rounded-t-sm transition-[height] duration-75 ease-linear"
                style={{ height: '4px' }}
              />
            ))
          ) : (
            <div className="text-[#84A98C] text-sm font-medium">Ready to record</div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-sm pb-8">
        {isRecording ? (
          /* Slide to Stop */
          <div 
            ref={sliderRef}
            className="relative h-16 bg-[#EFF2F1] rounded-full p-1 overflow-hidden select-none touch-none shadow-inner border border-[#CAD2C5]"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
             {/* Background Text */}
             <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[#84A98C] font-medium text-sm tracking-wide flex items-center gap-1 opacity-80">
                   Slide to stop <ChevronRightIcon className="w-4 h-4" />
                </span>
             </div>

             {/* Fill Track */}
             <div 
               className="absolute top-0 left-0 bottom-0 bg-red-50 opacity-0 transition-opacity"
               style={{ width: `${sliderX + 48}px`, opacity: sliderX > 10 ? 1 : 0 }}
             />

             {/* Knob */}
             <div 
               className="absolute top-2 bottom-2 w-12 bg-[#F9FBFB] rounded-full shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing z-10 transition-transform duration-75 border border-[#CAD2C5]"
               style={{ transform: `translateX(${sliderX}px)` }}
             >
                <SquareIcon className="w-5 h-5 text-red-500 fill-current" />
             </div>
          </div>
        ) : (
          /* Cancel Button (Only when not recording) */
          <button 
            onClick={onCancel}
            className="w-full py-4 rounded-xl bg-[#EFF2F1] text-[#52796F] hover:bg-[#CAD2C5] hover:text-[#354F52] transition-colors font-medium border border-transparent hover:border-[#CAD2C5]"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default RecordView;