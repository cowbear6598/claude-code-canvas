import type { GitPlatform, GitUrlParseResult } from '@/types/repository'

/**
 * URL 長度上限（防止 ReDoS 攻擊）
 */
const MAX_URL_LENGTH = 500

export function detectGitPlatform(url: string): GitPlatform {
  const lowerUrl = url.toLowerCase()

  if (lowerUrl.includes('github.com')) {
    return 'github'
  }

  if (lowerUrl.includes('gitlab.com')) {
    return 'gitlab'
  }

  return 'other'
}

export function parseGitUrl(url: string): GitUrlParseResult {
  const trimmedUrl = url.trim()
  const platform = detectGitPlatform(trimmedUrl)

  let owner: string | null = null
  let repoName: string | null = null
  let isValid = false

  // 檢查 URL 長度，防止 ReDoS 攻擊
  if (!trimmedUrl || trimmedUrl.length > MAX_URL_LENGTH) {
    return { platform, owner, repoName, isValid }
  }

  if (trimmedUrl.startsWith('https://')) {
    const httpsPattern = /^https:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/
    const match = trimmedUrl.match(httpsPattern)

    if (match) {
      owner = match[2]
      repoName = match[3]
      isValid = true
    }
  } else if (trimmedUrl.startsWith('git@')) {
    const sshPattern = /^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/
    const match = trimmedUrl.match(sshPattern)

    if (match) {
      owner = match[2]
      repoName = match[3]
      isValid = true
    }
  }

  return { platform, owner, repoName, isValid }
}

export function getPlatformDisplayName(platform: GitPlatform): string {
  switch (platform) {
    case 'github':
      return 'GitHub'
    case 'gitlab':
      return 'GitLab'
    case 'other':
      return 'Git'
  }
}
