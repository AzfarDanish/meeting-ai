import { GoogleGenAI, Type } from "@google/genai";
import { ActionItem, HierarchicalNoteData, NotePoint, NoteSection, NoteSubsection, NoteTable } from '../types';

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;

// Define AudioPart interface locally
export interface AudioPart {
  inlineData?: {
    mimeType: string;
    data: string;
  };
  fileData?: {
    mimeType: string;
    fileUri: string;
  };
}

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Generic retry wrapper
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.warn(`API Attempt ${i + 1} failed:`, error);
      
      // If permission denied (403) or bad request (400), do not retry as it won't fix it
      const errStr = String(error);
      if (errStr.includes("403") || errStr.includes("400") || errStr.includes("PERMISSION_DENIED")) {
        throw error;
      }

      if (i < MAX_RETRIES - 1) {
        await delay(BASE_RETRY_DELAY * Math.pow(2, i));
      }
    }
  }
  throw lastError;
}

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// Internal helper for inline processing
const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Prepares audio data for Gemini API.
 * Handles resizing logic: Inline for medium files, File API for large files.
 * Includes fallback to inline if File API fails (e.g. Permission Denied).
 */
export const prepareAudioData = async (file: File): Promise<AudioPart> => {
  const ai = getAiClient();
  
  // 15MB binary ~ 20MB base64 (API limit). 
  // We try to stay inline to avoid File API permission issues.
  const INLINE_SIZE_LIMIT = 15 * 1024 * 1024; 

  try {
    if (file.size < INLINE_SIZE_LIMIT) {
      const base64Audio = await fileToBase64(file);
      return {
        inlineData: {
          mimeType: file.type || 'audio/mp3',
          data: base64Audio
        }
      };
    } else {
      console.log(`File size ${file.size} exceeds inline limit. Attempting File API.`);
      
      // Clean MIME type (strip parameters like codecs)
      const cleanMimeType = (file.type || 'audio/mp3').split(';')[0];
      
      try {
        if (!ai.files) {
          throw new Error("File API not supported in this client configuration.");
        }

        const uploadResult = await ai.files.upload({
          file: file,
          config: { mimeType: cleanMimeType }
        });
        
        const fileUri = uploadResult.uri;
        const fileName = uploadResult.name;
        
        let state = uploadResult.state;
        let attempts = 0;
        while (state === 'PROCESSING') {
          if (attempts > 60) throw new Error("File processing timed out.");
          await delay(2000);
          const freshFile = await ai.files.get({ name: fileName });
          state = freshFile.state;
          attempts++;
        }

        if (state === 'FAILED') throw new Error("Gemini failed to process audio.");

        return {
          fileData: {
            mimeType: uploadResult.mimeType,
            fileUri: fileUri
          }
        };

      } catch (uploadError: any) {
        console.warn("File API failed (likely permission or network). Falling back to inline.", uploadError);
        
        // Fallback: Try inline even if large (API might reject, but better than hard failing on 403)
        // Client-side browser sanity limit (40MB) to prevent crashing
        const HARD_LIMIT = 40 * 1024 * 1024; 
        if (file.size > HARD_LIMIT) {
           throw new Error(`File too large (${(file.size/1024/1024).toFixed(1)}MB) and upload permission denied. Please use a file smaller than 40MB.`);
        }

        const base64Audio = await fileToBase64(file);
        return {
          inlineData: {
            mimeType: file.type || 'audio/mp3',
            data: base64Audio
          }
        };
      }
    }
  } catch (error: any) {
    console.error("Audio preparation error:", error);
    // Format error for UI
    let msg = error.message;
    if (typeof error === 'object' && error.message && error.message.includes("403")) {
      msg = "Permission Denied: Your API Key does not support File Uploads. Please try a shorter recording.";
    }
    throw new Error(msg);
  }
};

/**
 * Transcribes audio using the fast Flash model.
 * Accepts a prepared AudioPart.
 */
export const transcribeAudio = async (audioPart: AudioPart): Promise<string> => {
  const ai = getAiClient();

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          audioPart,
          {
            text: "Generate a verbatim transcription. Insert timestamps [MM:SS] or [HH:MM:SS] at start of sentences/speakers."
          }
        ]
      }
    }));

    return response.text || "No transcription available.";

  } catch (error: any) {
    console.error("Transcription error:", error);
    const errString = error.message || JSON.stringify(error);
    if (errString.includes("413") || errString.includes("too large")) {
      throw new Error("File too large for inline processing. Please use a shorter file.");
    }
    throw error;
  }
};

/**
 * Helpers for HTML Generation
 */
const parseBold = (text: string): string => {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
};

const highlightKeyTerms = (text: string, terms: string[] | undefined): string => {
  if (!terms || terms.length === 0 || !text) return text;
  
  // Sort terms by length descending to prevent partial replacements (e.g. matching 'Art' in 'Artificial Intelligence' incorrectly)
  const sortedTerms = [...terms].sort((a, b) => b.length - a.length);
  
  // Create a regex that matches terms with word boundaries, ignoring case
  // Escaping regex special characters in terms
  const escapedTerms = sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
  // Note: We use a capturing group to preserve the original casing of the matched term
  const pattern = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');
  
  return text.replace(pattern, '<span class="term-highlight">$1</span>');
};

const formatText = (text: string, keyTerms?: string[]) => {
  return highlightKeyTerms(parseBold(text), keyTerms);
};

const secondsToTimestamp = (s: number): string => {
  if (isNaN(s) || s < 0) return '[00:00]';
  const totalSeconds = Math.floor(s);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `[${pad(hours)}:${pad(minutes)}:${pad(seconds)}]`;
  }
  return `[${pad(minutes)}:${pad(seconds)}]`;
};

const timestampToSeconds = (ts: string): number => {
  if (!ts) return 0;
  const clean = ts.replace(/[\[\]]/g, '');
  const parts = clean.split(':');
  if (parts.length === 3) return parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseInt(parts[2]);
  if (parts.length === 2) return parseInt(parts[0])*60 + parseInt(parts[1]);
  return 0;
};

// Assign icons based on content keywords
const getIconForTitle = (title: string): string => {
  const t = title.toLowerCase();
  if (t.includes('overview') || t.includes('summary')) return '📖';
  if (t.includes('key') || t.includes('takeaway')) return '🔑';
  if (t.includes('stack')) return '🥞';
  if (t.includes('queue')) return '📥';
  if (t.includes('tree') || t.includes('root') || t.includes('trie')) return '🌳';
  if (t.includes('graph') || t.includes('node') || t.includes('link')) return '🔗';
  if (t.includes('hash') || t.includes('map') || t.includes('dictionary')) return '🗂️';
  if (t.includes('search') || t.includes('find')) return '🔍';
  if (t.includes('sort') || t.includes('order')) return '📶';
  if (t.includes('array') || t.includes('list')) return '📝';
  if (t.includes('problem') || t.includes('issue') || t.includes('limitation') || t.includes('pitfall')) return '⚠️';
  if (t.includes('solution') || t.includes('fix') || t.includes('strategy')) return '🛠️';
  if (t.includes('memory') || t.includes('alloc') || t.includes('leak')) return '💾';
  return '📌';
};

const generateTableHtml = (table: NoteTable, keyTerms?: string[]): string => {
  return `
    <div class="note-table-container">
      ${table.title ? `<div class="table-caption">${formatText(table.title, keyTerms)}</div>` : ''}
      <table class="note-table">
        <thead>
          <tr>
            ${table.headers.map(h => `<th>${formatText(h, keyTerms)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${table.rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${formatText(cell, keyTerms)}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

const generatePointsHtml = (points: NotePoint[], keyTerms?: string[]): string => {
  if (!points || points.length === 0) return '';
  
  // Group logic: If a point is 'code' or 'callout', render it distinct from the list
  let html = '';
  let inList = false;

  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  points.forEach(point => {
    const timeSecs = timestampToSeconds(point.timestamp);
    const cleanTimestamp = point.timestamp ? point.timestamp.replace(/[\[\]]/g, '') : "00:00";
    const timestampBtn = `
      <button 
        type="button"
        class="timestamp-tag" 
        data-time="${timeSecs}"
        aria-label="Play from ${cleanTimestamp}"
        title="Jump to ${cleanTimestamp}"
      >
        [${cleanTimestamp}]
      </button>`;

    if (point.type === 'callout') {
      closeList();
      html += `
        <div class="note-callout">
          <div class="callout-bar"></div>
          <div class="callout-content">
            <span class="note-text">${formatText(point.text, keyTerms)}</span>
            ${timestampBtn}
          </div>
        </div>
      `;
    } else if (point.type === 'code') {
      closeList();
      html += `
        <div class="note-code-block">
          <pre><code>${point.text}</code></pre>
          <div class="code-footer">${timestampBtn}</div>
        </div>
      `;
    } else {
      // Default bullet point
      if (!inList) {
        html += '<ul class="note-list">';
        inList = true;
      }
      html += `
        <li class="note-item">
          <div class="note-content-line">
            <span class="note-text">${formatText(point.text, keyTerms)}</span>
            ${timestampBtn}
          </div>
          ${point.nestedPoints ? generatePointsHtml(point.nestedPoints, keyTerms) : ''}
        </li>
      `;
    }
  });

  closeList();
  return html;
};

export const generateHtmlFromNotes = (data: HierarchicalNoteData): string => {
  let html = `<div class="meeting-notes-container">`;
  
  const copyIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

  // 1. Brief Overview (PDF Style)
  html += `
    <div class="section-block">
      <div class="section-header">
        <span class="section-icon">📖</span>
        <h2>Brief Overview</h2>
        <button class="copy-summary-btn ml-2 p-1.5 rounded-md hover:bg-[#E0E7FF] text-[#52796F] transition-colors" title="Copy Summary">
            ${copyIconSvg}
        </button>
      </div>
      <p class="overview-text">${formatText(data.summary, data.keyTerms)}</p>
    </div>
  `;

  // 2. Key Points (PDF Style)
  if (data.takeaways && data.takeaways.length > 0) {
    html += `
      <div class="section-block">
        <div class="section-header">
          <span class="section-icon">🔑</span>
          <h2>Key Points</h2>
        </div>
        <ul class="note-list">
          ${data.takeaways.map(t => `<li><span class="note-text">${formatText(t, data.keyTerms)}</span></li>`).join('')}
        </ul>
      </div>
    `;
  }

  // 3. Sections
  data.sections.forEach(section => {
    const icon = getIconForTitle(section.title);
    html += `
      <div class="section-block">
        <div class="section-header">
          <span class="section-icon">${icon}</span>
          <h2>${formatText(section.title, data.keyTerms)}</h2>
        </div>
    `;
    
    if (section.subsections) {
      section.subsections.forEach(sub => {
        html += `<div class="subsection-block">`;
        html += `<h3>${formatText(sub.title, data.keyTerms)}</h3>`;
        
        // Render Points (which handles code and callouts)
        if (sub.points) {
          html += generatePointsHtml(sub.points, data.keyTerms);
        }

        // Render Tables if any
        if (sub.tables && sub.tables.length > 0) {
          sub.tables.forEach(table => {
            html += generateTableHtml(table, data.keyTerms);
          });
        }
        
        html += `</div>`;
      });
    }
    html += `</div>`;
  });

  // 4. Action Items (Grid)
  if (data.actionItems && data.actionItems.length > 0) {
    html += `
      <div class="section-block action-items-section">
        <div class="section-header">
          <span class="section-icon">✅</span>
          <h2>Action Items</h2>
        </div>
        <div class="action-grid">
    `;
    data.actionItems.forEach((item, index) => {
      const priorityColors = {
        High: 'bg-red-100 text-red-700 border-red-200',
        Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        Low: 'bg-green-100 text-green-700 border-green-200'
      };
      html += `
        <div class="action-card">
          <div class="action-header">
            <span class="action-number">#${index + 1}</span>
            <span class="action-priority ${priorityColors[item.priority] || ''}">${item.priority}</span>
          </div>
          <div class="action-body">
            <div class="action-task">${formatText(item.task, data.keyTerms)}</div>
            <div class="action-assignee">👤 ${item.assignee || 'Unassigned'}</div>
          </div>
        </div>
      `;
    });
    html += `</div></div>`;
  }

  html += `</div>`;
  return html;
};

const getDurationFromTranscript = (transcript: string): number => {
  // Enhanced regex to capture [MM:SS], [HH:MM:SS], or [MMM:SS] where minutes > 99
  const matches = transcript.match(/\[(\d+:)?\d+:\d{2}\]/g);
  if (matches && matches.length > 0) {
    const lastTimestamp = matches[matches.length - 1];
    // Use the existing robust timestamp parser
    return timestampToSeconds(lastTimestamp);
  }
  // Fallback: Estimate duration based on word count (approx. 150 WPM)
  const wordCount = transcript.split(/\s+/).length;
  return Math.ceil((wordCount / 150) * 60) || 300; // Return seconds, with a 5-min default
};

/**
 * Uses Gemini 2.5 Flash to analyze transcript and return Hierarchical JSON with Tables/Callouts.
 * Now accepts audioPart to ensure timestamps are accurate using the source media.
 */
export const analyzeTranscript = async (
  transcript: string,
  audioPart: AudioPart,
  outputLanguage: string = 'English'
): Promise<HierarchicalNoteData> => {
  const ai = getAiClient();
  const durationSecs = getDurationFromTranscript(transcript);
  const durationMins = Math.ceil(durationSecs / 60);
  
  // Scaling
  const minSections = Math.max(2, Math.floor(durationMins / 7));
  const maxSections = Math.min(12, Math.max(minSections + 2, Math.ceil(durationMins / 4)));

  // Schema Definitions
  const notePointSchema = {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING },
      timestamp: { type: Type.STRING },
      type: { type: Type.STRING, enum: ['default', 'callout', 'code'], description: "Use 'callout' for definitions/concepts. Use 'code' for code snippets." },
      nestedPoints: { 
        type: Type.ARRAY, 
        items: {
          type: Type.OBJECT, 
          properties: { text: { type: Type.STRING }, timestamp: { type: Type.STRING }, type: { type: Type.STRING } }
        },
        nullable: true 
      }
    },
    required: ['text', 'timestamp']
  };

  const tableSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      headers: { type: Type.ARRAY, items: { type: Type.STRING } },
      rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
    },
    required: ['headers', 'rows']
  };

  const subsectionSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      points: { type: Type.ARRAY, items: notePointSchema },
      tables: { type: Type.ARRAY, items: tableSchema, nullable: true }
    },
    required: ['title', 'points']
  };

  const sectionSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      subsections: { type: Type.ARRAY, items: subsectionSchema }
    },
    required: ['title', 'subsections']
  };

  const prompt = `
You are a closed-domain summarizer.  
You have access to both the **Audio** and the **Transcript**.
Your goal is to generate structured notes, but you MUST use the AUDIO to verify and generate precise timestamps for every key point.
Do NOT rely solely on the transcript timestamps as they may be inaccurate for long files.
Do NOT introduce facts, definitions, examples, or clarifications that are not explicitly stated.  
Do NOT consult external knowledge.  

**GOAL:** Create a "Cheat Sheet" style document with a highly visual, educational layout.

**VISUAL STRUCTURE INSTRUCTIONS:**
1. **Callouts**: Identify definitions, core concepts, or specific rules. Mark their 'type' as 'callout'.
2. **Tables**: Identify comparisons or lists of operations. Format them as 'tables'.
3. **Code**: Identify any code snippets, algorithms, or syntax. Mark 'type' as 'code'.
4. **Icons**: Use descriptive titles so icons can be assigned.
5. **Key Terms**: Extract a list of important technical terms for highlighting.

**LANGUAGE:** Content in **${outputLanguage}**, keys in English.

**SCALING:**
- Duration: ${durationMins} mins.
- Generate ${minSections}-${maxSections} major sections.

**Output JSON Schema:**
Return a valid JSON object matching the provided schema.
Transcript Reference:
${transcript.slice(0, 10000)}... (truncated text, listen to audio for full context)
`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
            audioPart, // Use the audio part for grounding
            { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            durationMinutes: { type: Type.NUMBER },
            shortSummary: { type: Type.STRING },
            summary: { type: Type.STRING },
            takeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyTerms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of key terms to highlight" },
            sections: { type: Type.ARRAY, items: sectionSchema },
            actionItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  task: { type: Type.STRING },
                  assignee: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                },
                required: ['task', 'assignee', 'priority']
              }
            }
          },
          required: ['title', 'durationMinutes', 'shortSummary', 'summary', 'takeaways', 'keyTerms', 'sections', 'actionItems']
        }
      }
    }));

    const parsedData = JSON.parse(response.text!) as HierarchicalNoteData;
    
    // Ensure duration is set and correct
    parsedData.durationMinutes = durationMins;
    
    // Recursive function to cap timestamps
    const capTimestampsRecursive = (points: NotePoint[], maxSeconds: number) => {
      if (!points) return;
      
      for (const point of points) {
        const pointSeconds = timestampToSeconds(point.timestamp);
        
        if (pointSeconds > maxSeconds) {
          point.timestamp = secondsToTimestamp(maxSeconds);
        }
        
        if (point.nestedPoints) {
          capTimestampsRecursive(point.nestedPoints, maxSeconds);
        }
      }
    };

    // Traverse the data and cap all timestamps
    if (parsedData.sections) {
      for (const section of parsedData.sections) {
        if (section.subsections) {
          for (const subsection of section.subsections) {
            if (subsection.points) {
              capTimestampsRecursive(subsection.points, durationSecs);
            }
          }
        }
      }
    }
    
    return parsedData;

  } catch (error) {
    console.error("Analysis error:", error);
    throw new Error("Failed to analyze transcript.");
  }
};