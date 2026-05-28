// src/components/comments/CommentSection.jsx — v2.0 (replies + notifications)
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'

const MAX_WORDS = 100

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function timeAgo(isoString) {
  if (!isoString) return ''
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
    if (diff < 60)     return 'just now'
    if (diff < 3600)   return `${Math.floor(diff/60)}m ago`
    if (diff < 86400)  return `${Math.floor(diff/3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff/86400)}d ago`
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return '' }
}

function getIdToken() {
  try {
    const stored = localStorage.getItem('airdate_session')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed?.IdToken) return parsed.IdToken
    }
  } catch {}
  return null
}

function getUsername(user) {
  const n = user?.name
  if (typeof n === 'string' && n && !n.startsWith('{')) return n
  const e = user?.email
  if (e && e.includes('@')) return e.split('@')[0]
  return 'You'
}

function UserAvatar({ username, size = 'md' }) {
  const initials = (username || 'U').slice(0, 2).toUpperCase()
  const colors = [
    'bg-cyan-500/20 text-cyan-400',
    'bg-purple-500/20 text-purple-400',
    'bg-amber-500/20 text-amber-400',
    'bg-rose-500/20 text-rose-400',
    'bg-green-500/20 text-green-400',
  ]
  const idx = username ? username.charCodeAt(0) % colors.length : 0
  const sz = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-xs'
  return (
    <div className={`${sz} rounded-full flex items-center justify-center flex-shrink-0 font-black ${colors[idx]}`}>
      {initials}
    </div>
  )
}

// ── Inline reply composer ──────────────────────────────────────────────────────
function ReplyComposer({ showId, parentCommentId, onPosted, onCancel, user }) {
  const [text, setText]     = useState('')
  const [error, setError]   = useState('')
  const [posting, setPosting] = useState(false)

  const wordCount = countWords(text)
  const overLimit = wordCount > MAX_WORDS

  async function handlePost() {
    if (!text.trim() || overLimit || posting) return
    setPosting(true)
    setError('')
    const idToken = getIdToken()
    if (!idToken) { setError('Session expired. Please sign in again.'); setPosting(false); return }
    try {
      const res = await fetch(`${API_BASE}/show/${showId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ text: text.trim(), parent_comment_id: parentCommentId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to post reply.'); return }
      setText('')
      onPosted(data.comment)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="mt-3 ml-11 pl-3 border-l-2 border-cyan-500/20">
      <div className="flex gap-2">
        <UserAvatar username={getUsername(user)} size="sm" />
        <div className="flex-1 min-w-0">
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setError('') }}
            placeholder="Write a reply… (100 words max)"
            rows={2}
            autoFocus
            className="w-full bg-slate-900/60 border border-white/10 focus:border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 resize-none outline-none transition-colors"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className={`text-[10px] font-bold ${overLimit ? 'text-red-400' : 'text-slate-600'}`}>
              {wordCount}/{MAX_WORDS}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onCancel}
                className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePost}
                disabled={!text.trim() || overLimit || posting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
              >
                {posting ? <><i className="fa-solid fa-circle-notch fa-spin"/>Posting…</> : 'Reply'}
              </button>
            </div>
          </div>
          {error && <p className="text-red-400 text-[10px] font-bold mt-1">{error}</p>}
        </div>
      </div>
    </div>
  )
}

// ── Reply row ──────────────────────────────────────────────────────────────────
function ReplyCard({ reply }) {
  return (
    <div className="mt-3 ml-11 pl-3 border-l-2 border-white/8 flex gap-2">
      <UserAvatar username={reply.username} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white text-[11px] font-bold">{reply.username || 'Anonymous'}</span>
          <span className="text-slate-600 text-[9px]">·</span>
          <span className="text-slate-500 text-[9px]">{timeAgo(reply.created_at)}</span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">{reply.text}</p>
      </div>
    </div>
  )
}

// ── Top-level comment card ─────────────────────────────────────────────────────
function CommentCard({ comment, showId, isAuthenticated, user, onReplyPosted }) {
  const [showReplyBox, setShowReplyBox] = useState(false)
  const replies = comment.replies || []

  function handleReplyPosted(newReply) {
    onReplyPosted(comment.comment_id, newReply)
    setShowReplyBox(false)
  }

  return (
    <div className="py-4 border-b border-white/5 last:border-0">
      {/* Comment header + body */}
      <div className="flex gap-3">
        <UserAvatar username={comment.username} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white text-xs font-bold">{comment.username || 'Anonymous'}</span>
            <span className="text-slate-600 text-[10px]">·</span>
            <span className="text-slate-500 text-[10px]">{timeAgo(comment.created_at)}</span>
            {replies.length > 0 && (
              <span className="text-slate-600 text-[9px] font-bold uppercase tracking-widest">
                · {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </span>
            )}
          </div>
          <p className="text-slate-300 text-sm leading-relaxed mb-2">{comment.text}</p>

          {/* Reply button */}
          {isAuthenticated && !showReplyBox && (
            <button
              onClick={() => setShowReplyBox(true)}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors"
            >
              <i className="fa-solid fa-reply text-[9px]"/>
              Reply
            </button>
          )}
        </div>
      </div>

      {/* Existing replies */}
      {replies.map(rep => (
        <ReplyCard key={rep.comment_id} reply={rep} />
      ))}

      {/* Inline reply composer */}
      {showReplyBox && (
        <ReplyComposer
          showId={showId}
          parentCommentId={comment.comment_id}
          onPosted={handleReplyPosted}
          onCancel={() => setShowReplyBox(false)}
          user={user}
        />
      )}
    </div>
  )
}

// ── Top-level composer ─────────────────────────────────────────────────────────
function CommentComposer({ showId, onPosted, user }) {
  const [text, setText]     = useState('')
  const [error, setError]   = useState('')
  const [posting, setPosting] = useState(false)
  const [success, setSuccess] = useState(false)

  const wordCount = countWords(text)
  const overLimit = wordCount > MAX_WORDS
  const remaining = MAX_WORDS - wordCount

  async function handlePost() {
    if (!text.trim() || overLimit || posting) return
    setPosting(true)
    setError('')
    const idToken = getIdToken()
    if (!idToken) { setError('Session expired. Please sign in again.'); setPosting(false); return }
    try {
      const res = await fetch(`${API_BASE}/show/${showId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ text: text.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to post comment.'); return }
      setText('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      onPosted({ ...data.comment, replies: [] })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="bg-slate-800/30 border border-white/8 rounded-2xl p-4 mb-6">
      <div className="flex gap-3">
        <UserAvatar username={getUsername(user)} />
        <div className="flex-1 min-w-0">
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setError('') }}
            placeholder="Share your thoughts on this show… (100 words max)"
            rows={3}
            className="w-full bg-slate-900/60 border border-white/10 focus:border-cyan-500/40 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 resize-none outline-none transition-colors"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-[10px] font-bold ${
              overLimit ? 'text-red-400' : remaining <= 20 ? 'text-amber-400' : 'text-slate-500'
            }`}>
              {wordCount}/{MAX_WORDS} words{overLimit ? ' — too long' : ''}
            </span>
            <button
              onClick={handlePost}
              disabled={!text.trim() || overLimit || posting}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
            >
              {posting
                ? <><i className="fa-solid fa-circle-notch fa-spin text-[10px]"/>Posting…</>
                : success
                ? <><i className="fa-solid fa-check text-[10px]"/>Posted!</>
                : 'Post Comment'
              }
            </button>
          </div>
          {error && (
            <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-xs font-bold">{error}</p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/5">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          <i className="fa-solid fa-shield-halved text-cyan-500/60 mr-1"/>
          Keep it civil. No profanity or abusive language. Comments are visible to everyone and expire after 45 days. Max 100 words.
        </p>
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────
export function CommentSection({ showId }) {
  const { isAuthenticated, user } = useAuth()
  const [comments, setComments]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [nextToken, setNextToken]     = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchComments = useCallback(async (token = null, append = false) => {
    try {
      const params = token ? `?next_token=${encodeURIComponent(token)}` : ''
      const res = await fetch(`${API_BASE}/show/${showId}/comments${params}`)
      if (!res.ok) return
      const data = await res.json()
      setComments(prev => append ? [...prev, ...(data.comments || [])] : (data.comments || []))
      setNextToken(data.next_token || null)
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [showId])

  useEffect(() => {
    setLoading(true)
    fetchComments()
  }, [fetchComments])

  function handlePosted(newComment) {
    setComments(prev => [newComment, ...prev])
  }

  function handleReplyPosted(parentId, newReply) {
    setComments(prev => prev.map(c =>
      c.comment_id === parentId
        ? { ...c, replies: [...(c.replies || []), newReply] }
        : c
    ))
  }

  async function loadMore() {
    if (!nextToken || loadingMore) return
    setLoadingMore(true)
    await fetchComments(nextToken, true)
  }

  const totalCount = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-slate-700/50 rounded-lg">
          <i className="fa-solid fa-comments text-slate-300 text-xl"/>
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Community</h2>
        {!loading && (
          <span className="px-2 py-1 bg-slate-800/60 border border-white/10 rounded-lg text-xs font-black text-slate-400">
            {totalCount} comment{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isAuthenticated ? (
        <CommentComposer showId={showId} onPosted={handlePosted} user={user} />
      ) : (
        <div className="bg-slate-800/30 border border-white/8 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-white text-sm font-bold mb-0.5">Join the conversation</p>
            <p className="text-slate-400 text-xs">Sign in to leave a comment. It's free.</p>
          </div>
          <Link to="/auth/login"
            className="flex-shrink-0 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all">
            Sign In
          </Link>
        </div>
      )}

      <div className="bg-slate-800/20 rounded-2xl px-5">
        {loading ? (
          <div className="py-10 flex items-center justify-center gap-3">
            <div className="w-4 h-4 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin"/>
            <span className="text-slate-400 text-sm">Loading comments…</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-10 text-center">
            <i className="fa-solid fa-comment-slash text-slate-700 text-3xl mb-3"/>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">No comments yet</p>
            <p className="text-slate-600 text-xs mt-1">Be the first to share your thoughts</p>
          </div>
        ) : (
          <>
            {comments.map((c) => (
              <CommentCard
                key={c.comment_id}
                comment={c}
                showId={showId}
                isAuthenticated={isAuthenticated}
                user={user}
                onReplyPosted={handleReplyPosted}
              />
            ))}
            {nextToken && (
              <div className="py-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 bg-slate-700/60 hover:bg-slate-700 border border-white/10 rounded-xl text-xs font-black text-slate-300 uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more comments'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}