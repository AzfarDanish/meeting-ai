import React, { useState, useCallback } from 'react';
import { AppView, MeetingData, ProcessingState, HierarchicalNoteData, NotePoint } from './types';
import Dashboard from './components/Dashboard';
import RecordView from './components/RecordView';
import UploadView from './components/UploadView';
import MeetingDetail from './components/MeetingDetail';
import ProcessingOverlay from './components/ProcessingOverlay';
import { prepareAudioData, transcribeAudio, analyzeTranscript, generateHtmlFromNotes } from './services/geminiService';

// Sample initial data with Hierarchical content
const SAMPLE_MEETINGS: MeetingData[] = [
  {
    id: '1',
    title: 'Product Roadmap Q3 Strategy',
    date: 'Oct 24, 2023',
    durationString: '15:02',
    transcript: "[00:00] Welcome everyone...",
    noteData: {
      title: "Product Roadmap Q3 Strategy",
      durationMinutes: 15,
      shortSummary: "The team locked the Nov 15th Mobile App launch date and reallocated budget for server costs.",
      summary: "The team convened to finalize the **Q3 Product Roadmap**, focusing heavily on the upcoming **Mobile App Launch**. Key decisions included locking the release date for **November 15th** and reallocating budget to cover unexpected server costs. Sarah was assigned as the lead for the design sprint.",
      takeaways: [
        "Mobile App launch locked for Nov 15th",
        "Budget reallocated for server infrastructure",
        "Sarah appointed as Design Lead"
      ],
      keyTerms: ["Q3 Product Roadmap", "Mobile App Launch", "November 15th", "Design Lead", "Server Infrastructure"],
      sections: [
        {
          title: "Mobile App Launch",
          subsections: [
            {
              title: "Release Timeline",
              points: [
                { 
                  text: "**Release Date**: Confirmed for November 15th.", 
                  timestamp: "00:15",
                  nestedPoints: [
                    { text: "**Code Freeze**: Scheduled for Nov 1st.", timestamp: "00:20" }
                  ]
                },
                { text: "**Beta Testing**: Begins next week with 50 users.", timestamp: "00:45" }
              ]
            }
          ]
        },
        {
          title: "Resource Management",
          subsections: [
            {
              title: "Budget Review",
              points: [
                { text: "**Status**: Q3 budget is currently on track.", timestamp: "02:00" },
                { text: "**Approval**: Approved $5k additional spend for server infrastructure.", timestamp: "03:00" }
              ]
            }
          ]
        }
      ],
      actionItems: [
        { task: "Update Figma designs for mobile flow", assignee: "Sarah", priority: "High" },
        { task: "Procure additional server instances", assignee: "DevOps", priority: "Medium" }
      ]
    },
    htmlContent: "", // Will be generated on load
    status: 'completed',
    source: 'recording'
  }
];

// Initialize sample HTML
SAMPLE_MEETINGS[0].htmlContent = generateHtmlFromNotes(SAMPLE_MEETINGS[0].noteData);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [meetings, setMeetings] = useState<MeetingData[]>(SAMPLE_MEETINGS);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingData | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState | null>(null);
  
  // Output Language State
  const [outputLanguage, setOutputLanguage] = useState<string>("English");

  const handleUpdateTitle = (id: string, newTitle: string) => {
    // Update main list
    setMeetings(prev => prev.map(m => {
      if (m.id === id) {
        return { 
          ...m, 
          title: newTitle,
          noteData: { ...m.noteData, title: newTitle }
        };
      }
      return m;
    }));

    // Update selected view if active
    if (selectedMeeting && selectedMeeting.id === id) {
      setSelectedMeeting(prev => prev ? ({
          ...prev, 
          title: newTitle,
          noteData: { ...prev.noteData, title: newTitle }
      }) : null);
    }
  };

  const getAudioDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      audio.onerror = () => {
        resolve(0);
      };
    });
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

  const parseTimestampToSeconds = (ts: string): number => {
    if (!ts) return 0;
    const clean = ts.replace(/[\[\]]/g, '');
    const parts = clean.split(':').reverse();
    let seconds = 0;
    if (parts[0]) seconds += parseInt(parts[0], 10) || 0;
    if (parts[1]) seconds += (parseInt(parts[1], 10) || 0) * 60;
    if (parts[2]) seconds += (parseInt(parts[2], 10) || 0) * 3600;
    return seconds;
  };

  const sanitizeNoteData = (data: HierarchicalNoteData, maxSeconds: number) => {
    if (maxSeconds <= 0) return;

    const sanitizePoint = (point: NotePoint) => {
      if (point.timestamp) {
        const t = parseTimestampToSeconds(point.timestamp);
        if (t > maxSeconds) {
           // Clamp to maxDuration - 1s to ensure it's safely within bounds
           const safeTime = Math.max(0, maxSeconds - 1);
           point.timestamp = formatTime(safeTime);
        }
      }
      if (point.nestedPoints) {
        point.nestedPoints.forEach(sanitizePoint);
      }
    };

    if (data.sections) {
      data.sections.forEach(section => {
        if (section.subsections) {
          section.subsections.forEach(sub => {
            if (sub.points) {
              sub.points.forEach(sanitizePoint);
            }
          });
        }
      });
    }
  };

  const handleProcessMedia = useCallback(async (blobOrFile: Blob | File) => {
    setProcessingState({
      isTranscribing: true,
      isThinking: false,
      progress: 5,
      statusMessage: "Preparing audio..."
    });

    try {
      // 1. Ensure File Object (Naming)
      let file: File;
      if (blobOrFile instanceof Blob && !(blobOrFile instanceof File)) {
        file = new File([blobOrFile], "recording.webm", { type: blobOrFile.type });
      } else {
        file = blobOrFile as File;
      }

      // Create an audio URL for playback in the app
      const audioUrl = URL.createObjectURL(file);
      
      // Get exact duration for precise UI
      const durationSecs = await getAudioDuration(audioUrl);

      // 2. Prepare Audio (Upload if needed)
      // This step handles File API upload or Inline base64 conversion
      setProcessingState(prev => ({ 
        ...prev!, 
        progress: 15, 
        statusMessage: file.size > 9 * 1024 * 1024 ? "Uploading large file..." : "Processing audio..." 
      }));
      
      const audioPart = await prepareAudioData(file);

      // 3. Transcribe
      setProcessingState(prev => ({ ...prev!, progress: 30, statusMessage: "Transcribing..." }));
      const transcript = await transcribeAudio(audioPart);
      
      // 4. Analyze (Pass Audio Part for Accuracy)
      setProcessingState(prev => ({ 
        ...prev!, 
        isTranscribing: false, 
        isThinking: true, 
        progress: 60, 
        statusMessage: `Analyzing structure in ${outputLanguage}...` 
      }));

      const analysisData = await analyzeTranscript(transcript, audioPart, outputLanguage);

      // 5. Sanitize Timestamps
      if (durationSecs > 0) {
        sanitizeNoteData(analysisData, durationSecs);
      }

      // 6. Generate HTML
      const htmlOutput = generateHtmlFromNotes(analysisData);

      setProcessingState(prev => ({ ...prev!, progress: 90, statusMessage: "Finalizing..." }));

      // 7. Create Meeting Object
      const newMeeting: MeetingData = {
        id: Date.now().toString(),
        title: analysisData.title || "Untitled Meeting",
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        durationString: formatTime(durationSecs), 
        audioUrl: audioUrl,
        transcript: transcript,
        noteData: {
          ...analysisData,
          // Overwrite estimated duration with exact duration if available
          durationMinutes: durationSecs > 0 ? durationSecs / 60 : analysisData.durationMinutes
        },
        htmlContent: htmlOutput,
        status: 'completed',
        source: blobOrFile instanceof File ? 'upload' : 'recording'
      };

      setMeetings(prev => [newMeeting, ...prev]);
      setSelectedMeeting(newMeeting);
      setCurrentView(AppView.MEETING_DETAIL);

    } catch (error: any) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Processing failed. Please try again.";
      alert(errorMessage);
    } finally {
      setProcessingState(null);
    }
  }, [outputLanguage]); 

  return (
    <div className="h-screen w-screen bg-[#EFF2F1] overflow-hidden relative text-[#354F52]">
      
      {processingState && <ProcessingOverlay state={processingState} />}

      {currentView === AppView.DASHBOARD && (
        <Dashboard 
          meetings={meetings}
          onRecord={() => setCurrentView(AppView.RECORD)}
          onUpload={() => setCurrentView(AppView.UPLOAD)}
          onSelectMeeting={(m) => {
            setSelectedMeeting(m);
            setCurrentView(AppView.MEETING_DETAIL);
          }}
          currentLanguage={outputLanguage}
          onLanguageChange={setOutputLanguage}
        />
      )}

      {currentView === AppView.RECORD && (
        <RecordView 
          onCancel={() => setCurrentView(AppView.DASHBOARD)}
          onRecordingComplete={(blob) => handleProcessMedia(blob)}
        />
      )}

      {currentView === AppView.UPLOAD && (
        <UploadView 
          onCancel={() => setCurrentView(AppView.DASHBOARD)}
          onFileSelect={(file) => handleProcessMedia(file)}
        />
      )}

      {currentView === AppView.MEETING_DETAIL && selectedMeeting && (
        <MeetingDetail 
          meeting={selectedMeeting}
          onBack={() => {
            setSelectedMeeting(null);
            setCurrentView(AppView.DASHBOARD);
          }}
          onUpdateTitle={(newTitle) => handleUpdateTitle(selectedMeeting.id, newTitle)}
        />
      )}
    </div>
  );
};

export default App;