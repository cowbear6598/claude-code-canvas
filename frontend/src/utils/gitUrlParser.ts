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

function defaultResult(platform: GitPlatform): GitUrlParseResult {
  return { platform, owner: null, repoName: null, isValid: false }
}

function parseHttpsUrl(url: string, platform: GitPlatform): GitUrlParseResult {
  const httpsPattern = /^https:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/
  const match = url.match(httpsPattern)

  if (!match) return defaultResult(platform)

  return {
    platform,
    owner: match[2] ?? null,
    repoName: match[3] ?? null,
    isValid: true,
  }
}

function parseSshUrl(url: string, platform: GitPlatform): GitUrlParseResult {
  const sshPattern = /^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/
  const match = url.match(sshPattern)

  if (!match) return defaultResult(platform)

  return {
    platform,
    owner: match[2] ?? null,
    repoName: match[3] ?? null,
    isValid: true,
  }
}

export function parseGitUrl(url: string): GitUrlParseResult {
  const trimmedUrl = url.trim()
  const platform = detectGitPlatform(trimmedUrl)

  // 檢查 URL 長度，防止 ReDoS 攻擊
  if (!trimmedUrl || trimmedUrl.length > MAX_URL_LENGTH) return defaultResult(platform)
  if (trimmedUrl.startsWith('https://')) return parseHttpsUrl(trimmedUrl, platform)
  if (trimmedUrl.startsWith('git@')) return parseSshUrl(trimmedUrl, platform)

  return defaultResult(platform)
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
