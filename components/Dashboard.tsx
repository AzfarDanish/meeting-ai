import React, { useState } from 'react';
import { MeetingData } from '../types';
import { MicIcon, UploadIcon, BrainCircuitIcon, GlobeIcon, CheckCircleIcon, HomeIcon, NotebookIcon, UserIcon, SearchIcon } from './Icons';

interface DashboardProps {
  meetings: MeetingData[];
  onRecord: () => void;
  onUpload: () => void;
  onSelectMeeting: (meeting: MeetingData) => void;
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
}

const SUPPORTED_LANGUAGES = [
  "English", "Spanish", "French", "German", 
  "Chinese", "Japanese", "Korean", "Portuguese", 
  "Italian", "Hindi", "Arabic", "Russian"
];

const Dashboard: React.FC<DashboardProps> = ({ 
  meetings, 
  onRecord, 
  onUpload, 
  onSelectMeeting,
  currentLanguage,
  onLanguageChange
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'notes' | 'profile'>('home');
  const [isLanguageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtering Logic
  const filteredMeetings = meetings.filter((meeting) => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;

    return (
      meeting.title.toLowerCase().includes(query) ||
      meeting.transcript.toLowerCase().includes(query) ||
      meeting.noteData.summary.toLowerCase().includes(query) ||
      (meeting.noteData.shortSummary && meeting.noteData.shortSummary.toLowerCase().includes(query)) ||
      meeting.noteData.actionItems.some(item => item.task.toLowerCase().includes(query))
    );
  });

  return (
    <div className="flex flex-col h-full bg-[#EFF2F1] relative">
      
      {/* Content Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        
        {/* --- HOME TAB --- */}
        {activeTab === 'home' && (
          <div className="p-6 flex flex-col gap-6 animate-in fade-in duration-300">
             {/* Title */}
             <div className="mt-8 mb-2">
                <h1 className="text-3xl font-bold text-[#354F52] tracking-tight">MeetingMind</h1>
                <p className="text-[#52796F] text-lg">Capture & Analyze</p>
             </div>
             
             {/* Action Buttons */}
             <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={onRecord}
                  className="flex flex-col items-center justify-center p-6 bg-[#52796F] rounded-2xl shadow-lg shadow-[#52796F]/20 hover:bg-[#354F52] hover:shadow-xl hover:-translate-y-1 transition-all group aspect-square"
                >
                  <div className="w-12 h-12 bg-[#F9FBFB]/20 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <MicIcon className="w-6 h-6 text-[#F9FBFB]" />
                  </div>
                  <span className="font-semibold text-[#F9FBFB]">Record</span>
                  <span className="text-[#CAD2C5] text-xs mt-1">Live</span>
                </button>

                <button 
                  onClick={onUpload}
                  className="flex flex-col items-center justify-center p-6 bg-[#F9FBFB] border border-[#CAD2C5] rounded-2xl shadow-sm hover:border-[#84A98C] hover:shadow-md hover:-translate-y-1 transition-all group aspect-square"
                >
                  <div className="w-12 h-12 bg-[#EFF2F1] rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <UploadIcon className="w-6 h-6 text-[#52796F]" />
                  </div>
                  <span className="font-semibold text-[#354F52]">Upload</span>
                  <span className="text-[#84A98C] text-xs mt-1">File</span>
                </button>
             </div>

             {/* Output Language Selector (Minimalist Card) */}
             <div>
                <button 
                  onClick={() => setLanguageSheetOpen(true)}
                  className="w-full bg-[#F9FBFB] border border-[#CAD2C5] rounded-xl p-4 flex items-center justify-between shadow-sm hover:border-[#84A98C] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#EFF2F1] text-[#52796F] flex items-center justify-center">
                      <GlobeIcon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-[#84A98C] font-medium uppercase tracking-wider">Output Language</p>
                      <p className="text-sm font-semibold text-[#354F52]">{currentLanguage}</p>
                    </div>
                  </div>
                  <span className="text-xs text-[#52796F] font-medium group-hover:underline">Change</span>
                </button>
             </div>
          </div>
        )}

        {/* --- NOTES TAB --- */}
        {activeTab === 'notes' && (
          <div className="p-6 animate-in fade-in duration-300 flex flex-col h-full">
             <div className="mb-6">
               <h2 className="text-2xl font-bold text-[#354F52] mb-4">Your Notes</h2>
               
               {/* Search Bar */}
               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   <SearchIcon className="h-5 w-5 text-[#84A98C]" />
                 </div>
                 <input
                   type="text"
                   className="block w-full pl-10 pr-3 py-3 border border-[#CAD2C5] rounded-xl leading-5 bg-[#F9FBFB] placeholder-[#84A98C] text-[#354F52] focus:outline-none focus:ring-2 focus:ring-[#52796F] focus:border-[#52796F] sm:text-sm shadow-sm transition-shadow"
                   placeholder="Search transcripts, summaries..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                 />
               </div>
             </div>
             
             {filteredMeetings.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-6 bg-[#F9FBFB] rounded-2xl border border-dashed border-[#CAD2C5]">
                 <div className="w-16 h-16 bg-[#EFF2F1] rounded-full flex items-center justify-center mx-auto mb-4">
                    {searchQuery ? (
                      <SearchIcon className="w-8 h-8 text-[#84A98C]" />
                    ) : (
                      <BrainCircuitIcon className="w-8 h-8 text-[#84A98C]" />
                    )}
                 </div>
                 <p className="text-[#52796F] font-medium">
                   {searchQuery ? "No matching notes found" : "No meetings yet"}
                 </p>
                 <p className="text-[#84A98C] text-sm mt-1">
                   {searchQuery ? "Try a different keyword or check spelling." : "Go to Home to record or upload."}
                 </p>
               </div>
             ) : (
               <div className="space-y-3 pb-4">
                 {filteredMeetings.map((meeting) => (
                   <div 
                     key={meeting.id}
                     onClick={() => onSelectMeeting(meeting)}
                     className="bg-[#F9FBFB] p-4 rounded-xl border border-[#CAD2C5] shadow-sm hover:shadow-md hover:border-[#84A98C] cursor-pointer transition-all active:scale-[0.99]"
                   >
                     <div className="flex justify-between items-start mb-2">
                       <h3 className="font-semibold text-[#354F52] line-clamp-1">{meeting.title}</h3>
                       <span className="text-xs text-[#52796F] bg-[#EFF2F1] px-2 py-1 rounded-md">{meeting.date}</span>
                     </div>
                     <p className="text-sm text-[#52796F] line-clamp-2 mb-3">
                       {meeting.noteData.shortSummary || meeting.noteData.summary || meeting.transcript}
                     </p>
                     <div className="flex items-center gap-3">
                       <div className="flex items-center gap-1 text-xs text-[#84A98C]">
                         <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                         Completed
                       </div>
                       {meeting.noteData.actionItems.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-[#EFF2F1] text-[#52796F] text-xs font-medium">
                            {meeting.noteData.actionItems.length} Actions
                          </span>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}

        {/* --- PROFILE TAB --- */}
        {activeTab === 'profile' && (
           <div className="p-6 animate-in fade-in duration-300">
              <h2 className="text-2xl font-bold text-[#354F52] mb-6">Profile</h2>
              <div className="bg-[#F9FBFB] p-8 rounded-2xl border border-[#CAD2C5] text-center shadow-sm">
                 <div className="w-24 h-24 bg-[#EFF2F1] rounded-full mx-auto mb-4 flex items-center justify-center text-[#52796F]">
                    <UserIcon className="w-10 h-10" />
                 </div>
                 <h3 className="text-xl font-bold text-[#354F52]">Guest User</h3>
                 <p className="text-[#52796F] mb-6">guest@meetingmind.ai</p>
                 <button className="px-6 py-2 bg-[#EFF2F1] text-[#52796F] rounded-full font-medium hover:bg-[#CAD2C5] hover:text-[#354F52] transition-colors">
                    Edit Profile
                 </button>
              </div>
           </div>
        )}

      </main>

      {/* --- Bottom Navigation --- */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#F9FBFB] border-t border-[#CAD2C5] px-8 py-3 flex justify-between items-center z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
          <button 
            onClick={() => setActiveTab('home')} 
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-[#52796F]' : 'text-[#84A98C] hover:text-[#52796F]'}`}
          >
             <HomeIcon className="w-6 h-6" />
             <span className="text-[10px] font-medium">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('notes')} 
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'notes' ? 'text-[#52796F]' : 'text-[#84A98C] hover:text-[#52796F]'}`}
          >
             <NotebookIcon className="w-6 h-6" />
             <span className="text-[10px] font-medium">Notes</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')} 
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-[#52796F]' : 'text-[#84A98C] hover:text-[#52796F]'}`}
          >
             <UserIcon className="w-6 h-6" />
             <span className="text-[10px] font-medium">Profile</span>
          </button>
      </div>

      {/* --- Language Selection Bottom Sheet --- */}
      {isLanguageSheetOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-[#354F52]/40 backdrop-blur-sm z-40 transition-opacity animate-in fade-in"
            onClick={() => setLanguageSheetOpen(false)}
          />
          
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 bg-[#F9FBFB] rounded-t-3xl z-50 p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[80vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-[#CAD2C5] rounded-full mx-auto mb-6" />
            
            <h3 className="text-lg font-bold text-[#354F52] mb-6 text-center">Select Output Language</h3>
            
            <div className="grid grid-cols-2 gap-3 pb-8">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    onLanguageChange(lang);
                    setLanguageSheetOpen(false);
                  }}
                  className={`flex items-center justify-between p-4 rounded-xl border text-sm font-medium transition-all
                    ${currentLanguage === lang 
                      ? 'bg-[#EFF2F1] border-[#52796F] text-[#52796F] shadow-sm' 
                      : 'bg-[#F9FBFB] border-[#CAD2C5] text-[#84A98C] hover:bg-[#EFF2F1] hover:border-[#84A98C]'}`}
                >
                  {lang}
                  {currentLanguage === lang && <CheckCircleIcon className="w-4 h-4 text-[#52796F]" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;