import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { useData } from './context'
import { SocialContext, type Comment, type Like } from './social'

/** Me gusta y comentarios de los entrenos, con avisos en tiempo real */
export function SocialProvider({ children }: { children: ReactNode }) {
  const { userId } = useData()
  const [likes, setLikes] = useState<Like[]>([])
  const [comments, setComments] = useState<Comment[]>([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([
      supabase.from('workout_likes').select('*'),
      supabase.from('workout_comments').select('*').order('created_at'),
    ]).then(([l, c]) => {
      if (cancelled) return
      if (!l.error) setLikes(l.data as Like[])
      if (!c.error) setComments(c.data as Comment[])
    })

    const sameLike = (a: Like, b: Partial<Like>) => a.workout_id === b.workout_id && a.user_id === b.user_id
    const channel = supabase
      .channel('social')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_likes' }, (p) => {
        if (p.eventType === 'DELETE') setLikes((list) => list.filter((x) => !sameLike(x, p.old as Partial<Like>)))
        else if (p.eventType === 'INSERT') {
          const row = p.new as Like
          setLikes((list) => [...list.filter((x) => !sameLike(x, row)), row])
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_comments' }, (p) => {
        if (p.eventType === 'DELETE') setComments((list) => list.filter((x) => x.id !== (p.old as Partial<Comment>).id))
        else if (p.eventType === 'INSERT') {
          const row = p.new as Comment
          setComments((list) => [...list.filter((x) => x.id !== row.id), row])
        }
      })
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [userId])

  const toggleLike = useCallback(
    async (workoutId: string) => {
      const mine = likes.some((l) => l.workout_id === workoutId && l.user_id === userId)
      // Se pinta al momento y se deshace si falla
      if (mine) {
        setLikes((list) => list.filter((l) => !(l.workout_id === workoutId && l.user_id === userId)))
        const { error } = await supabase.from('workout_likes').delete().eq('workout_id', workoutId).eq('user_id', userId)
        if (error) {
          setLikes((list) => [...list, { workout_id: workoutId, user_id: userId, created_at: new Date().toISOString() }])
          toast('No se pudo quitar el me gusta')
        }
      } else {
        const row = { workout_id: workoutId, user_id: userId, created_at: new Date().toISOString() }
        setLikes((list) => [...list, row])
        const { error } = await supabase.from('workout_likes').insert({ workout_id: workoutId })
        if (error && error.code !== '23505') {
          setLikes((list) => list.filter((l) => !(l.workout_id === workoutId && l.user_id === userId)))
          toast('No se pudo dar me gusta')
        }
      }
    },
    [likes, userId],
  )

  const addComment = useCallback(async (workoutId: string, body: string) => {
    const text = body.trim()
    if (!text) return false
    const { data, error } = await supabase.from('workout_comments').insert({ workout_id: workoutId, body: text }).select('*').single()
    if (error) {
      toast('No se pudo publicar el comentario')
      return false
    }
    const row = data as Comment
    setComments((list) => [...list.filter((x) => x.id !== row.id), row])
    return true
  }, [])

  const deleteComment = useCallback(async (id: string) => {
    const { error } = await supabase.from('workout_comments').delete().eq('id', id)
    if (error) return toast('No se pudo borrar el comentario')
    setComments((list) => list.filter((x) => x.id !== id))
  }, [])

  const value = useMemo(() => {
    const byWorkoutLikes = new Map<string, Like[]>()
    for (const l of likes) byWorkoutLikes.set(l.workout_id, [...(byWorkoutLikes.get(l.workout_id) ?? []), l])
    const byWorkoutComments = new Map<string, Comment[]>()
    for (const c of comments) byWorkoutComments.set(c.workout_id, [...(byWorkoutComments.get(c.workout_id) ?? []), c])
    for (const list of byWorkoutComments.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at))
    return {
      likesFor: (id: string) => byWorkoutLikes.get(id) ?? [],
      commentsFor: (id: string) => byWorkoutComments.get(id) ?? [],
      toggleLike,
      addComment,
      deleteComment,
    }
  }, [likes, comments, toggleLike, addComment, deleteComment])

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}
