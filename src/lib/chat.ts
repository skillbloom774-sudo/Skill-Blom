import { supabase } from './supabase'

export type Reaction = { emoji: string; count: number; mine: boolean }

export type ChatMessage = {
  id: string
  body: string
  created_at: string
  is_anonymous: boolean
  is_question: boolean
  answered: boolean
  pinned: boolean
  mine: boolean
  sender_name: string
  sender_is_teacher: boolean
  reactions: Reaction[]
}

export const REACTIONS = ['👍', '❓', '🙏', '🔥', '✅']

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function fetchThread(threadId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc('thread_messages', { p_thread_id: threadId })
  fail(error)
  return (data as ChatMessage[]) ?? []
}

export async function sendMessage(
  threadId: string,
  body: string,
  opts: { anonymous?: boolean; question?: boolean } = {},
) {
  const { error } = await supabase.rpc('post_chat_message', {
    p_thread_id: threadId,
    p_body: body,
    p_anonymous: opts.anonymous ?? false,
    p_question: opts.question ?? false,
  })
  fail(error)
}

export async function toggleReaction(messageId: string, emoji: string) {
  const { error } = await supabase.rpc('toggle_reaction', { p_message_id: messageId, p_emoji: emoji })
  fail(error)
}

export async function reportMessage(messageId: string, reason: string) {
  const { error } = await supabase.rpc('report_message', { p_message_id: messageId, p_reason: reason })
  fail(error)
}

export async function setMessageFlags(messageId: string, flags: { answered?: boolean; pinned?: boolean }) {
  const { error } = await supabase.rpc('set_message_flags', {
    p_message_id: messageId,
    p_answered: flags.answered ?? null,
    p_pinned: flags.pinned ?? null,
  })
  fail(error)
}