import raw from './albums.json'
import { CatalogSchema, type Album } from './schema'

// La UI parla solo con questa interfaccia: domani basta una SupabaseRepository.
export interface AlbumRepository {
  list(): Promise<Album[]>
  getById(id: string): Promise<Album | undefined>
}

export class JsonRepository implements AlbumRepository {
  private cache: Album[] | null = null
  private load(): Album[] {
    return (this.cache ??= CatalogSchema.parse(raw)) // errore chiaro se il JSON è sbagliato
  }
  async list() { return this.load() }
  async getById(id: string) { return this.load().find((a) => a.id === id) }
}

export const repository: AlbumRepository = new JsonRepository()
