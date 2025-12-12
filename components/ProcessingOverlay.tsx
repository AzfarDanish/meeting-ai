import React from 'react';
import { LoaderIcon, BrainCircuitIcon, FileAudioIcon, CheckCircleIcon } from './Icons';
import { ProcessingState } from '../types';

interface ProcessingOverlayProps {
  state: ProcessingState;
}

const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ state }) => {
  // Determine phases for the stepper
  const isTranscribing = state.progress >= 30;
  const isAnalyzing = state.progress >= 60;
  const isFinalizing = state.progress >= 90;

  return (
    <div className="fixed inset-0 bg-[#EFF2F1] z-50 flex flex-col items-center justify-center overflow-hidden">
      
      {/* --- Background Skeleton UI (Preview of what's coming) --- */}
      <div className="absolute inset-0 opacity-40 pointer-events-none scale-[0.98] blur-[2px] transition-opacity duration-500">
        <div className="max-w-4xl mx-auto mt-24 p-8 space-y-10 bg-[#F9FBFB] rounded-2xl shadow-sm h-full border border-[#CAD2C5]">
           {/* Skeleton Header */}
           <div className="flex gap-6 items-center border-b border-[#CAD2C5] pb-6">
             <div className="w-14 h-14 bg-[#CAD2C5] rounded-full animate-pulse" />
             <div className="flex-1 space-y-3">
               <div className="h-8 w-1/3 bg-[#CAD2C5] rounded-md animate-pulse" />
               <div className="h-4 w-1/5 bg-[#CAD2C5] rounded-md animate-pulse" />
             </div>
           </div>
           
           {/* Skeleton Content Grid */}
           <div className="grid grid-cols-3 gap-8">
              {/* Sidebar / TOC Skeleton */}
              <div className="col-span-1 space-y-4">
                 <div className="h-4 w-full bg-[#EFF2F1] rounded animate-pulse" />
                 <div className="h-4 w-5/6 bg-[#EFF2F1] rounded animate-pulse" />
                 <div className="h-4 w-4/6 bg-[#EFF2F1] rounded animate-pulse" />
              </div>
              
              {/* Main Content Skeleton */}
              <div className="col-span-2 space-y-8">
                  {/* Summary Block */}
                  <div className="h-40 w-full bg-[#EFF2F1] rounded-xl animate-pulse" /> 
                  
                  {/* Sections */}
                  <div className="space-y-4">
                     <div className="h-6 w-1/3 bg-[#CAD2C5] rounded animate-pulse" />
                     <div className="h-4 w-full bg-[#EFF2F1] rounded animate-pulse" />
                     <div className="h-4 w-full bg-[#EFF2F1] rounded animate-pulse" />
                     <div className="h-4 w-5/6 bg-[#EFF2F1] rounded animate-pulse" />
                  </div>

                  <div className="space-y-4">
                     <div className="h-6 w-1/3 bg-[#CAD2C5] rounded animate-pulse" />
                     <div className="h-4 w-full bg-[#EFF2F1] rounded animate-pulse" />
                     <div className="h-4 w-5/6 bg-[#EFF2F1] rounded animate-pulse" />
                  </div>
              </div>
           </div>
        </div>
      </div>

      {/* --- Foreground Processing Card --- */}
      <div className="relative z-10 bg-[#F9FBFB]/95 backdrop-blur-2xl border border-[#F9FBFB]/40 rounded-3xl shadow-2xl p-8 w-full max-w-md text-center transform transition-all duration-300">
        
        {/* Animated Icon Container */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          {/* Outer Glow */}
          <div className="absolute inset-0 bg-[#EFF2F1] rounded-full animate-ping opacity-30 duration-[3s]" />
          
          {/* Spinning Ring */}
          <div 
            className="absolute inset-0 border-[6px] border-[#EFF2F1] rounded-full" 
          />
          <div 
             className="absolute inset-0 border-[6px] border-[#52796F] rounded-full border-t-transparent animate-spin" 
             style={{ animationDuration: state.isThinking ? '1.5s' : '1s' }}
          />
          
          {/* Central Icon */}
          <div className="absolute inset-0 flex items-center justify-center transition-all duration-500">
            {state.isThinking ? (
               <BrainCircuitIcon className="w-10 h-10 text-[#52796F] animate-pulse" />
            ) : isFinalizing ? (
               <CheckCircleIcon className="w-10 h-10 text-emerald-500 animate-[bounce_1s_infinite]" />
            ) : (
               <FileAudioIcon className="w-10 h-10 text-[#52796F] animate-[pulse_2s_infinite]" />
            )}
          </div>
        </div>

        <h3 className="text-2xl font-bold text-[#354F52] mb-2 tracking-tight">
          {isFinalizing ? "Finishing Up..." : state.isThinking ? "Analyzing Meeting..." : "Transcribing Audio..."}
        </h3>
        
        <p className="text-[#52796F] font-medium mb-8 h-6 flex items-center justify-center">
          <span className="animate-pulse">{state.statusMessage}</span>
        </p>

        {/* Stepper Visualization */}
        <div className="flex justify-between items-center px-4 mb-8 relative">
           {/* Connecting Line background */}
           <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-[#CAD2C5] -z-10" />
           {/* Connecting Line Active */}
           <div 
             className="absolute left-6 top-1/2 h-0.5 bg-[#52796F] -z-10 transition-all duration-700" 
             style={{ width: `${Math.max(0, state.progress - 10)}%` }} // Rough mapping
           />

           <StepIndicator active={true} completed={isTranscribing} label="Audio" />
           <StepIndicator active={isTranscribing} completed={isAnalyzing} label="Analysis" />
           <StepIndicator active={isAnalyzing} completed={isFinalizing} label="Notes" />
        </div>

        {/* Enhanced Progress Bar */}
        <div className="relative h-2 bg-[#EFF2F1] rounded-full overflow-hidden w-full">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#52796F] via-[#84A98C] to-[#52796F] transition-all duration-700 ease-out rounded-full"
            style={{ 
              width: `${state.progress}%`, 
              backgroundSize: '200% 100%', 
              animation: 'shimmer 1.5s linear infinite' 
            }}
          />
        </div>
      </div>
      
      {/* Styles for Shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </div>
  );
};

const StepIndicator = ({ active, completed, label }: { active: boolean, completed: boolean, label: string }) => (
  <div className="flex flex-col items-center gap-2 bg-[#F9FBFB] px-2">
    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-300
      ${completed ? 'bg-[#52796F] border-[#52796F]' : active ? 'border-[#52796F] bg-[#F9FBFB]' : 'border-[#CAD2C5] bg-[#EFF2F1]'}
    `}>
      {completed && <div className="w-2 h-1 border-b-2 border-r-2 border-[#F9FBFB] rotate-45 mb-0.5" />}
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${active || completed ? 'text-[#52796F]' : 'text-[#84A98C]'}`}>
      {label}
    </span>
  </div>
);

export default ProcessingOverlay;