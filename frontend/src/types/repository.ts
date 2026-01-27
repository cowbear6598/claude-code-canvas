import type {BaseNote} from './note'

export interface Repository {
  id: string
  name: string
}

export interface RepositoryNote extends BaseNote {
  repositoryId: string
}
