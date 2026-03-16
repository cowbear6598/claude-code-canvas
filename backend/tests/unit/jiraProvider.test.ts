import type { Mock } from 'vitest';
import { createHmac } from 'crypto';

vi.mock('../../src/services/integration/integrationAppStore.js', () => ({
  integrationAppStore: {
    getByProviderAndConfigField: vi.fn(() => undefined),
    getById: vi.fn(() => undefined),
    list: vi.fn(() => []),
    updateStatus: vi.fn(),
    updateResources: vi.fn(),
    updateExtraJson: vi.fn(),
  },
}));

vi.mock('../../src/services/integration/integrationEventPipeline.js', () => ({
  integrationEventPipeline: {
    processEvent: vi.fn(() => Promise.resolve()),
    safeProcessEvent: vi.fn(),
  },
}));

vi.mock('../../src/services/socketService.js', () => ({
  socketService: {
    emitToAll: vi.fn(),
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { jiraProvider, isPrivateUrl } from '../../src/services/integration/providers/jiraProvider.js';
import { integrationAppStore } from '../../src/services/integration/integrationAppStore.js';
import type { IntegrationApp } from '../../src/services/integration/types.js';

function asMock(fn: unknown): Mock<any> {
  return fn as Mock<any>;
}

function makeApp(overrides: Partial<IntegrationApp> = {}): IntegrationApp {
  return {
    id: 'app-jira-1',
    name: 'Test Jira',
    provider: 'jira',
    config: {
      siteUrl: 'https://mysite.atlassian.net',
      email: 'test@example.com',
      apiToken: 'token-abc',
      webhookSecret: 'secret-123',
    },
    connectionStatus: 'disconnected',
    resources: [],
    ...overrides,
  };
}

function buildSignedRequest(body: object, secret: string, overrideSignature?: string): Request {
  const rawBody = JSON.stringify(body);
  const hmac = createHmac('sha256', secret).update(rawBody).digest('hex');
  const signature = overrideSignature ?? `sha256=${hmac}`;

  return new Request('http://localhost/jira/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature': signature,
    },
    body: rawBody,
  });
}

const validPayload = {
  webhookEvent: 'jira:issue_created',
  timestamp: Date.now(),
  issue: { key: 'PROJ-1', fields: { summary: 'Test Issue' } },
  user: { displayName: 'John', emailAddress: 'john@example.com' },
};

describe('isPrivateUrl - SSRF 防護', () => {
  it('localhost 應被視為私有位址', () => {
    expect(isPrivateUrl('http://localhost/api')).toBe(true);
  });

  it('127.0.0.1 應被視為私有位址', () => {
    expect(isPrivateUrl('http://127.0.0.1/api')).toBe(true);
  });

  it('10.x.x.x 應被視為私有位址', () => {
    expect(isPrivateUrl('http://10.0.0.1/api')).toBe(true);
  });

  it('192.168.x.x 應被視為私有位址', () => {
    expect(isPrivateUrl('http://192.168.1.1/api')).toBe(true);
  });

  it('172.16.x.x 應被視為私有位址', () => {
    expect(isPrivateUrl('http://172.16.0.1/api')).toBe(true);
  });

  it('172.31.x.x 應被視為私有位址', () => {
    expect(isPrivateUrl('http://172.31.255.255/api')).toBe(true);
  });

  it('172.15.x.x 不應被視為私有位址', () => {
    expect(isPrivateUrl('http://172.15.0.1/api')).toBe(false);
  });

  it('公開 URL 不應被視為私有位址', () => {
    expect(isPrivateUrl('https://mysite.atlassian.net')).toBe(false);
  });
});

describe('JiraProvider - initialize SSRF 防護', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('私有 siteUrl 應更新狀態為 error 並 early return', async () => {
    const app = makeApp({
      config: {
        siteUrl: 'http://localhost',
        email: 'test@example.com',
        apiToken: 'token',
        webhookSecret: 'secret',
      },
    });

    await jiraProvider.initialize(app);

    expect(asMock(integrationAppStore.updateStatus)).toHaveBeenCalledWith(app.id, 'error');
  });
});

describe('JiraProvider - handleWebhookRequest 簽章去重', () => {
  const secret = 'my-webhook-secret';

  beforeEach(() => {
    vi.resetAllMocks();
    asMock(integrationAppStore.list).mockReturnValue([makeApp()]);
    asMock(integrationAppStore.getById).mockReturnValue(makeApp());
  });

  it('缺少 X-Hub-Signature header 應回傳 403', async () => {
    const req = new Request('http://localhost/jira/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const res = await jiraProvider.handleWebhookRequest(req);
    expect(res.status).toBe(403);
  });

  it('簽章驗證失敗應回傳 403', async () => {
    const req = buildSignedRequest(validPayload, secret, 'sha256=invalidsignature');
    const res = await jiraProvider.handleWebhookRequest(req);
    expect(res.status).toBe(403);
  });

  it('有效請求應回傳 200', async () => {
    const app = makeApp({ config: { ...makeApp().config, webhookSecret: secret } });
    asMock(integrationAppStore.list).mockReturnValue([app]);

    const req = buildSignedRequest(validPayload, secret);
    const res = await jiraProvider.handleWebhookRequest(req);
    expect(res.status).toBe(200);
  });

  it('無效的 JSON body 應回傳 400', async () => {
    const app = makeApp({ config: { ...makeApp().config, webhookSecret: secret } });
    asMock(integrationAppStore.list).mockReturnValue([app]);

    const rawBody = 'not-json';
    const hmac = createHmac('sha256', secret).update(rawBody).digest('hex');

    const req = new Request('http://localhost/jira/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature': `sha256=${hmac}`,
      },
      body: rawBody,
    });

    const res = await jiraProvider.handleWebhookRequest(req);
    expect(res.status).toBe(400);
  });
});

describe('JiraProvider - formatEventMessage', () => {
  it('jira:issue_created 應產生正確格式的訊息', () => {
    const app = makeApp();
    const event = {
      webhookEvent: 'jira:issue_created',
      timestamp: Date.now(),
      issue: { key: 'PROJ-1', fields: { summary: 'New bug' } },
      user: { displayName: 'Alice' },
    };

    const result = jiraProvider.formatEventMessage(event, app);
    expect(result).not.toBeNull();
    expect(result?.text).toContain('[Jira: Alice]');
    expect(result?.text).toContain('建立了 Issue');
    expect(result?.resourceId).toBe('PROJ');
  });

  it('issue.key 無法解析 projectKey 時應回傳 null', () => {
    const app = makeApp();
    const event = {
      webhookEvent: 'jira:issue_created',
      timestamp: Date.now(),
      issue: { key: '', fields: { summary: 'test' } },
    };

    const result = jiraProvider.formatEventMessage(event, app);
    expect(result).toBeNull();
  });
});

describe('JiraProvider - handleWebhookRequest Body 大小限制', () => {
  const secret = 'my-webhook-secret';

  beforeEach(() => {
    vi.resetAllMocks();
    asMock(integrationAppStore.list).mockReturnValue([makeApp({ config: { ...makeApp().config, webhookSecret: secret } })]);
  });

  it('Content-Length header 超過限制回傳 413', async () => {
    const req = new Request('http://localhost/jira/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature': 'sha256=somesig',
        'content-length': '2000000',
      },
      body: '{}',
    });

    const res = await jiraProvider.handleWebhookRequest(req);
    expect(res.status).toBe(413);
  });
});

describe('JiraProvider - handleWebhookRequest 重複簽章防護', () => {
  const secret = 'my-webhook-secret';

  beforeEach(() => {
    vi.resetAllMocks();
    asMock(integrationAppStore.list).mockReturnValue([makeApp({ config: { ...makeApp().config, webhookSecret: secret } })]);
    asMock(integrationAppStore.getById).mockReturnValue(makeApp({ config: { ...makeApp().config, webhookSecret: secret } }));
  });

  it('相同簽章的請求第二次應被略過（dedup），回傳 200', async () => {
    const { integrationEventPipeline } = await import('../../src/services/integration/integrationEventPipeline.js');
    const body = {
      webhookEvent: 'jira:issue_created',
      timestamp: Date.now(),
      issue: { key: 'DEDUP-1', fields: { summary: 'Test' } },
      user: { displayName: 'Alice' },
    };

    const rawBody = JSON.stringify(body);
    const { createHmac: createHmacFn } = await import('crypto');
    const hmac = createHmacFn('sha256', secret).update(rawBody).digest('hex');
    const signature = `sha256=${hmac}`;

    const makeReq = () =>
      new Request('http://localhost/jira/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature': signature,
        },
        body: rawBody,
      });

    await jiraProvider.handleWebhookRequest(makeReq());
    asMock(integrationEventPipeline.safeProcessEvent).mockClear();

    const res2 = await jiraProvider.handleWebhookRequest(makeReq());
    expect(res2.status).toBe(200);
    expect(asMock(integrationEventPipeline.safeProcessEvent)).not.toHaveBeenCalled();
  });
});

describe('JiraProvider - validateCreate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('新的 siteUrl + email 組合應通過驗證', () => {
    asMock(integrationAppStore.getByProviderAndConfigField).mockReturnValue(undefined);

    const result = jiraProvider.validateCreate({
      siteUrl: 'https://mysite.atlassian.net',
      email: 'user@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('相同 siteUrl + email 組合已存在應回傳錯誤', () => {
    asMock(integrationAppStore.getByProviderAndConfigField).mockReturnValue(
      makeApp({ config: { ...makeApp().config, email: 'test@example.com' } }),
    );

    const result = jiraProvider.validateCreate({
      siteUrl: 'https://mysite.atlassian.net',
      email: 'test@example.com',
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain('已存在');
  });

  it('siteUrl 和 email 皆缺少應回傳錯誤', () => {
    const result = jiraProvider.validateCreate({});
    expect(result.success).toBe(false);
  });
});

describe('JiraProvider - sanitizeConfig', () => {
  it('應保留 siteUrl 和 email，隱藏 apiToken 和 webhookSecret', () => {
    const config = {
      siteUrl: 'https://mysite.atlassian.net',
      email: 'user@example.com',
      apiToken: 'secret-token',
      webhookSecret: 'webhook-secret',
    };

    const result = jiraProvider.sanitizeConfig(config);
    expect(result.siteUrl).toBe('https://mysite.atlassian.net');
    expect(result.email).toBe('user@example.com');
    expect(result.apiToken).toBeUndefined();
    expect(result.webhookSecret).toBeUndefined();
  });
});

describe('JiraProvider - 基本屬性', () => {
  it('name 應為 jira', () => {
    expect(jiraProvider.name).toBe('jira');
  });

  it('webhookPath 應為 /jira/events', () => {
    expect(jiraProvider.webhookPath).toBe('/jira/events');
  });

  it('createAppSchema 應拒絕私有 siteUrl', () => {
    const result = jiraProvider.createAppSchema.safeParse({
      siteUrl: 'https://localhost/api',
      email: 'test@example.com',
      apiToken: 'token',
      webhookSecret: 'secret',
    });
    expect(result.success).toBe(false);
  });

  it('createAppSchema 應接受公開 https siteUrl', () => {
    const result = jiraProvider.createAppSchema.safeParse({
      siteUrl: 'https://mysite.atlassian.net',
      email: 'test@example.com',
      apiToken: 'token',
      webhookSecret: 'secret',
    });
    expect(result.success).toBe(true);
  });
});
