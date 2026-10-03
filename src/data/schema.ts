import { z } from 'zod'
export const TrackSchema = z.object({ title: z.string().min(1), src: z.string().min(1) })
export const AlbumSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  artist: z.string().default(''),
  textures: z.object({ front: z.string(), back: z.string(), disk: z.string(), inside: z.string() }),
  tracks: z.array(TrackSchema).min(1),
})
export const CatalogSchema = z.array(AlbumSchema)
export type Track = z.infer<typeof TrackSchema>
export type Album = z.infer<typeof AlbumSchema>
