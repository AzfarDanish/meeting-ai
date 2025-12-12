import React, { useState } from 'react';
import { UploadIcon, FileAudioIcon } from './Icons';

interface UploadViewProps {
  onFileSelect: (file: File) => void;
  onCancel: () => void;
}

const UploadView: React.FC<UploadViewProps> = ({ onFileSelect, onCancel }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndProcess(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcess(e.target.files[0]);
    }
  };

  const validateAndProcess = (file: File) => {
    // 500MB Limit (Supported via File API)
    const MAX_SIZE_MB = 500;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File is too large. Please upload a file smaller than ${MAX_SIZE_MB}MB.`);
      return;
    }

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'video/mp4', 'audio/mp4', 'audio/webm', 'audio/aac', 'audio/x-m4a'];
    // Flexible type checking
    if (validTypes.some(type => file.type.includes(type) || file.type === '') || file.name.match(/\.(mp3|wav|mp4|webm|m4a|aac)$/i)) {
      onFileSelect(file);
    } else {
      alert("Please upload a valid audio or video file (MP3, WAV, MP4, WebM, M4A)");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 animate-in zoom-in-95 duration-300 bg-[#F9FBFB]">
       <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-[#354F52] mb-2">Upload Recording</h2>
        <p className="text-[#52796F]">Supports MP3, MP4, WAV, AAC, M4A</p>
      </div>

      <div 
        className={`w-full max-w-md border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer bg-[#F9FBFB]
          ${isDragging ? 'border-[#52796F] bg-[#EFF2F1]' : 'border-[#CAD2C5] hover:border-[#52796F]'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <div className="w-16 h-16 bg-[#EFF2F1] text-[#52796F] rounded-full flex items-center justify-center mb-4">
          <UploadIcon className="w-8 h-8" />
        </div>
        <p className="text-lg font-medium text-[#354F52] mb-2">Click to upload or drag & drop</p>
        <p className="text-sm text-[#84A98C]">Maximum file size: 500MB</p>
        <input 
          id="file-upload" 
          type="file" 
          className="hidden" 
          accept="audio/*,video/*"
          onChange={handleFileInput}
        />
      </div>

      <button 
        onClick={onCancel}
        className="mt-8 px-6 py-2 text-[#52796F] hover:text-[#354F52] transition-colors"
      >
        Cancel
      </button>
    </div>
  );
};

export default UploadView;