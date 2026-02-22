/**
 * DISABLED: AI comment auto checks have been removed from the system.
 * This file contains the old AI moderation implementation and is kept for historical reference.
 * All calls to these functions have been removed.
 */

import { getEnvString } from '../env.server.js';

const OPENAI_API_KEY = getEnvString('OPENAI_API_KEY');
const OPENAI_MODERATION_MODEL = 'omni-moderation-latest';

/**
 * Real-time moderation check using OpenAI's moderation API
 * Runs synchronously on comment submission
 */
export async function checkRealtimeModeration(content: string) {
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured, skipping real-time moderation');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODERATION_MODEL,
        input: content,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Moderation API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const result = data.results?.[0];

    return {
      flagged: result?.flagged || false,
      categories: result?.category_scores || {},
      categoryApplied: result?.category_applied || {},
      raw: result,
    };
  } catch (error) {
    console.error('Real-time moderation check failed:', error);
    return null;
  }
}

/**
 * Queue comment for batch review
 * Called after comment insertion
 */
export async function queueForBatchReview(
  supabase: any,
  commentId: string,
  moderationResult: any
) {
  try {
    const { data, error } = await supabase
      .from('comment_moderation_queue')
      .insert({
        comment_id: commentId,
        openai_moderation_result: moderationResult?.raw || null,
        openai_flagged: moderationResult?.flagged || false,
        openai_categories: moderationResult?.categories || {},
      });

    if (error) {
      console.error('Failed to queue comment for batch review:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Queue for batch review error:', error);
    return null;
  }
}

/**
 * Hourly batch moderation job
 * Reviews all comments from the past 60 minutes using GPT-4o-mini
 * Should be triggered by a scheduled job (e.g., Netlify Functions, cron)
 */
export async function runBatchModerationJob(supabase: any, batchNumber: number) {
  if (!OPENAI_API_KEY) {
    console.error('OpenAI API key not configured, cannot run batch moderation');
    throw new Error('OpenAI API key not configured');
  }

  try {
    // Check if this batch number already exists (prevents duplicate processing from multiple instances)
    const { data: existingJob, error: checkError } = await supabase
      .from('moderation_batch_jobs')
      .select('id, status')
      .eq('batch_number', batchNumber)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows found (which is expected)
      console.error('Error checking batch job:', checkError);
      throw checkError;
    }

    // If batch already exists, skip processing (another instance is handling it)
    if (existingJob) {
      console.log(`[Batch Moderation] Batch ${batchNumber} already exists with status: ${existingJob.status}. Skipping.`);
      return { processed: 0, retained: 0, removed: 0, failed: 0, skipped: true };
    }

    // Create batch job record
    const { data: jobData, error: jobError } = await supabase
      .from('moderation_batch_jobs')
      .insert({
        batch_number: batchNumber,
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select()
      .single();

    if (jobError) {
      console.error('Failed to create batch job:', jobError);
      // If duplicate key error, another instance created it - just continue
      if (jobError.code === '23505') {
        console.log(`[Batch Moderation] Batch ${batchNumber} already created by another instance. Skipping.`);
        return { processed: 0, retained: 0, removed: 0, failed: 0, skipped: true };
      }
      throw jobError;
    }

    // Get all comments from past 60 minutes pending review
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: pendingComments, error: fetchError } = await supabase
      .from('comment_moderation_queue')
      .select(`
        id,
        comment_id,
        comments:comment_id (
          id,
          content,
          content_normalized,
          page_type,
          page_slug,
          parent_comment_id,
          session_id,
          local_storage_id,
          user_agent_hash,
          author_username,
          created_at,
          updated_at,
          edited_at,
          identity_hash
        )
      `)
      .is('processed_at', null)
      .lte('enqueued_at', oneHourAgo)
      .lt('retry_count', 3);

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingComments || pendingComments.length === 0) {
      // No comments to review, mark job as completed
      await supabase
        .from('moderation_batch_jobs')
        .update({
          completed_at: new Date().toISOString(),
          status: 'completed',
          total_comments_reviewed: 0,
        })
        .eq('id', jobData.id);

      return { processed: 0, retained: 0, removed: 0, failed: 0 };
    }

    // Prepare past comments context (limited to 250 chars each)
    const pastCommentsContext = pendingComments
      .map((row: any) => {
        const comment = row.comments;
        const truncated = comment.content.substring(0, 250);
        return `- "${truncated}${comment.content.length > 250 ? '..." (truncated)' : '"'}`;
      })
      .join('\n');

    let retained = 0;
    let removed = 0;
    let failed = 0;

    // Process each comment
    for (const row of pendingComments) {
      try {
        const comment = row.comments;
        const queueId = row.id;

        // Get sync filter flags (abuse score from the comment)
        const flags = {
          submitted_at: comment.created_at,
        };

        const moderationPrompt = `You are a content moderation classifier for a public website.

REMOVE if ANY are true:
1. URLs, domains, IPs, paths, links (direct or obfuscated, spaced, unicode, emoji)
2. Encoded/transformed content (base64, hex, rot, cipher, fragments)
3. Sexual content involving minors (any form)
4. Operational detail or step-by-step instructions
5. Evasion attempts or filter bypassing
6. Suspicious unclear content that could function as a method/pointer
7. Non-expressive spam (gibberish, repetitive entropy)

ALLOW if ALL true:
- Plain text only
- No links, encoded data, or operational detail
- Clearly framed as discussion/critique/policy/prevention
- No behavioral escalation patterns
- No sexual content involving minors

Platform allows DISCUSSION ABOUT harmful topics, NOT participation in them.
Assume adversarial intent. "How to" content always REMOVE.

Analyze ALL comment patterns together:
Comments (past 60 min, max 250 chars each):
${pastCommentsContext}

Sync filter results: ${JSON.stringify(flags)}

Comment to evaluate (max 250 chars): "${comment.content.substring(0, 250)}${comment.content.length > 250 ? '..." (truncated)' : '"'}"

Output ONLY: {"decision": "RETAIN"|"REMOVE", "reason": "link"|"encoded_content"|"sexual_content_minor"|"facilitation"|"behavioral_risk"|"external_reference"|"unclear_but_suspicious"|"spam"}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: moderationPrompt,
              },
            ],
            max_tokens: 50,
            temperature: 0,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('GPT moderation API error:', response.status, errorText);
          failed++;

          // Increment retry count
          await supabase
            .from('comment_moderation_queue')
            .update({
              retry_count: row.retry_count + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', queueId);

          continue;
        }

        const data = await response.json();
        let decision = null;
        let reason = null;

        try {
          const content = data.choices?.[0]?.message?.content || '';
          const parsed = JSON.parse(content);
          decision = parsed.decision;
          reason = parsed.reason;
        } catch {
          console.error('Failed to parse GPT moderation response:', data.choices?.[0]?.message?.content);
          failed++;
          continue;
        }

        // Update queue with decision
        const { error: updateError } = await supabase
          .from('comment_moderation_queue')
          .update({
            gpt_decision: decision,
            gpt_reason: reason,
            gpt_reviewed_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            batch_number: batchNumber,
          })
          .eq('id', queueId);

        if (updateError) {
          console.error('Failed to update queue record:', updateError);
          failed++;
          continue;
        }

        // Enforce decision
        if (decision === 'REMOVE') {
          // Shadow ban the identity
          await supabase
            .from('comment_identities')
            .update({
              is_shadow_banned: true,
              shadow_ban_reason: `Batch moderation: ${reason}`,
              shadow_banned_at: new Date().toISOString(),
            })
            .eq('identity_hash', comment.identity_hash);

          await supabase.from('comments_admin_archives').insert({
            comment_id: comment.id,
            page_type: comment.page_type,
            page_slug: comment.page_slug,
            content: comment.content,
            content_normalized: comment.content_normalized,
            parent_comment_id: comment.parent_comment_id,
            identity_hash: comment.identity_hash,
            session_id: comment.session_id,
            local_storage_id: comment.local_storage_id,
            user_agent_hash: comment.user_agent_hash,
            author_username: comment.author_username,
            action_type: 'auto_removed',
            is_deleted: true,
            is_auto_removed: true,
            archived_reason: reason,
            archived_at: new Date().toISOString(),
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            edited_at: comment.edited_at,
          });

          // Mark comment as admin removed
          await supabase
            .from('comments')
            .update({
              is_admin_removed: true,
            })
            .eq('id', comment.id);

          removed++;
        } else {
          retained++;
        }
      } catch (error) {
        console.error('Error processing comment in batch:', error);
        failed++;
      }
    }

    // Update batch job with results
    const { error: finalError } = await supabase
      .from('moderation_batch_jobs')
      .update({
        completed_at: new Date().toISOString(),
        status: 'completed',
        total_comments_reviewed: pendingComments.length,
        comments_retained: retained,
        comments_removed: removed,
        comments_failed: failed,
      })
      .eq('id', jobData.id);

    if (finalError) {
      console.error('Failed to finalize batch job:', finalError);
    }

    return { processed: pendingComments.length, retained, removed, failed };
  } catch (error) {
    console.error('Batch moderation job failed:', error);

    // Mark batch job as failed
    try {
      await supabase
        .from('moderation_batch_jobs')
        .update({
          completed_at: new Date().toISOString(),
          status: 'failed',
          error_message: String(error),
        })
        .eq('batch_number', batchNumber);
    } catch (updateError) {
      console.error('Failed to mark batch job as failed:', updateError);
    }

    throw error;
  }
}
