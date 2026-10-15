import { useState } from 'react'
import { useData } from '../data/context'
import { useSocial } from '../data/social'
import { fmtWhen, type Workout } from '../lib/workouts'
import { Avatar } from '../pages/RoutineDetail'
import { Icon } from './Icon'
import { Sheet } from './ui'
import './WorkoutSocial.css'

const firstName = (s?: string | null) => (s || '').split(' ')[0] || 'Alguien'

/** Me gusta + comentarios bajo un entreno (tarjeta y detalle) */
export function WorkoutSocial({ workout, preview = 2 }: { workout: Workout; preview?: number }) {
  const { userId, profiles } = useData()
  const { likesFor, commentsFor, toggleLike } = useSocial()
  const [open, setOpen] = useState(false)
  const likes = likesFor(workout.id)
  const comments = commentsFor(workout.id)
  const liked = likes.some((l) => l.user_id === userId)
  const name = (id: string) => profiles.find((p) => p.id === id)?.full_name

  const others = likes.filter((l) => l.user_id !== userId)
  const likesText = !likes.length
    ? ''
    : liked && !others.length
      ? 'Te gusta a ti'
      : liked
        ? `A ti y a ${others.length === 1 ? firstName(name(others[0].user_id)) : `${others.length} más`} os gusta`
        : likes.length === 1
          ? `A ${firstName(name(likes[0].user_id))} le gusta`
          : `${likes.length} me gusta`

  return (
    <div className="ws">
      <div className="ws-actions">
        <button className={`ws-btn ${liked ? 'liked' : ''}`} aria-pressed={liked} aria-label={liked ? 'Quitar me gusta' : 'Me gusta'} onClick={() => toggleLike(workout.id)}>
          <Icon name="heart" size={24} filled={liked} />
          {likes.length > 0 && <span className="tnum">{likes.length}</span>}
        </button>
        <button className="ws-btn" aria-label="Comentar" onClick={() => setOpen(true)}>
          <Icon name="comment" size={23} />
          {comments.length > 0 && <span className="tnum">{comments.length}</span>}
        </button>
      </div>
      {likesText && <p className="ws-likes">{likesText}</p>}
      {comments.length > 0 && (
        <button className="ws-preview" onClick={() => setOpen(true)}>
          {comments.length > preview && <span className="ws-all">Ver los {comments.length} comentarios</span>}
          {comments.slice(-preview).map((c) => (
            <span key={c.id} className="ws-line">
              <b>{firstName(name(c.user_id))}</b> {c.body}
            </span>
          ))}
        </button>
      )}
      {open && <CommentsSheet workout={workout} onClose={() => setOpen(false)} />}
    </div>
  )
}

function CommentsSheet({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const { userId, profiles } = useData()
  const { commentsFor, addComment, deleteComment } = useSocial()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const comments = commentsFor(workout.id)
  const me = profiles.find((p) => p.id === userId)

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    const ok = await addComment(workout.id, text)
    setSending(false)
    if (ok) setText('')
  }

  return (
    <Sheet open onClose={onClose} title="Comentarios">
      <div className="ws-sheet">
        {comments.length ? (
          <ul className="ws-list">
            {comments.map((c) => {
              const p = profiles.find((x) => x.id === c.user_id)
              const canDelete = c.user_id === userId || workout.user_id === userId
              return (
                <li key={c.id}>
                  <Avatar url={p?.avatar_url} name={p?.full_name} size={34} />
                  <div className="ws-comment">
                    <span>
                      <b>{p?.full_name || 'Usuario'}</b> <small>{fmtWhen(c.created_at)}</small>
                    </span>
                    <p>{c.body}</p>
                  </div>
                  {canDelete && (
                    <button className="ws-del" aria-label="Borrar comentario" onClick={() => deleteComment(c.id)}>
                      <Icon name="trash" size={18} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="ws-empty">Sé el primero en comentar.</p>
        )}
        <form
          className="ws-form"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <Avatar url={me?.avatar_url} name={me?.full_name} size={34} />
          <input value={text} maxLength={500} placeholder="Escribe un comentario…" onChange={(e) => setText(e.target.value)} enterKeyHint="send" />
          <button type="submit" className="ws-send" disabled={!text.trim() || sending} aria-label="Publicar comentario">
            <Icon name="send" size={20} />
          </button>
        </form>
      </div>
    </Sheet>
  )
}
