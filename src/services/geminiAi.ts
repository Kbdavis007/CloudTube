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

/**
 * Current stable Gemini Flash model for Firebase AI Logic. Gemini 2.5 models are
 * now limited to projects that used them before the cutoff, so a project that
 * never called them gets a 404 "no longer available to new users" from
 * `generateContent`. Gemini 3.8 Flash is the current stable Flash and, on the
 * Gemini Developer API, needs no pay-as-you-go billing plan.
 * Supported names: https://firebase.google.com/docs/ai-logic/models
 */
const DEFAULT_MODEL_NAME = 'gemini-3.8-flash';

/**
 * Google retires Gemini models on a schedule, so the name is overridable at
 * build time (`VITE_GEMINI_MODEL`) instead of requiring an edit here. Firebase
 * makes the same recommendation for Remote Config: a model swap should not need
 * a code change.
 */
export const GEMINI_MODEL_NAME =
  (import.meta.env?.VITE_GEMINI_MODEL as string | undefined)?.trim() || DEFAULT_MODEL_NAME;

/** Deep link to the Firebase AI Logic page where the owner enables the feature once. */
export const GEMINI_AI_SETUP_URL = `https://console.firebase.google.com/project/${firebaseApp.options.projectId}/ailogic`;

/** Public docs page listing the model names AI Logic currently supports. */
export const GEMINI_MODELS_URL = 'https://firebase.google.com/docs/ai-logic/models';

/**
 * How long to wait for a Gemini response before giving up.
 *
 * The SDK's own default is 180s. That is far too long for an interactive button:
 * when a request cannot complete (App Check rejected the attestation, the network
 * is blocked, AI Logic is not enabled) the call simply stays pending, so the UI
 * spins with no error for three minutes. Fail in a minute instead, with a message
 * that names the likely cause.
 */
const DEFAULT_TIMEOUT_MS = 60_000;

const readTimeoutMs = (): number => {
  const raw = Number(import.meta.env?.VITE_GEMINI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
};

export const GEMINI_TIMEOUT_MS = readTimeoutMs();

export class GeminiAiService {
  private static getModel(responseMimeType?: string) {
    // Idempotent: main.tsx already calls this at startup; calling again is a
    // no-op that guarantees App Check is registered before the first request.
    initAppCheck();
    const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
    return getGenerativeModel(
      ai,
      {
        model: GEMINI_MODEL_NAME,
        ...(responseMimeType ? { generationConfig: { responseMimeType } } : {}),
      },
      // Caps how long a stuck request can leave the UI spinning (SDK default: 180s).
      { timeout: GEMINI_TIMEOUT_MS }
    );
  }

  /**
   * Firebase returns a generic error for the two failures users actually hit:
   * a retired model name (404) and AI Logic not being enabled for the project
   * (permission denied). Rewrite both into a message that names the fix, instead
   * of exposing the raw firebasevertexai.googleapis.com URL.
   */
  private static rethrow(err: unknown): never {
    const message = err instanceof Error ? err.message : String(err);
    // The request hit our timeout, or was aborted. Without this the UI just spins:
    // a pending request produces no error of its own. App Check is the usual cause,
    // since AI Logic rejects any call whose attestation token is missing.
    if (/abort|timed? ?out|timeout|deadline|network ?request ?failed/i.test(message)) {
      throw new Error(
        `The AI request did not complete within ${Math.round(GEMINI_TIMEOUT_MS / 1000)}s. ` +
          `If App Check is enforced, this browser's domain must be registered on the reCAPTCHA ` +
          `Enterprise key and the app's App Check provider, otherwise every Gemini call is ` +
          `rejected. Check the browser console for an App Check error, confirm AI Logic is ` +
          `enabled at ${GEMINI_AI_SETUP_URL}, then retry. (${message})`
      );
    }
    // A retired model name returns 404 with "no longer available to new users".
    // Say which model this build asked for and how to change it, instead of
    // showing the raw firebasevertexai.googleapis.com URL.
    if (/no longer available|not found|deprecated|retired|404/i.test(message)) {
      throw new Error(
        `The AI model "${GEMINI_MODEL_NAME}" is not available to this Firebase project. ` +
          `Google retires Gemini models over time; set the VITE_GEMINI_MODEL build variable to a ` +
          `model that is currently supported at ${GEMINI_MODELS_URL}. (${message})`
      );
    }
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
