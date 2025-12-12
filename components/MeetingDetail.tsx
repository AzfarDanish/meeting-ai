import React, { useState, useRef, useEffect, useMemo } from 'react';

// Icons
const ChevronLeftIcon = ({ className = "" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const FileAudioIcon = ({ className = "" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
  </svg>
);

const PlayIcon = ({ className = "" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ className = "" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
  </svg>
);

const BrainCircuitIcon = ({ className = "" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const AlertCircleIcon = ({ className = "" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

interface MeetingData {
  id: string;
  title: string;
  date: string;
  durationString: string;
  audioUrl?: string;
  htmlContent?: string;
  transcript: string;
  noteData: {
    durationMinutes: number;
    keyTerms?: string[];
  };
}

interface MeetingDetailProps {
  meeting: MeetingData;
  onBack: () => void;
  onUpdateTitle: (newTitle: string) => void;
}

const MeetingDetail: React.FC<MeetingDetailProps> = ({ meeting, onBack, onUpdateTitle }) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'transcript'>('notes');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timestampWarning, setTimestampWarning] = useState<string | null>(null);
  
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(meeting.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Reset state when meeting changes to prevent stale duration/timestamps
  useEffect(() => {
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setTimestampWarning(null);
    setActiveTab('notes');
    setTempTitle(meeting.title);
  }, [meeting.id, meeting.title]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingTitle]);

  const saveTitle = () => {
    if (tempTitle.trim() && tempTitle !== meeting.title) {
      onUpdateTitle(tempTitle.trim());
    } else {
      setTempTitle(meeting.title);
    }
    setIsEditingTitle(false);
  };

  const cancelEdit = () => {
    setTempTitle(meeting.title);
    setIsEditingTitle(false);
  };

  // Calculate effective duration: Prioritize actual media duration.
  const effectiveDuration = useMemo(() => {
    if (duration && Number.isFinite(duration) && duration > 0) {
      return duration;
    }
    // Fallback if metadata hasn't loaded (from note data or parsing durationString if available)
    return (meeting.noteData.durationMinutes * 60) || 0; 
  }, [duration, meeting.noteData.durationMinutes]);

  // Generate Highlighted Transcript (Memoized)
  const highlightedTranscript = useMemo(() => {
    const text = meeting.transcript;
    const terms = meeting.noteData.keyTerms;
    
    if (!terms || terms.length === 0 || !text) return text;

    // Same highlighting logic as geminiService for consistency
    const sortedTerms = [...terms].sort((a, b) => b.length - a.length);
    const escapedTerms = sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');
    
    // We use a specific class for the transcript highlights
    return text.replace(pattern, '<span class="term-highlight">$1</span>');
  }, [meeting.transcript, meeting.noteData.keyTerms]);


  // Toggle play/pause
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Improved seek function that strictly clamps to audio duration
  const seekTo = (time: number) => {
    if (audioRef.current) {
      // Ensure we don't seek beyond the actual audio duration
      const maxTime = effectiveDuration;
      const safeTime = Math.max(0, Math.min(time, maxTime));
      
      audioRef.current.currentTime = safeTime;
      setCurrentTime(safeTime); 
      
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Handle time update from audio element
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
    }
  };

  // Handle audio ended event
  const handleAudioEnded = () => {
    setIsPlaying(false);
    // Ensure slider shows full completion
    if (effectiveDuration > 0) {
       setCurrentTime(effectiveDuration); 
    }
  };

  // Handle metadata loaded (duration)
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (Number.isFinite(d)) {
        setDuration(d);
      }
    }
  };

  // Handle clicks on timestamps and buttons in the generated HTML
  useEffect(() => {
    const handleHtmlClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // 1. Timestamp Logic with validation and "Pre-roll" fix
      const timestampEl = target.closest('.timestamp-tag');
      if (timestampEl) {
        const timeStr = timestampEl.getAttribute('data-time');
        if (timeStr) {
          const rawTime = parseFloat(timeStr);
          const adjustedTime = Math.max(0, rawTime - 2);

          // Validate timestamp against actual audio duration
          if (effectiveDuration > 0 && adjustedTime > effectiveDuration) {
            setTimestampWarning(`This timestamp (${formatTime(rawTime)}) exceeds the audio duration. Playing from end.`);
            setTimeout(() => setTimestampWarning(null), 5000);
            seekTo(effectiveDuration - 5); 
          } else {
            setTimestampWarning(null);
            seekTo(adjustedTime); // Seek to the buffered time
          }
          
          // Visual Highlight Logic
          const contentBlock = target.closest('.note-content-line, .note-callout, .note-code-block') as HTMLElement & { _highlightTimer?: number };
          
          if (contentBlock) {
            if (contentBlock._highlightTimer) {
              window.clearTimeout(contentBlock._highlightTimer);
              contentBlock._highlightTimer = undefined;
            }
            const existingHighlights = contentRef.current?.querySelectorAll('.highlight-active');
            existingHighlights?.forEach(el => el.classList.remove('highlight-active'));
            contentBlock.classList.add('highlight-active');
            contentBlock._highlightTimer = window.setTimeout(() => {
              contentBlock.classList.remove('highlight-active');
              contentBlock._highlightTimer = undefined;
            }, 3000);
          }
        }
      }

      // 2. Copy Summary Logic
      const copyBtn = target.closest('.copy-summary-btn');
      if (copyBtn) {
        const sectionBlock = copyBtn.closest('.section-block');
        const summaryText = sectionBlock?.querySelector('.overview-text')?.textContent;
        
        if (summaryText) {
          navigator.clipboard.writeText(summaryText).then(() => {
            const originalHtml = copyBtn.innerHTML;
            const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #059669;"><polyline points="20 6 9 17 4 12"/></svg>`;
            copyBtn.innerHTML = checkIcon;
            setTimeout(() => {
              copyBtn.innerHTML = originalHtml;
            }, 2000);
          }).catch(err => console.error('Copy failed', err));
        }
      }
    };

    const container = contentRef.current;
    if (container) {
      container.addEventListener('click', handleHtmlClick);
    }

    return () => {
      if (container) {
        container.removeEventListener('click', handleHtmlClick);
      }
    };
  }, [effectiveDuration]); 

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

  return (
    <div className="flex flex-col h-full bg-[#EFF2F1] animate-in slide-in-from-right duration-300">
      
      {/* --- Styles for PDF-like Rendering & Highlights --- */}
      <style>{`
        .meeting-notes-container { font-family: 'Inter', sans-serif; color: #354F52; padding-bottom: 4rem; }
        .section-block { margin-bottom: 2.5rem; }
        .section-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
        .section-icon { font-size: 1.5rem; }
        .section-header h2 { font-size: 1.5rem; font-weight: 700; color: #2F3E46; margin: 0; letter-spacing: -0.01em; }
        .subsection-block { margin-bottom: 1.5rem; padding-left: 0.5rem; }
        .subsection-block h3 { font-size: 1.15rem; font-weight: 600; color: #52796F; margin-bottom: 0.75rem; margin-top: 1.5rem; }
        .overview-text { line-height: 1.7; color: #354F52; font-size: 1rem; }
        .note-list { list-style: none; padding-left: 0.5rem; margin-top: 0.5rem; }
        .note-item { position: relative; padding-left: 1.25rem; margin-bottom: 0.6rem; }
        .note-item::before { content: "•"; position: absolute; left: 0; color: #52796F; font-weight: bold; font-size: 1.2em; line-height: 1.5; }
        .note-content-line { display: inline-block; transition: background 0.3s; border-radius: 4px; }
        .note-text { line-height: 1.6; }
        strong { color: #2F3E46; font-weight: 700; }
        .note-callout { display: flex; background-color: #F8FAFC; border-left: 4px solid #6366F1; padding: 1rem; margin: 1rem 0; border-radius: 0 0.5rem 0.5rem 0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s; }
        .callout-content { flex: 1; color: #334155; }
        .note-table-container { margin: 1.5rem 0; overflow-x: auto; border-radius: 0.5rem; border: 1px solid #E2E8F0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .table-caption { background: #F1F5F9; padding: 0.5rem 1rem; font-size: 0.9rem; font-weight: 600; color: #475569; border-bottom: 1px solid #E2E8F0; }
        .note-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
        .note-table th { background-color: #E0E7FF; color: #312E81; font-weight: 600; text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid #CBD5E1; }
        .note-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #F1F5F9; color: #334155; }
        .note-table tr:last-child td { border-bottom: none; }
        .note-table tr:nth-child(even) { background-color: #FAFAFA; }
        .note-code-block { background-color: #0F172A; color: #E2E8F0; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; font-family: 'Menlo', 'Monaco', 'Courier New', monospace; font-size: 0.85rem; overflow-x: auto; position: relative; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .code-footer { margin-top: 0.5rem; text-align: right; opacity: 0.5; font-size: 0.75rem; }
        .highlight-active { background-color: rgba(99, 102, 241, 0.15); }
        .timestamp-tag { display: inline-flex; align-items: center; justify-content: center; font-family: 'Menlo', monospace; font-size: 0.7rem; color: #64748B; background: #F1F5F9; border: 1px solid #CBD5E1; padding: 2px 6px; border-radius: 4px; cursor: pointer; margin-left: 0.5rem; vertical-align: middle; transition: all 0.2s; }
        .timestamp-tag:hover { background: #6366F1; color: white; border-color: #6366F1; }
        .action-items-section { border-top: 2px dashed #CBD5E1; padding-top: 2rem; margin-top: 3rem; }
        .action-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
        .action-card { background: white; padding: 1rem; border-radius: 0.75rem; border: 1px solid #E2E8F0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .action-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
        .action-priority { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 12px; }
        .action-task { font-weight: 600; color: #334155; margin-bottom: 0.5rem; }
        .action-assignee { font-size: 0.8rem; color: #64748B; background: #F1F5F9; padding: 2px 8px; border-radius: 4px; }
        /* NEW Highlight Style */
        .term-highlight { background-color: #D1E7DD; color: #14532D; padding: 1px 3px; border-radius: 3px; border-bottom: 1px solid #A7F3D0; font-weight: 500; }
      `}</style>

      {/* Header */}
      <div className="border-b border-[#CAD2C5] p-4 sticky top-0 bg-[#F9FBFB]/95 backdrop-blur-sm z-10 shadow-sm">
        <div className="flex items-center gap-4 mb-3">
          <button onClick={onBack} className="p-2 hover:bg-[#EFF2F1] rounded-full text-[#52796F] transition-colors">
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <div className="flex-1 overflow-hidden min-w-0">
            {isEditingTitle ? (
              <input
                ref={inputRef}
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') cancelEdit();
                }}
                className="w-full text-xl font-bold text-[#354F52] leading-tight bg-[#F9FBFB] border-b-2 border-[#52796F] focus:outline-none px-1"
              />
            ) : (
              <h1 
                onClick={() => setIsEditingTitle(true)}
                className="text-xl font-bold text-[#354F52] leading-tight truncate cursor-text hover:bg-[#EFF2F1] rounded px-1 -ml-1 transition-colors border border-transparent hover:border-[#CAD2C5]"
                title="Click to rename"
              >
                {meeting.title}
              </h1>
            )}
            {/* HERE: Display effectiveDuration in header to match slider, as per requirement */}
            <p className="text-xs text-[#52796F] mt-1">{meeting.date} • {formatTime(effectiveDuration)}</p>
          </div>
        </div>

        {/* Audio Player */}
        {meeting.audioUrl && (
          <div className="bg-[#EFF2F1] rounded-xl p-3 border border-[#CAD2C5] flex flex-col gap-2 transition-all">
            {/* Warning Message UI */}
            {timestampWarning && (
                <div className="bg-amber-50 text-amber-700 text-[10px] px-2 py-1.5 rounded border border-amber-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 shadow-sm">
                   <AlertCircleIcon className="w-3 h-3 flex-shrink-0" />
                   <span className="font-medium">{timestampWarning}</span>
                </div>
            )}
            
            <audio 
              ref={audioRef} 
              src={meeting.audioUrl} 
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleAudioEnded}
            />
            <div className="flex items-center gap-3">
              <button 
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-[#52796F] hover:bg-[#354F52] text-[#F9FBFB] flex items-center justify-center transition-colors shadow-sm active:scale-95 flex-shrink-0"
              >
                {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-0.5" />}
              </button>
              
              <div className="flex-1 flex flex-col justify-center group">
                <input 
                  type="range" 
                  min="0" 
                  max={effectiveDuration} 
                  value={currentTime} 
                  onChange={(e) => {
                    const time = Number(e.target.value);
                    if (audioRef.current) audioRef.current.currentTime = time;
                    setCurrentTime(time);
                  }}
                  className="w-full h-1 bg-[#CAD2C5] rounded-lg appearance-none cursor-pointer accent-[#52796F] hover:accent-[#354F52] transition-all group-hover:h-2"
                />
                <div className="flex justify-between text-[10px] text-[#84A98C] font-medium mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(effectiveDuration)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#CAD2C5] bg-[#F9FBFB]">
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-all relative
            ${activeTab === 'notes' ? 'text-[#52796F]' : 'text-[#84A98C] hover:bg-[#EFF2F1]'}`}
        >
          <BrainCircuitIcon className="w-4 h-4" /> AI Notes
          {activeTab === 'notes' && <div className="absolute bottom-0 w-full h-0.5 bg-[#52796F] rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-all relative
            ${activeTab === 'transcript' ? 'text-[#52796F]' : 'text-[#84A98C] hover:bg-[#EFF2F1]'}`}
        >
          <FileAudioIcon className="w-4 h-4" /> Transcript
          {activeTab === 'transcript' && <div className="absolute bottom-0 w-full h-0.5 bg-[#52796F] rounded-t-full" />}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#EFF2F1]" ref={contentRef}>
        <div className="max-w-4xl mx-auto pb-20">
          
          {activeTab === 'notes' ? (
            <div 
              className="prose prose-stone max-w-none"
              dangerouslySetInnerHTML={{ __html: meeting.htmlContent || "<p class='text-center text-[#84968B] italic mt-10'>Processing notes...</p>" }}
            />
          ) : (
            <div className="bg-[#F9FBFB] p-8 rounded-xl shadow-sm border border-[#CAD2C5]">
              <h3 className="text-lg font-bold text-[#354F52] mb-6 pb-4 border-b border-[#CAD2C5]">Verbatim Transcript</h3>
              {/* Highlighted Transcript Render */}
              <div 
                className="text-[#52796F] text-sm leading-8 whitespace-pre-wrap font-mono"
                dangerouslySetInnerHTML={{ __html: highlightedTranscript }}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default MeetingDetail;