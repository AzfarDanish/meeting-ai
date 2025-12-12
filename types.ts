
export interface ActionItem {
  task: string;
  assignee?: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface NoteTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface NotePoint {
  text: string;
  timestamp: string; // MM:SS format
  type?: 'default' | 'callout' | 'code'; // New field for formatting
  nestedPoints?: NotePoint[];
}

export interface NoteSubsection {
  title: string;
  points: NotePoint[];
  tables?: NoteTable[]; // New field for tables
}

export interface NoteSection {
  title: string;
  subsections: NoteSubsection[];
}

export interface HierarchicalNoteData {
  title: string;
  durationMinutes: number;
  shortSummary: string; // 1-2 sentences for preview
  summary: string;
  takeaways: string[]; // Key insights proportional to length
  keyTerms: string[]; // List of important technical terms/concepts for highlighting
  sections: NoteSection[];
  actionItems: ActionItem[];
}

export interface MeetingData {
  id: string;
  title: string;
  date: string;
  durationString: string;
  audioUrl?: string;
  transcript: string;
  noteData: HierarchicalNoteData; // Structured JSON data
  htmlContent: string; // Generated HTML for display
  status: 'processing' | 'completed' | 'failed';
  source: 'upload' | 'recording';
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  RECORD = 'RECORD',
  UPLOAD = 'UPLOAD',
  MEETING_DETAIL = 'MEETING_DETAIL'
}

export interface ProcessingState {
  isTranscribing: boolean;
  isThinking: boolean;
  progress: number; // 0-100
  statusMessage: string;
}