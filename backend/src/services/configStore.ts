import { getDb } from '../database/index.js';
import { getStatements } from '../database/statements.js';
import type { ModelType } from '../types/pod.js';

interface GlobalSettingRow {
  key: string;
  value: string;
}

const SUMMARY_MODEL_KEY = 'summary_model';
const AI_DECIDE_MODEL_KEY = 'ai_decide_model';
const DEFAULT_MODEL: ModelType = 'sonnet';

export interface ConfigData {
  summaryModel: ModelType;
  aiDecideModel: ModelType;
}

export class ConfigStore {
  private get stmts(): ReturnType<typeof getStatements> {
    return getStatements(getDb());
  }

  getAll(): ConfigData {
    const rows = this.stmts.globalSettings.selectAll.all() as GlobalSettingRow[];
    const map = new Map(rows.map((row) => [row.key, row.value as ModelType]));

    return {
      summaryModel: map.get(SUMMARY_MODEL_KEY) ?? DEFAULT_MODEL,
      aiDecideModel: map.get(AI_DECIDE_MODEL_KEY) ?? DEFAULT_MODEL,
    };
  }

  update(data: Partial<ConfigData>): ConfigData {
    if (data.summaryModel !== undefined) {
      this.stmts.globalSettings.upsert.run({ $key: SUMMARY_MODEL_KEY, $value: data.summaryModel });
    }

    if (data.aiDecideModel !== undefined) {
      this.stmts.globalSettings.upsert.run({ $key: AI_DECIDE_MODEL_KEY, $value: data.aiDecideModel });
    }

    return this.getAll();
  }

  getSummaryModel(): ModelType {
    const row = this.stmts.globalSettings.selectByKey.get(SUMMARY_MODEL_KEY) as GlobalSettingRow | undefined;
    return (row?.value as ModelType) ?? DEFAULT_MODEL;
  }

  getAiDecideModel(): ModelType {
    const row = this.stmts.globalSettings.selectByKey.get(AI_DECIDE_MODEL_KEY) as GlobalSettingRow | undefined;
    return (row?.value as ModelType) ?? DEFAULT_MODEL;
  }
}

export const configStore = new ConfigStore();
