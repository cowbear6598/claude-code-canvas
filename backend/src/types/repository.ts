export interface Repository {
  id: string;
  name: string;
  path: string;
  parentRepoId?: string;
  branchName?: string;
  currentBranch?: string;
}
