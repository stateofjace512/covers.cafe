/**
 * CommentForm - Comment submission form with validation
 *
 * Features:
 * - 10,000 character limit
 * - Real-time validation
 * - Emoji support
 * - Auto space cancellation (empty/whitespace-only disabled)
 * - No links allowed
 * - Character counter
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { SendHorizontal, Eye, EyeOff } from 'lucide-react';
import { renderCommentMarkdown } from '../../utils/comments/commentMarkdown';
import { normalizeCommentDisplayName, isOfficialAdmin } from '../../utils/comments/displayName';
import PrecisionMark from './PrecisionMark';

export interface CommentFormProps {
  onSubmit: (content: string, parentId?: string | null) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
  parentId?: string | null;
  parentUsername?: string; // Username to show in reply context
  onTypingActivity?: () => void;
}

export default function CommentForm({
  onSubmit,
  disabled = false,
  parentId = null,
  parentUsername,
  onTypingActivity,
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInlinePreview, setShowInlinePreview] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const maxLength = 10000;
  const remainingChars = maxLength - content.length;
  const trimmedContent = content.trim();
  const isValid = trimmedContent.length > 0 && trimmedContent.length <= maxLength;
  const hasLinks = /https?:\/\//i.test(content) || /www\./i.test(content);
  const canSubmit = isValid && !hasLinks && !isSubmitting && !disabled;
  const previewHtml = useMemo(() => renderCommentMarkdown(content, {}), [content]);

  const resizeTextarea = useCallback(() => {
    if (!textareaRef.current) {
      return;
    }

    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    const newHeight = Math.max(textarea.scrollHeight, 120);
    textarea.style.height = `${newHeight}px`;

    // Sync preview div height
    if (previewRef.current) {
      previewRef.current.style.minHeight = `${newHeight}px`;
    }

    // Scroll to keep cursor visible, accounting for 12px fixed bottom scrollbar
    // Get cursor position by measuring up to selection point
    const cursorPosition = textarea.selectionEnd;
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    const linesBefore = textBeforeCursor.split('\n').length;

    // Calculate approximate cursor Y position within textarea
    // Using line height of ~20px (text-sm with line-height)
    const lineHeight = 20;
    const cursorYInTextarea = linesBefore * lineHeight;

    // Get textarea's position in the viewport
    const textareaRect = textarea.getBoundingClientRect();
    const cursorYInViewport = textareaRect.top + cursorYInTextarea;

    // Account for 12px fixed bottom scrollbar + some padding
    const bottomScrollbarHeight = 12;
    const padding = 20;
    const safeBottomBoundary = window.innerHeight - bottomScrollbarHeight - padding;

    // If cursor would be below the safe area, scroll to bring it into view
    if (cursorYInViewport > safeBottomBoundary) {
      const scrollAmount = cursorYInViewport - safeBottomBoundary + padding;
      window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    }
  }, []);

  // PrecisionMark handlers for formatting selected text
  const handleFormat = useCallback((prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    const newContent =
      content.substring(0, start) +
      prefix +
      selectedText +
      suffix +
      content.substring(end);

    setContent(newContent);

    // Restore focus and selection after the text update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  }, [content]);

  const handleWrapSelection = useCallback((wrapper: (text: string) => string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const wrappedText = wrapper(selectedText);

    const newContent =
      content.substring(0, start) +
      wrappedText +
      content.substring(end);

    setContent(newContent);

    // Restore focus after the text update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + wrappedText.length);
    }, 0);
  }, [content]);

  useEffect(() => {
    resizeTextarea();
  }, [content, resizeTextarea]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      setError('Please enter a valid comment');
      return;
    }

    if (hasLinks) {
      setError('Comments cannot contain links');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await onSubmit(trimmedContent, parentId);

      if (result.success) {
        setSuccess(true);
        setContent('');
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to post comment');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="comment-form mb-8">
      {parentId && parentUsername && (
        <div className="mb-2 text-xs text-neutral-500">
          Replying to{' '}
          {isOfficialAdmin(parentUsername) ? (
            <span className="font-semibold">
              <span
                style={{
                  background: 'linear-gradient(90deg, #7addfb, #5fcffa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                MSTRJK
              </span>
              {' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #5fcffa, #1bacf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                (Official)
              </span>
            </span>
          ) : (
            <span className="font-semibold text-neutral-700">
              {normalizeCommentDisplayName(parentUsername)}
            </span>
          )}
        </div>
      )}
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          {/* PrecisionMark toolbar - appears on text selection */}
          {!showInlinePreview && (
            <PrecisionMark
              textareaRef={textareaRef}
              onFormat={handleFormat}
              onWrapSelection={handleWrapSelection}
            />
          )}
          <div
            className={`skeuo-content-panel skeuo-glass-panel p-5 md:p-8 mb-12 mt-8 transition-shadow ${
              hasLinks ? 'ring-2 ring-red-300' : 'focus-within:ring-2 focus-within:ring-blue-500'
            }`}
          >
            <div className="flex items-end gap-3">
              <div className="relative flex-1 min-h-[120px]">
                {/* Textarea for editing - hidden when preview is on */}
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    onTypingActivity?.();
                  }}
                  onInput={resizeTextarea}
                  placeholder={parentId ? "Write a reply..." : "Write a comment..."}
                  className={`w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none resize-none overflow-hidden appearance-none min-h-[120px] ${
                    showInlinePreview ? 'hidden' : ''
                  }`}
                  maxLength={maxLength}
                  disabled={disabled || isSubmitting}
                />
                {/* Preview mode - shows formatted content */}
                {showInlinePreview && (
                  <div
                    ref={previewRef}
                    className="comment-markdown text-sm text-neutral-900 min-h-[120px] cursor-text"
                    onClick={() => setShowInlinePreview(false)}
                    dangerouslySetInnerHTML={{ __html: previewHtml || '<span class="text-neutral-500">Click to edit...</span>' }}
                  />
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowInlinePreview(!showInlinePreview)}
                  className="skeuo-icon-button-inset"
                  aria-label={showInlinePreview ? "Show raw text" : "Show preview"}
                  title={showInlinePreview ? "Show raw text" : "Show preview"}
                >
                  {showInlinePreview ? <EyeOff className="w-5 h-5" strokeWidth={1.25} /> : <Eye className="w-5 h-5" strokeWidth={1.25} />}
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`skeuo-icon-button-inset ${canSubmit ? '' : 'opacity-50 cursor-not-allowed'}`}
                  aria-label="Send comment"
                >
                  <SendHorizontal className="w-5 h-5" strokeWidth={1.25} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-2 text-sm">
            <div>
              {hasLinks && (
                <span className="text-red-600">Links are not allowed</span>
              )}
            </div>

            <span
              className={`${
                remainingChars < 100 ? 'text-orange-600 font-semibold' : 'text-neutral-500'
              }`}
            >
              {remainingChars.toLocaleString()} characters remaining
            </span>
          </div>
        </div>

      </div>

      {error && (
        <div className="mt-3 skeuo-footer-panel bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

    </form>
  );
}
