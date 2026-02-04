import type {BaseNote} from './note'

export interface Repository {
  id: string
  name: string
  isGit?: boolean
  parentRepoId?: string
  branchName?: string
  currentBranch?: string
}

export interface RepositoryNote extends BaseNote {
  repositoryId: string
}
