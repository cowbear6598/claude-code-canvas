import { ContentBlock } from '../../types';

type ClaudeTextContent = {
  type: 'text';
  text: string;
};

type ClaudeImageContent = {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
};

export type ClaudeMessageContent = ClaudeTextContent | ClaudeImageContent;

export type SDKUserMessage = {
  type: 'user';
  message: {
    role: 'user';
    content: ClaudeMessageContent[];
  };
  parent_tool_use_id: null;
  session_id: string;
};

export function buildClaudeContentBlocks(
  message: ContentBlock[],
  commandId: string | null
): ClaudeMessageContent[] {
  const contentArray: ClaudeMessageContent[] = [];
  let isFirstTextBlock = true;

  for (const block of message) {
    if (block.type === 'text') {
      let text = block.text;
      if (isFirstTextBlock && commandId) {
        text = `/${commandId} ${text}`;
        isFirstTextBlock = false;
      }

      if (text.trim().length === 0) {
        continue;
      }

      contentArray.push({
        type: 'text',
        text,
      });
    } else if (block.type === 'image') {
      contentArray.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: block.mediaType,
          data: block.base64Data,
        },
      });
    }
  }

  if (contentArray.length === 0) {
    contentArray.push({
      type: 'text',
      text: '請開始執行',
    });
  }

  return contentArray;
}

export function createUserMessageStream(
  content: ClaudeMessageContent[],
  sessionId: string
): AsyncIterable<SDKUserMessage> {
  return (async function* (): AsyncGenerator<SDKUserMessage, void, undefined> {
    yield {
      type: 'user' as const,
      message: {
        role: 'user' as const,
        content,
      },
      parent_tool_use_id: null,
      session_id: sessionId,
    };
  })();
}
