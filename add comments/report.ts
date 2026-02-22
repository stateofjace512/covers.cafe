/**
 * Comment Reporting API
 * POST /api/public/comments/report
 *
 * Allows users to report inappropriate comments
 */

import type { APIRoute } from 'astro';
import { getSupabaseAdminClientFromContext } from '../../../../utils/core/supabaseClient.js';
import { computeIdentity } from '../../../../utils/comments/identityTracking.server';
import { createRateLimiter } from '../../../../utils/rateLimit.server.js';

const commentReportLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, maxRequests: 10 });

export const POST: APIRoute = async ({ request }) => {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    if (!commentReportLimiter.check(clientIp)) {
      return new Response(
        JSON.stringify({ error: 'Too many reports submitted. Please wait before trying again.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const {
      commentId,
      reason,
      details,
      sessionId,
      localStorageId,
    } = body;

    if (!commentId || !reason) {
      return new Response(
        JSON.stringify({ error: 'commentId and reason are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate reason
    const validReasons = ['spam', 'harassment', 'hate_speech', 'inappropriate', 'other'];
    if (!validReasons.includes(reason)) {
      return new Response(
        JSON.stringify({ error: 'Invalid reason' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const identity = computeIdentity(request, sessionId, localStorageId);
    const supabase = getSupabaseAdminClientFromContext({ request });

    // Check if comment exists
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id')
      .eq('id', commentId)
      .single();

    if (commentError || !comment) {
      return new Response(
        JSON.stringify({ error: 'Comment not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insert report (duplicate check handled by unique constraint)
    const { error: insertError } = await supabase
      .from('comment_reports')
      .insert({
        comment_id: commentId,
        reporter_identity_hash: identity.identityHash,
        reason,
        details: details || null,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        // Unique constraint violation - already reported
        return new Response(
          JSON.stringify({ error: 'You have already reported this comment' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.error('Error inserting report:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit report' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Report submitted successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in POST /api/public/comments/report:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
