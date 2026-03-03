export interface AiDecideTargetInfo {
  connectionId: string;
  targetPodId: string;
  targetPodName: string;
  targetPodOutputStyle: string | null;
  targetPodCommand: string | null;
}

export interface AiDecidePromptContext {
  sourcePodName: string;
  sourceSummary: string;
  targets: AiDecideTargetInfo[];
}

function buildSourceSection(context: AiDecidePromptContext): string {
  return `# 上游任務資訊

**Pod 名稱**：${context.sourcePodName}

**執行摘要**：
${context.sourceSummary}

---

# 下游任務清單

`;
}

function buildTargetSection(target: AiDecideTargetInfo): string {
  let section = `## Target Pod: ${target.targetPodName}\n`;
  section += `- Connection ID: ${target.connectionId}\n`;

  if (target.targetPodOutputStyle) {
    section += `- OutputStyle：\n\`\`\`\n${target.targetPodOutputStyle}\n\`\`\`\n`;
  } else {
    section += `- OutputStyle：無\n`;
  }

  if (target.targetPodCommand) {
    section += `- Command：\n\`\`\`\n${target.targetPodCommand}\n\`\`\`\n`;
  } else {
    section += `- Command：無\n`;
  }

  section += `\n`;
  return section;
}

class AiDecidePromptBuilder {
  buildSystemPrompt(): string {
    return `你是一個 Workflow 觸發判斷者。

你的任務是分析上游任務（Source Pod）的執行結果，並判斷是否應該觸發下游任務（Target Pod）。

判斷標準：
1. 上游任務的產出是否與下游任務的需求相關
2. 下游任務的 OutputStyle（輸出風格）如果有指定，是否與上游產出匹配
3. 下游任務的 Command（命令）如果有指定，是否需要上游的產出作為輸入

請根據上下文資訊，為每個 Target Pod 做出判斷，並提供簡短的理由說明。`;
  }

  buildUserPrompt(context: AiDecidePromptContext): string {
    let prompt = buildSourceSection(context);

    for (const target of context.targets) {
      prompt += buildTargetSection(target);
    }

    prompt += `---

請使用 \`decide_triggers\` tool 回傳你的判斷結果。

對每個 Target Pod 判斷：
- 是否應該觸發（shouldTrigger: true/false）
- 判斷理由（reason: 簡短說明，20 字內）`;

    return prompt;
  }
}

export const aiDecidePromptBuilder = new AiDecidePromptBuilder();
