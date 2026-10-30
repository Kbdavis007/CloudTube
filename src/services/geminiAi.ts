/**
 * Google AI (Gemini) Service for YouTube Library Analysis
 * Integrates Google GenAI SDK to generate video summaries, evaluate IndexScores,
 * synthesize comment insights, and provide intelligent content recommendations.
 */

import { GoogleGenAI } from '@google/genai';
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

export class GeminiAiService {
  private static getClient(): GoogleGenAI | null {
    // Check if GEMINI_API_KEY is available in environment
    const apiKey =
      (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY);

    if (apiKey) {
      return new GoogleGenAI({ apiKey });
    }
    return null;
  }

  // 1. Analyze video content, generate summary, takeaways & optimal IndexScore
  static async analyzeVideo(video: VideoMetadata): Promise<VideoAiAnalysis> {
    const ai = this.getClient();

    if (!ai) {
      throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY to enable AI analysis.');
    }

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty response for video analysis.');
    }
    return JSON.parse(text);
  }

  // 2. Synthesize comments and viewer sentiment
  static async summarizeComments(videoTitle: string, comments: VideoComment[]): Promise<CommentInsightsAi> {
    const ai = this.getClient();

    if (!ai) {
      throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY to enable comment analysis.');
    }
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty response for comment analysis.');
    }
    return JSON.parse(text);
  }

  // 3. Generate concise summary directly from title and description
  static async generateConciseSummary(title: string, description: string): Promise<string> {
    const ai = this.getClient();

    if (!ai) {
      throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY to generate AI summaries.');
    }

    const prompt = `You are an expert video analyzer. Generate a clear, concise, high-value summary of the following YouTube video content based strictly on its title and description.

Video Title: "${title}"
Video Description:
${description.slice(0, 1500)}

Requirements:
- Provide a concise 2 to 3 paragraph summary explaining the core topic, architectural mechanics, and practical takeaways.
- Include 3 bullet points highlighting what a viewer or developer will learn.
- Keep the tone professional, direct, and insightful.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text;
    if (!text || text.trim().length === 0) {
      throw new Error('Gemini returned an empty summary.');
    }
    return text.trim();
  }
}
