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
            className="w-full bg-slate-900/60 border border-white/10 focus:border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-200 resize-none outline-none transition-colors"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className={`text-[10px] font-bold ${overLimit ? 'text-red-400' : 'text-slate-600'}`}>
              {wordCount}/{MAX_WORDS}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onCancel}
                className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-200 hover:text-slate-200 transition-colors"
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
          <span className="text-slate-200 text-[9px]">{timeAgo(reply.created_at)}</span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">{reply.text}</p>
      </div>
    </div>
  )
}

// ── Top-level comment card ─────────────────────────────────────────────────────
function CommentCard({ comment, showId, isAuthenticated, user, token, idToken, onReplyPosted, onDelete }) {
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const replies = comment.replies || []
  const isOwner = (user?.sub && user.sub === comment.user_sub) || (user?.name && getUsername(user) === comment.username)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE}/show/${showId}/comments/_?show_id=${showId}&comment_id=${encodeURIComponent(comment.comment_id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getIdToken()}` }
      })
      if (res.ok) onDelete(comment.comment_id)
    } catch (e) { console.error(e) }
    setDeleting(false)
  }

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
            <span className="text-slate-200 text-[10px]">{timeAgo(comment.created_at)}</span>
            {replies.length > 0 && (
              <span className="text-slate-600 text-[9px] font-bold uppercase tracking-widest">
                · {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </span>
            )}
          </div>
          <p className="text-slate-300 text-sm leading-relaxed mb-2">{comment.text}</p>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {isAuthenticated && !showReplyBox && (
              <button
                onClick={() => setShowReplyBox(true)}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-200 hover:text-cyan-400 transition-colors"
              >
                <i className="fa-solid fa-reply text-[9px]"/>
                Reply
              </button>
            )}
            {isOwner && (
              <>
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  <i className="fa-solid fa-trash text-[9px]"/>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
                {confirmDelete && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
                    onClick={e => e.target === e.currentTarget && setConfirmDelete(false)}>
                    <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                      <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <i className="fa-solid fa-trash text-red-400"/>
                      </div>
                      <h3 className="text-white font-black text-center text-base mb-2">Delete Comment?</h3>
                      <p className="text-slate-200 text-xs text-center mb-5 leading-relaxed">This comment will be permanently removed and cannot be restored.</p>
                      <div className="flex gap-3">
                        <button onClick={() => setConfirmDelete(false)}
                          className="flex-1 h-10 bg-slate-800 border border-white/10 rounded-xl text-slate-200 text-xs font-bold uppercase tracking-widest hover:border-white/30 transition-all">
                          Cancel
                        </button>
                        <button onClick={() => { setConfirmDelete(false); handleDelete() }}
                          className="flex-1 h-10 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/30 transition-all">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
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
            className="w-full bg-slate-900/60 border border-white/10 focus:border-cyan-500/40 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-200 resize-none outline-none transition-colors"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-[10px] font-bold ${
              overLimit ? 'text-red-400' : remaining <= 20 ? 'text-amber-400' : 'text-slate-200'
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
        <p className="text-[10px] text-slate-200 leading-relaxed">
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextToken, setNextToken]     = useState(null)

  const fetchComments = useCallback(async (token = null, append = false) => {
    try {
      const url = token
        ? `${API_BASE}/show/${showId}/comments?next_token=${encodeURIComponent(token)}`
        : `${API_BASE}/show/${showId}/comments`
      const data = await (await fetch(url)).json()
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

  function handleDeleteComment(commentId) {
    setComments(prev => prev.filter(c => c.comment_id !== commentId))
  }

  async function loadMore() {
    if (!nextToken || loadingMore) return
    setLoadingMore(true)
    await fetchComments(nextToken, true)
    setLoadingMore(false)
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-6">
        <i className="fa-solid fa-comments text-cyan-400 text-xl"/>
        <h2 className="text-white font-black uppercase tracking-widest text-sm">Community</h2>
        {comments.length > 0 && (
          <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <CommentComposer showId={showId} isAuthenticated={isAuthenticated} user={user} onPosted={handlePosted} />

      {loading ? (
        <div className="py-8 text-center text-slate-500 text-sm">Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-sm">No comments yet. Be the first!</div>
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
              onDelete={handleDeleteComment}
            />
          ))}
          {nextToken && (
            <div className="py-4 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more comments'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
