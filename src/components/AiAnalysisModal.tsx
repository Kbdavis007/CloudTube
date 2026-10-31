import React, { useState } from 'react';
import { VideoMetadata, PersonalMetadata } from '../types';
import { GeminiAiService, VideoAiAnalysis } from '../services/geminiAi';
import { ApiErrorCard } from './ApiErrorCard';
import { MarkdownSummary } from './MarkdownSummary';
import {
  Sparkles,
  CheckCircle2,
  X,
  Star,
  Tag,
  Loader2,
  Check,
  Brain,
} from 'lucide-react';

interface AiAnalysisModalProps {
  video: VideoMetadata;
  onClose: () => void;
  onApplyPersonal: (personal: Partial<PersonalMetadata>) => Promise<void>;
}

export const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
  video,
  onClose,
  onApplyPersonal,
}) => {
  const [analysis, setAnalysis] = useState<VideoAiAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAiAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await GeminiAiService.analyzeVideo(video);
      setAnalysis(result);
    } catch (err) {
      console.error('AI analysis failed:', err);
      // Without this the modal sat on the spinner forever: the failure was logged
      // to the console only, so the user saw a hang rather than an error.
      setError(err instanceof Error ? err.message : 'AI analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  React.useEffect(() => {
    runAiAnalysis();
  }, [video.youtubeId]);

  const handleApplyToLibrary = async () => {
    if (!analysis) return;
    const existingTags = video.personal?.userTags || [];
    const mergedTags = Array.from(new Set([...existingTags, ...analysis.suggestedTags]));

    await onApplyPersonal({
      indexScore: analysis.suggestedIndexScore,
      userTags: mergedTags,
      userNotes: (video.personal?.userNotes ? video.personal.userNotes + '\n\n' : '') +
        `[Google AI Summary]: ${analysis.summary}`,
    });

    setIsApplied(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl animate-fadeIn">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-orange-500/20 text-orange-400">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Google AI (Gemini) Video Analysis</h3>
              <p className="text-[11px] text-slate-400 truncate max-w-sm">{video.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isAnalyzing ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-white">Synthesizing metadata with Google AI...</p>
            <p className="text-xs text-slate-400">Evaluating engagement metrics & extracting core takeaways</p>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <ApiErrorCard message={error} title="Google AI request failed" />
            <button
              onClick={runAiAnalysis}
              className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition active:scale-95"
            >
              Retry Analysis
            </button>
          </div>
        ) : analysis ? (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Executive Summary */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Executive Summary
              </div>
              <MarkdownSummary
                markdown={analysis.summary}
                className="text-xs text-slate-300 leading-relaxed"
              />
            </div>

            {/* Key Takeaways */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-200">Key Viewer Takeaways:</div>
              <ul className="space-y-1.5">
                {analysis.keyTakeaways.map((point, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Evaluated IndexScore */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  Recommended IndexScore (1=Best, 100=Worst)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{analysis.scoreRationale}</div>
              </div>
              <div className="text-2xl font-extrabold text-orange-400 font-mono shrink-0 px-3 py-1 rounded-xl bg-orange-500/20 border border-orange-500/30">
                {analysis.suggestedIndexScore}
              </div>
            </div>

            {/* Suggested Tags */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-orange-400" />
                Suggested Personal Tags:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.suggestedTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={handleApplyToLibrary}
                disabled={isApplied}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-sm active:scale-95"
              >
                {isApplied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" /> Applied to Personal Metadata!
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Apply Score & Tags to Video
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
