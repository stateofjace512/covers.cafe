/**
 * CommentList - Displays comments with simplified flat threading
 *
 * Visual hierarchy uses pastel gradient bars instead of indentation:
 * - Parent comment (no gradient)
 * - +/- expand/collapse for each direct child branch
 * - Depth shown via colored left border (pink to orange to yellow to green to blue to lavender, cycling)
 */

import React, { useState, useMemo } from 'react';
import { CirclePlus, CircleMinus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import CommentItem from './CommentItem';
import type { Comment } from './CommentSection';

export interface CommentListProps {
  comments: Comment[];
  onDelete?: (commentId: string) => void;
  onEdit?: (comment: Comment) => void;
  onReplySubmit?: (content: string, parentId?: string | null) => Promise<{ success: boolean; error?: string }>;
  currentUserIdentityHash?: string;
  onTypingActivity?: () => void;
}

// Helper to get all descendants of a comment in order (depth-first)
function getAllDescendants(
  commentId: string,
  repliesByParent: Record<string, Comment[]>,
  depth: number = 0
): Array<{ comment: Comment; depth: number }> {
  const directChildren = repliesByParent[commentId] || [];
  const result: Array<{ comment: Comment; depth: number }> = [];

  for (const child of directChildren) {
    result.push({ comment: child, depth });
    // Recursively get grandchildren, great-grandchildren, etc.
    result.push(...getAllDescendants(child.id, repliesByParent, depth + 1));
  }

  return result;
}

// Helper to get a branch (direct child + all its descendants) with depth info
function getBranchWithDepth(
  directChild: Comment,
  repliesByParent: Record<string, Comment[]>,
  startDepth: number = 1
): Array<{ comment: Comment; depth: number }> {
  const result: Array<{ comment: Comment; depth: number }> = [
    { comment: directChild, depth: startDepth }
  ];
  const descendants = getAllDescendants(directChild.id, repliesByParent, startDepth + 1);
  result.push(...descendants);
  return result;
}

export default function CommentList({
  comments,
  onDelete,
  onEdit,
  onReplySubmit,
  currentUserIdentityHash,
  onTypingActivity,
}: CommentListProps) {
  // Track which branches are collapsed (by direct child ID)
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());

  // Separate top-level comments and build replies map
  const topLevelComments = useMemo(
    () =>
      comments
        .filter((c) => !c.parent_comment_id)
        .slice()
        .sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
    [comments]
  );

  const repliesByParent = useMemo(
    () => {
      const grouped = comments.reduce((acc, comment) => {
        if (comment.parent_comment_id) {
          if (!acc[comment.parent_comment_id]) {
            acc[comment.parent_comment_id] = [];
          }
          acc[comment.parent_comment_id].push(comment);
        }
        return acc;
      }, {} as Record<string, Comment[]>);

      Object.values(grouped).forEach((list) => {
        list.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

      return grouped;
    },
    [comments]
  );

  // Build a map of comment ID to comment for quick lookup (for @mentions)
  const commentsById = useMemo(
    () => comments.reduce((acc, comment) => {
      acc[comment.id] = comment;
      return acc;
    }, {} as Record<string, Comment>),
    [comments]
  );

  const toggleBranch = (branchId: string) => {
    setCollapsedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }
      return next;
    });
  };

  // Animation variants for comments
  const commentVariants = {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.95, x: -20 },
  };

  const branchVariants = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0 },
  };

  return (
    <div className="comment-list space-y-6 mt-8">
      <AnimatePresence mode="popLayout">
        {topLevelComments.map((parentComment) => {
          const directChildren = repliesByParent[parentComment.id] || [];
          const hasChildren = directChildren.length > 0;

          return (
            <motion.div
              key={parentComment.id}
              className="parent-thread"
              variants={commentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              layout
            >
              {/* Parent comment - depth 0 gets first gradient color */}
              <CommentItem
                comment={parentComment}
                onDelete={onDelete}
                onEdit={onEdit}
                onReplySubmit={onReplySubmit}
                currentUserIdentityHash={currentUserIdentityHash}
                commentsById={commentsById}
                depth={0}
                onTypingActivity={onTypingActivity}
              />

              {/* Children section - no indentation, uses gradient colors instead */}
              <AnimatePresence>
                {hasChildren && (
                  <motion.div
                    className="children-section mt-3 space-y-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {directChildren.map((directChild) => {
                      const branchWithDepth = getBranchWithDepth(directChild, repliesByParent, 1);
                      const isCollapsed = collapsedBranches.has(directChild.id);

                      return (
                        <div key={directChild.id} className="branch">
                          {/* +/- toggle button - darker color */}
                          <button
                            onClick={() => toggleBranch(directChild.id)}
                            className="flex items-center gap-1 mb-1 text-neutral-500 hover:text-neutral-700 transition-colors"
                            title={isCollapsed ? "Expand replies" : "Collapse replies"}
                          >
                            {isCollapsed ? (
                              <CirclePlus className="w-4 h-4" strokeWidth={1.25} />
                            ) : (
                              <CircleMinus className="w-4 h-4" strokeWidth={1.25} />
                            )}
                            {isCollapsed && (
                              <span className="text-xs">
                                {branchWithDepth.length} {branchWithDepth.length === 1 ? 'reply' : 'replies'}
                              </span>
                            )}
                          </button>

                          {/* Comments in branch - each has its own depth indicator */}
                          <AnimatePresence mode="popLayout">
                            {!isCollapsed && (
                              <motion.div
                                className="space-y-3"
                                variants={branchVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                              >
                                <AnimatePresence mode="popLayout">
                                  {branchWithDepth.map(({ comment: branchComment, depth }) => {
                                    const parentUsername = branchComment.parent_comment_id
                                      ? commentsById[branchComment.parent_comment_id]?.author_username
                                      : undefined;

                                    return (
                                      <motion.div
                                        key={branchComment.id}
                                        variants={commentVariants}
                                        initial="initial"
                                        animate="animate"
                                        exit="exit"
                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                        layout
                                      >
                                        <CommentItem
                                          comment={branchComment}
                                          onDelete={onDelete}
                                          onEdit={onEdit}
                                          onReplySubmit={onReplySubmit}
                                          currentUserIdentityHash={currentUserIdentityHash}
                                          parentUsername={parentUsername}
                                          commentsById={commentsById}
                                          depth={depth}
                                          onTypingActivity={onTypingActivity}
                                        />
                                      </motion.div>
                                    );
                                  })}
                                </AnimatePresence>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
