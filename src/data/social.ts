import { createContext, useContext } from 'react'

export type Like = { workout_id: string; user_id: string; created_at: string }
export type Comment = { id: string; workout_id: string; user_id: string; body: string; created_at: string }

export type SocialState = {
  likesFor: (workoutId: string) => Like[]
  commentsFor: (workoutId: string) => Comment[]
  toggleLike: (workoutId: string) => Promise<void>
  addComment: (workoutId: string, body: string) => Promise<boolean>
  deleteComment: (id: string) => Promise<void>
}

const none: never[] = []
export const SocialContext = createContext<SocialState>({
  likesFor: () => none,
  commentsFor: () => none,
  toggleLike: async () => {},
  addComment: async () => false,
  deleteComment: async () => {},
})

export const useSocial = () => useContext(SocialContext)
