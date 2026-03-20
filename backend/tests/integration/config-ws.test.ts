import { v4 as uuidv4 } from "uuid";
import { emitAndWaitResponse, setupIntegrationTest } from "../setup";
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
} from "../../src/schemas";
import type {
  ConfigGetPayload,
  ConfigGetResultPayload,
  ConfigUpdatePayload,
  ConfigUpdatedPayload,
} from "../../src/schemas";

describe("Config WebSocket", () => {
  const { getClient } = setupIntegrationTest();

  describe("config:get", () => {
    it("成功取得預設設定值", async () => {
      const client = getClient();
      const response = await emitAndWaitResponse<
        ConfigGetPayload,
        ConfigGetResultPayload
      >(
        client,
        WebSocketRequestEvents.CONFIG_GET,
        WebSocketResponseEvents.CONFIG_GET_RESULT,
        { requestId: uuidv4() },
      );

      expect(response.success).toBe(true);
    });

    it("回傳正確的 payload 結構", async () => {
      const client = getClient();
      const requestId = uuidv4();
      const response = await emitAndWaitResponse<
        ConfigGetPayload,
        ConfigGetResultPayload
      >(
        client,
        WebSocketRequestEvents.CONFIG_GET,
        WebSocketResponseEvents.CONFIG_GET_RESULT,
        { requestId },
      );

      expect(response.requestId).toBe(requestId);
      expect(response.success).toBe(true);
      expect(response.summaryModel).toBe("sonnet");
      expect(response.aiDecideModel).toBe("sonnet");
    });
  });

  describe("config:update", () => {
    it("成功更新 summaryModel", async () => {
      const client = getClient();
      const response = await emitAndWaitResponse<
        ConfigUpdatePayload,
        ConfigUpdatedPayload
      >(
        client,
        WebSocketRequestEvents.CONFIG_UPDATE,
        WebSocketResponseEvents.CONFIG_UPDATED,
        { requestId: uuidv4(), summaryModel: "opus" },
      );

      expect(response.success).toBe(true);
      expect(response.summaryModel).toBe("opus");
    });

    it("成功更新 aiDecideModel", async () => {
      const client = getClient();
      const response = await emitAndWaitResponse<
        ConfigUpdatePayload,
        ConfigUpdatedPayload
      >(
        client,
        WebSocketRequestEvents.CONFIG_UPDATE,
        WebSocketResponseEvents.CONFIG_UPDATED,
        { requestId: uuidv4(), aiDecideModel: "haiku" },
      );

      expect(response.success).toBe(true);
      expect(response.aiDecideModel).toBe("haiku");
    });

    it("同時更新兩個設定", async () => {
      const client = getClient();
      const response = await emitAndWaitResponse<
        ConfigUpdatePayload,
        ConfigUpdatedPayload
      >(
        client,
        WebSocketRequestEvents.CONFIG_UPDATE,
        WebSocketResponseEvents.CONFIG_UPDATED,
        { requestId: uuidv4(), summaryModel: "opus", aiDecideModel: "haiku" },
      );

      expect(response.success).toBe(true);
      expect(response.summaryModel).toBe("opus");
      expect(response.aiDecideModel).toBe("haiku");
    });

    it("更新後 config:get 能讀取到新值", async () => {
      const client = getClient();

      await emitAndWaitResponse<ConfigUpdatePayload, ConfigUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONFIG_UPDATE,
        WebSocketResponseEvents.CONFIG_UPDATED,
        { requestId: uuidv4(), summaryModel: "opus", aiDecideModel: "haiku" },
      );

      const getResponse = await emitAndWaitResponse<
        ConfigGetPayload,
        ConfigGetResultPayload
      >(
        client,
        WebSocketRequestEvents.CONFIG_GET,
        WebSocketResponseEvents.CONFIG_GET_RESULT,
        { requestId: uuidv4() },
      );

      expect(getResponse.summaryModel).toBe("opus");
      expect(getResponse.aiDecideModel).toBe("haiku");
    });

    it("無效的 model 值回傳驗證錯誤", async () => {
      const client = getClient();
      const response = await emitAndWaitResponse<any, ConfigUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONFIG_UPDATE,
        WebSocketResponseEvents.CONFIG_UPDATED,
        { requestId: uuidv4(), summaryModel: "invalid-model" },
      );

      expect(response.success).toBe(false);
    });

    it("空 payload 回傳驗證錯誤", async () => {
      const client = getClient();
      const response = await emitAndWaitResponse<any, ConfigUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONFIG_UPDATE,
        WebSocketResponseEvents.CONFIG_UPDATED,
        { requestId: uuidv4() },
      );

      expect(response.success).toBe(false);
    });
  });

  describe("config timezoneOffset", () => {
    it("config:get 回傳 timezoneOffset 預設值 8", async () => {
      const client = getClient();
      const response = await emitAndWaitResponse<
        ConfigGetPayload,
        ConfigGetResultPayload
      >(
        client,
        WebSocketRequestEvents.CONFIG_GET,
        WebSocketResponseEvents.CONFIG_GET_RESULT,
        { requestId: uuidv4() },
      );

      expect(response.timezoneOffset).toBe(8);
    });

    it("config:update 成功更新 timezoneOffset", async () => {
      const client = getClient();
      const response = await emitAndWaitResponse<any, ConfigUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONFIG_UPDATE,
        WebSocketResponseEvents.CONFIG_UPDATED,
        { requestId: uuidv4(), timezoneOffset: -5 },
      );

      expect(response.success).toBe(true);
      expect(response.timezoneOffset).toBe(-5);
    });

    it("config:update timezoneOffset 超出範圍（> 14）回傳驗證錯誤", async () => {
      const client = getClient();
      const response = await emitAndWaitResponse<any, ConfigUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONFIG_UPDATE,
        WebSocketResponseEvents.CONFIG_UPDATED,
        { requestId: uuidv4(), timezoneOffset: 15 },
      );

      expect(response.success).toBe(false);
    });

    it("config:update timezoneOffset 非整數回傳驗證錯誤", async () => {
      const client = getClient();
      const response = await emitAndWaitResponse<any, ConfigUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONFIG_UPDATE,
        WebSocketResponseEvents.CONFIG_UPDATED,
        { requestId: uuidv4(), timezoneOffset: 5.5 },
      );

      expect(response.success).toBe(false);
    });

    it("更新 timezoneOffset 後 config:get 能讀取到新值", async () => {
      const client = getClient();

      await emitAndWaitResponse<any, ConfigUpdatedPayload>(
        client,
        WebSocketRequestEvents.CONFIG_UPDATE,
        WebSocketResponseEvents.CONFIG_UPDATED,
        { requestId: uuidv4(), timezoneOffset: 3 },
      );

      const getResponse = await emitAndWaitResponse<
        ConfigGetPayload,
        ConfigGetResultPayload
      >(
        client,
        WebSocketRequestEvents.CONFIG_GET,
        WebSocketResponseEvents.CONFIG_GET_RESULT,
        { requestId: uuidv4() },
      );

      expect(getResponse.timezoneOffset).toBe(3);
    });
  });
});
