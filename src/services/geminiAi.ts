/**
 * Google AI (Gemini) Service for YouTube Library Analysis
 *
 * Uses Firebase AI Logic, which proxies Gemini calls from Firebase's backend.
 * That keeps the Gemini API key on the server: the client sends only the signed
 * in user's Firebase credentials, so no key is embedded in the bundle and users
 * never configure anything. The one-time owner setup lives in the Firebase
 * console (see GEMINI_AI_SETUP_URL).
 */

import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { firebaseApp, initAppCheck } from './firebaseApp';
import { VideoMetadata, VideoComment } from '../types';

export interface VideoAiAnalysis {
  summary: string;
  keyTakeaways: string[];
  suggestedTags: string[];
  suggestedIndexScore: number;
  scoreRationale: string;
}

export interface CommentInsightsAi {
  overallSentiment: string;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  topQuestions: string[];
  communityThemes: string[];
}

const MODEL_NAME = 'gemini-2.5-flash';

/** Deep link to the Firebase AI Logic page where the owner enables the feature once. */
export const GEMINI_AI_SETUP_URL = `https://console.firebase.google.com/project/${firebaseApp.options.projectId}/ailogic`;

export class GeminiAiService {
  private static getModel(responseMimeType?: string) {
    // Idempotent: main.tsx already calls this at startup; calling again is a
    // no-op that guarantees App Check is registered before the first request.
    initAppCheck();
    const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
    return getGenerativeModel(ai, {
      model: MODEL_NAME,
      ...(responseMimeType ? { generationConfig: { responseMimeType } } : {}),
    });
  }

  /**
   * Firebase returns a generic permission error when AI Logic has not been
   * enabled for the project yet. Turn that into a message that points at the
   * one-time setup instead of a bare "permission denied".
   */
  private static rethrow(err: unknown): never {
    const message = err instanceof Error ? err.message : String(err);
    if (/permission|not been used|not enabled|disabled|unauthorized|api_key|api key/i.test(message)) {
      throw new Error(
        `AI summaries are not enabled for this Firebase project yet. An administrator must enable ` +
          `Firebase AI Logic once at ${GEMINI_AI_SETUP_URL}. (${message})`
      );
    }
    throw err instanceof Error ? err : new Error(message);
  }

  // 1. Analyze video content, generate summary, takeaways & optimal IndexScore
  static async analyzeVideo(video: VideoMetadata): Promise<VideoAiAnalysis> {
    const prompt = `Analyze this YouTube video metadata:
Title: "${video.title}"
Channel: "${video.channelTitle}"
Description: "${video.description.slice(0, 800)}"
Views: ${video.viewCount}, Likes: ${video.likeCount}, Duration: ${video.duration}

Respond in strict JSON with keys:
"summary": 2-sentence executive summary of the video topic,
"keyTakeaways": array of 3 bullet points of what a viewer will learn,
"suggestedTags": array of 4-5 high-value categorization tags,
"suggestedIndexScore": integer from 1 to 100 where 1 is absolute must-watch masterpiece and 100 is low priority,
"scoreRationale": 1-sentence justification for the score based on depth and engagement`;

    try {
      const result = await this.getModel('application/json').generateContent(prompt);
      const text = result.response.text();
      if (!text) {
        throw new Error('Gemini returned an empty response for video analysis.');
      }
      return JSON.parse(text);
    } catch (err) {
      this.rethrow(err);
    }
  }

  // 2. Synthesize comments and viewer sentiment
  static async summarizeComments(videoTitle: string, comments: VideoComment[]): Promise<CommentInsightsAi> {
    if (comments.length === 0) {
      throw new Error('No comments available to analyze.');
    }

    const commentsText = comments.slice(0, 15).map((c) => `- "${c.text}" (likes: ${c.likes})`).join('\n');
    const prompt = `Analyze viewer comments for the video: "${videoTitle}"
Comments:
${commentsText}

Respond in strict JSON with keys:
"overallSentiment": e.g. "Highly Positive (92% satisfaction)",
"sentimentBreakdown": { "positive": number (pct), "neutral": number (pct), "negative": number (pct) },
"topQuestions": array of top 2-3 viewer questions or discussions,
"communityThemes": array of 3 recurring discussion topics`;

    try {
      const result = await this.getModel('application/json').generateContent(prompt);
      const text = result.response.text();
      if (!text) {
        throw new Error('Gemini returned an empty response for comment analysis.');
      }
      return JSON.parse(text);
    } catch (err) {
      this.rethrow(err);
    }
  }

  // 3. Generate concise summary directly from title and description
  static async generateConciseSummary(title: string, description: string): Promise<string> {
    const prompt = `You are an expert video analyzer. Generate a clear, concise, high-value summary of the following YouTube video content based strictly on its title and description.

Video Title: "${title}"
Video Description:
${description.slice(0, 1500)}

Requirements:
- Provide a concise 2 to 3 paragraph summary explaining the core topic, architectural mechanics, and practical takeaways.
- Include 3 bullet points highlighting what a viewer or developer will learn.
- Keep the tone professional, direct, and insightful.`;

    try {
      const result = await this.getModel().generateContent(prompt);
      const text = result.response.text();
      if (!text || text.trim().length === 0) {
        throw new Error('Gemini returned an empty summary.');
      }
      return text.trim();
    } catch (err) {
      this.rethrow(err);
    }
  }
}
