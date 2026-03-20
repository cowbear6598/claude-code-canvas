<script setup lang="ts">
import { ref, watch, computed } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import { getConfig, updateConfig } from "@/services/configApi";
import { listPlugins } from "@/services/pluginApi";
import { MODEL_OPTIONS, TIMEZONE_OPTIONS } from "@/types";
import type { ModelType } from "@/types/pod";
import type { InstalledPlugin } from "@/types/plugin";
import { useToast } from "@/composables/useToast";
import { useWebSocketErrorHandler } from "@/composables/useWebSocketErrorHandler";
import { useConfigStore } from "@/stores/configStore";

interface Props {
  open: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const { showSuccessToast } = useToast();
const { withErrorToast } = useWebSocketErrorHandler();

const configStore = useConfigStore();

const summaryModel = ref<ModelType>("sonnet");
const aiDecideModel = ref<ModelType>("sonnet");
const timezoneOffset = ref<string>("8");
const installedPlugins = ref<InstalledPlugin[]>([]);
const isLoading = ref<boolean>(false);
const isSaving = ref<boolean>(false);
const loadFailed = ref<boolean>(false);

// 按 repo 分組
const pluginsByRepo = computed<Map<string, InstalledPlugin[]>>(() => {
  const map = new Map<string, InstalledPlugin[]>();
  for (const plugin of installedPlugins.value) {
    const repoKey = plugin.repo || "(未知 repo)";
    const group = map.get(repoKey) ?? [];
    group.push(plugin);
    map.set(repoKey, group);
  }
  return map;
});

// 展開狀態，預設全部收合
const expandedRepos = ref<Set<string>>(new Set());

const toggleRepo = (repo: string): void => {
  const next = new Set(expandedRepos.value);
  if (next.has(repo)) {
    next.delete(repo);
  } else {
    next.add(repo);
  }
  expandedRepos.value = next;
};

const loadConfig = async (): Promise<void> => {
  isLoading.value = true;
  loadFailed.value = false;
  // 非同步載入 Plugin 列表，不阻塞 config 載入
  listPlugins()
    .then((plugins) => {
      installedPlugins.value = plugins;
      expandedRepos.value = new Set();
    })
    .catch(() => {
      installedPlugins.value = [];
    });
  try {
    const result = await withErrorToast(getConfig(), "Config", "載入失敗");
    if (!result) {
      loadFailed.value = true;
      return;
    }
    if (result.summaryModel) summaryModel.value = result.summaryModel;
    if (result.aiDecideModel) aiDecideModel.value = result.aiDecideModel;
    if (result.timezoneOffset !== undefined) {
      timezoneOffset.value = String(result.timezoneOffset);
      configStore.setTimezoneOffset(result.timezoneOffset);
    }
  } finally {
    isLoading.value = false;
  }
};

const handleSave = async (): Promise<void> => {
  isSaving.value = true;
  try {
    const tzOffset = Number(timezoneOffset.value);
    const result = await withErrorToast(
      updateConfig({
        summaryModel: summaryModel.value,
        aiDecideModel: aiDecideModel.value,
        timezoneOffset: tzOffset,
      }),
      "Config",
      "儲存失敗",
    );
    if (result) {
      configStore.setTimezoneOffset(tzOffset);
      showSuccessToast("Config", "儲存成功");
      emit("update:open", false);
    }
  } finally {
    isSaving.value = false;
  }
};

const handleClose = (): void => {
  emit("update:open", false);
};

watch(
  () => props.open,
  (newVal) => {
    if (newVal) {
      loadConfig();
    }
  },
  { immediate: true },
);
</script>

<template>
  <Dialog :open="open" @update:open="handleClose">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>全域設定</DialogTitle>
        <DialogDescription>管理模型與全域參數設定</DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <div class="space-y-2">
          <Label>總結模型</Label>
          <p class="text-xs text-muted-foreground">工作流總結時使用的模型</p>
          <Select v-model="summaryModel">
            <SelectTrigger>
              <SelectValue placeholder="選擇模型" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem
                v-for="option in MODEL_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="border-t border-border" />

        <div class="space-y-2">
          <Label>AI 決策模型</Label>
          <p class="text-xs text-muted-foreground">
            AI Decide 連線判斷時使用的模型
          </p>
          <Select v-model="aiDecideModel">
            <SelectTrigger>
              <SelectValue placeholder="選擇模型" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem
                v-for="option in MODEL_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="border-t border-border" />

        <div class="space-y-2">
          <Label>時區</Label>
          <p class="text-xs text-muted-foreground">排程觸發時間的時區設定</p>
          <Select v-model="timezoneOffset">
            <SelectTrigger>
              <SelectValue placeholder="選擇時區" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem
                v-for="option in TIMEZONE_OPTIONS"
                :key="option.value"
                :value="String(option.value)"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="border-t border-border" />

        <div class="space-y-2">
          <Label>Plugin 管理</Label>
          <p class="text-xs text-muted-foreground">
            已安裝的 Plugin 列表，可在 Pod 右鍵選單中個別啟用
          </p>
          <div
            v-if="installedPlugins.length === 0"
            class="text-xs text-muted-foreground py-2"
          >
            尚未安裝任何 Plugin，請透過 Claude Code CLI 安裝
          </div>
          <div v-else class="border border-border rounded-md p-2">
            <ScrollArea class="h-40">
              <div class="space-y-3 pr-3">
                <div
                  v-for="[repo, plugins] in pluginsByRepo"
                  :key="repo"
                  class="space-y-1"
                >
                  <!-- repo 標題列 -->
                  <div
                    class="flex items-center gap-1 cursor-pointer hover:bg-secondary rounded px-1 py-0.5"
                    @click="toggleRepo(repo)"
                  >
                    <ChevronDown
                      v-if="expandedRepos.has(repo)"
                      class="h-3 w-3 text-muted-foreground shrink-0"
                    />
                    <ChevronRight
                      v-else
                      class="h-3 w-3 text-muted-foreground shrink-0"
                    />
                    <span class="text-xs font-medium">{{ repo }}</span>
                    <span class="text-xs text-muted-foreground ml-1">
                      ({{ plugins.length }})
                    </span>
                  </div>
                  <!-- 展開的 plugin 列表 -->
                  <div v-if="expandedRepos.has(repo)" class="pl-5 space-y-2">
                    <div
                      v-for="plugin in plugins"
                      :key="plugin.id"
                      class="flex items-center justify-between"
                    >
                      <div>
                        <span class="text-xs font-medium">{{
                          plugin.name
                        }}</span>
                        <p class="text-xs text-muted-foreground">
                          v{{ plugin.version }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          :disabled="isLoading || isSaving || loadFailed"
          @click="handleSave"
        >
          {{ isSaving ? "儲存中..." : "儲存" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
