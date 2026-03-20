import { defineStore } from "pinia";
import { ref } from "vue";
import { getConfig } from "@/services/configApi";

export const useConfigStore = defineStore("config", () => {
  const timezoneOffset = ref<number>(8);

  const fetchConfig = async (): Promise<void> => {
    const result = await getConfig();
    if (result.timezoneOffset !== undefined) {
      timezoneOffset.value = result.timezoneOffset;
    }
  };

  const setTimezoneOffset = (offset: number): void => {
    timezoneOffset.value = offset;
  };

  return {
    timezoneOffset,
    fetchConfig,
    setTimezoneOffset,
  };
});
