import { getStmts } from "../database/stmtsHelper.js";
import type { ModelType } from "../types/pod.js";

interface GlobalSettingRow {
  key: string;
  value: string;
}

const SUMMARY_MODEL_KEY = "summary_model";
const AI_DECIDE_MODEL_KEY = "ai_decide_model";
const TIMEZONE_OFFSET_KEY = "timezone_offset";
const DEFAULT_MODEL: ModelType = "sonnet";
const DEFAULT_TIMEZONE_OFFSET = 8;

export interface ConfigData {
  summaryModel: ModelType;
  aiDecideModel: ModelType;
  timezoneOffset: number;
}

export class ConfigStore {
  private get stmts(): ReturnType<typeof getStmts> {
    return getStmts();
  }

  private parseTimezoneOffset(value: string | undefined): number {
    const parsed = Number(value);
    return isNaN(parsed) ? DEFAULT_TIMEZONE_OFFSET : parsed;
  }

  getAll(): ConfigData {
    const rows =
      this.stmts.globalSettings.selectAll.all() as GlobalSettingRow[];
    const map = new Map(rows.map((row) => [row.key, row.value]));

    return {
      summaryModel: (map.get(SUMMARY_MODEL_KEY) as ModelType) ?? DEFAULT_MODEL,
      aiDecideModel:
        (map.get(AI_DECIDE_MODEL_KEY) as ModelType) ?? DEFAULT_MODEL,
      timezoneOffset: this.parseTimezoneOffset(map.get(TIMEZONE_OFFSET_KEY)),
    };
  }

  update(data: Partial<ConfigData>): ConfigData {
    if (data.summaryModel !== undefined) {
      this.stmts.globalSettings.upsert.run({
        $key: SUMMARY_MODEL_KEY,
        $value: data.summaryModel,
      });
    }

    if (data.aiDecideModel !== undefined) {
      this.stmts.globalSettings.upsert.run({
        $key: AI_DECIDE_MODEL_KEY,
        $value: data.aiDecideModel,
      });
    }

    if (data.timezoneOffset !== undefined) {
      this.stmts.globalSettings.upsert.run({
        $key: TIMEZONE_OFFSET_KEY,
        $value: String(data.timezoneOffset),
      });
    }

    return this.getAll();
  }

  getSummaryModel(): ModelType {
    const row = this.stmts.globalSettings.selectByKey.get(SUMMARY_MODEL_KEY) as
      | GlobalSettingRow
      | undefined;
    return (row?.value as ModelType) ?? DEFAULT_MODEL;
  }

  getAiDecideModel(): ModelType {
    const row = this.stmts.globalSettings.selectByKey.get(
      AI_DECIDE_MODEL_KEY,
    ) as GlobalSettingRow | undefined;
    return (row?.value as ModelType) ?? DEFAULT_MODEL;
  }

  getTimezoneOffset(): number {
    const row = this.stmts.globalSettings.selectByKey.get(
      TIMEZONE_OFFSET_KEY,
    ) as GlobalSettingRow | undefined;
    return this.parseTimezoneOffset(row?.value);
  }
}

export const configStore = new ConfigStore();
