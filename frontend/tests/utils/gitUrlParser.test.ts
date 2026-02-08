import { describe, it, expect } from 'vitest'
import { detectGitPlatform, parseGitUrl, getPlatformDisplayName } from '@/utils/gitUrlParser'

describe('gitUrlParser', () => {
  describe('detectGitPlatform', () => {
    it('應該偵測 GitHub URL', () => {
      const result = detectGitPlatform('https://github.com/user/repo')
      expect(result).toBe('github')
    })

    it('應該偵測 GitLab URL', () => {
      const result = detectGitPlatform('https://gitlab.com/user/repo')
      expect(result).toBe('gitlab')
    })

    it('應該偵測其他 Git 平台', () => {
      const result = detectGitPlatform('https://bitbucket.org/user/repo')
      expect(result).toBe('other')
    })

    it('應該大小寫不敏感', () => {
      expect(detectGitPlatform('https://GITHUB.COM/user/repo')).toBe('github')
      expect(detectGitPlatform('https://GitLab.com/user/repo')).toBe('gitlab')
    })
  })

  describe('parseGitUrl', () => {
    it('應該解析 HTTPS GitHub URL', () => {
      const result = parseGitUrl('https://github.com/user/repo')

      expect(result.platform).toBe('github')
      expect(result.owner).toBe('user')
      expect(result.repoName).toBe('repo')
      expect(result.isValid).toBe(true)
    })

    it('應該解析 HTTPS GitLab URL', () => {
      const result = parseGitUrl('https://gitlab.com/user/project')

      expect(result.platform).toBe('gitlab')
      expect(result.owner).toBe('user')
      expect(result.repoName).toBe('project')
      expect(result.isValid).toBe(true)
    })

    it('應該解析 SSH GitHub URL', () => {
      const result = parseGitUrl('git@github.com:user/repo')

      expect(result.platform).toBe('github')
      expect(result.owner).toBe('user')
      expect(result.repoName).toBe('repo')
      expect(result.isValid).toBe(true)
    })

    it('應該解析 SSH GitLab URL', () => {
      const result = parseGitUrl('git@gitlab.com:user/project')

      expect(result.platform).toBe('gitlab')
      expect(result.owner).toBe('user')
      expect(result.repoName).toBe('project')
      expect(result.isValid).toBe(true)
    })

    it('應該解析帶 .git 後綴的 HTTPS URL', () => {
      const result = parseGitUrl('https://github.com/user/repo.git')

      expect(result.owner).toBe('user')
      expect(result.repoName).toBe('repo')
      expect(result.isValid).toBe(true)
    })

    it('應該解析帶 .git 後綴的 SSH URL', () => {
      const result = parseGitUrl('git@github.com:user/repo.git')

      expect(result.owner).toBe('user')
      expect(result.repoName).toBe('repo')
      expect(result.isValid).toBe(true)
    })

    it('應該處理空字串', () => {
      const result = parseGitUrl('')

      expect(result.owner).toBe(null)
      expect(result.repoName).toBe(null)
      expect(result.isValid).toBe(false)
    })

    it('應該處理純空白字串', () => {
      const result = parseGitUrl('   ')

      expect(result.owner).toBe(null)
      expect(result.repoName).toBe(null)
      expect(result.isValid).toBe(false)
    })

    it('應該拒絕超長 URL', () => {
      const longUrl = 'https://github.com/' + 'a'.repeat(500)
      const result = parseGitUrl(longUrl)

      expect(result.isValid).toBe(false)
    })

    it('應該處理格式錯誤的 URL', () => {
      const result = parseGitUrl('not-a-git-url')

      expect(result.owner).toBe(null)
      expect(result.repoName).toBe(null)
      expect(result.isValid).toBe(false)
    })

    it('應該處理不完整的 HTTPS URL', () => {
      const result = parseGitUrl('https://github.com/user')

      expect(result.isValid).toBe(false)
    })

    it('應該處理不完整的 SSH URL', () => {
      const result = parseGitUrl('git@github.com:user')

      expect(result.isValid).toBe(false)
    })

    it('應該正確提取 owner 和 repoName', () => {
      const result = parseGitUrl('https://github.com/facebook/react')

      expect(result.owner).toBe('facebook')
      expect(result.repoName).toBe('react')
    })

    it('應該修剪前後空白', () => {
      const result = parseGitUrl('  https://github.com/user/repo  ')

      expect(result.owner).toBe('user')
      expect(result.repoName).toBe('repo')
      expect(result.isValid).toBe(true)
    })
  })

  describe('getPlatformDisplayName', () => {
    it('應該回傳 GitHub 的顯示名稱', () => {
      const result = getPlatformDisplayName('github')
      expect(result).toBe('GitHub')
    })

    it('應該回傳 GitLab 的顯示名稱', () => {
      const result = getPlatformDisplayName('gitlab')
      expect(result).toBe('GitLab')
    })

    it('應該回傳 other 的顯示名稱', () => {
      const result = getPlatformDisplayName('other')
      expect(result).toBe('Git')
    })
  })
})
