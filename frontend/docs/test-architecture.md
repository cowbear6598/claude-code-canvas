# Frontend Testing Architecture

## Diagram 1: Frontend Layered Architecture

```mermaid
graph TB
    subgraph View["View Layer (Vue Components)"]
        A1["CanvasContainer.vue"]
        A2["CanvasPod.vue"]
        A3["ChatModal.vue"]
        A4["ConnectionLayer.vue"]
        A5["CanvasSidebar.vue"]
    end

    subgraph Composable["Composable Layer"]
        B1["useBoxSelect()"]
        B2["useCopyPaste()"]
        B3["useBatchDrag()"]
        B4["useDeleteSelection()"]
        B5["useCanvasPan()"]
        B6["useCanvasZoom()"]
        B7["useSlotDropTarget()"]
        B8["useWebSocketErrorHandler()"]
    end

    subgraph Store["Store Layer (Pinia)"]
        C1["canvasStore"]
        C2["podStore"]
        C3["connectionStore"]
        C4["chatStore"]
        C5["selectionStore"]
        C6["clipboardStore"]
        C7["Note Stores<br/>outputStyleStore<br/>skillStore<br/>repositoryStore<br/>subAgentStore<br/>commandStore"]
    end

    subgraph Service["Service Layer"]
        D1["WebSocketClient"]
        D2["createWebSocketRequest()"]
        D3["generateRequestId()"]
        D4["errorSanitizer"]
    end

    subgraph Utils["Utils Layer"]
        E1["keyboardHelpers"]
        E2["domHelpers"]
        E3["scheduleUtils"]
        E4["gitUrlParser"]
        E5["chatUtils"]
    end

    A1 --> B1
    A1 --> B2
    A1 --> B5
    A2 --> B3
    A3 --> B2
    A4 --> B6
    A5 --> B1

    B1 --> C1
    B1 --> C5
    B2 --> C1
    B2 --> C2
    B2 --> C6
    B3 --> C2
    B3 --> C5
    B4 --> C2
    B4 --> C5
    B4 --> C7
    B7 --> C7
    B8 --> D1

    C1 --> D1
    C2 --> D1
    C3 --> D1
    C4 --> D1
    C5 --> C1
    C6 --> C1
    C7 --> D1

    D1 --> D2
    D2 --> D3
    D2 --> E4

    E1 --> B1
    E2 --> B1
    E3 --> C2
    E4 --> C2
    E5 --> C4
```

---

## Diagram 2: Store Dependency Graph

```mermaid
graph TB
    subgraph CoreStores["Core Stores"]
        A["canvasStore"]
        B["podStore"]
        C["connectionStore"]
    end

    subgraph NoteStores["Note Stores<br/>(Factory Pattern)"]
        D1["outputStyleStore"]
        D2["skillStore"]
        D3["repositoryStore"]
        D4["subAgentStore"]
        D5["commandStore"]
        F["createNoteStore<br/>Factory"]
    end

    subgraph UtilityStores["Utility Stores"]
        E["selectionStore"]
        G["clipboardStore"]
        H["viewportStore"]
    end

    subgraph ChatStores["Chat Store & Actions"]
        I["chatStore"]
        I1["chatMessageActions"]
        I2["chatHistoryActions"]
        I3["chatConnectionActions"]
    end

    A -->|activeCanvasId| B
    A -->|activeCanvasId| C
    A -->|activeCanvasId| D1
    A -->|activeCanvasId| D2
    A -->|activeCanvasId| D3
    A -->|activeCanvasId| D4
    A -->|activeCanvasId| D5

    B -->|pod.id| C
    B -->|pod.id| I
    B -->|pod.status| I

    C -->|connection.targetPodId| B
    C -->|workflow events| I

    E -->|selectedPodIds| B
    E -->|selectedNoteIds| D1
    E -->|selectedNoteIds| D2
    E -->|selectedNoteIds| D3
    E -->|selectedNoteIds| D4
    E -->|selectedNoteIds| D5

    G -->|copiedPods| B
    G -->|copiedNotes| D1
    G -->|copiedNotes| D2
    G -->|copiedNotes| D3
    G -->|copiedNotes| D4
    G -->|copiedNotes| D5

    H -->|viewport state| B
    H -->|viewport state| A

    F -->|creates| D1
    F -->|creates| D2
    F -->|creates| D3
    F -->|creates| D4
    F -->|creates| D5

    I -->|messagesByPodId| B
    I1 -->|implements| I
    I2 -->|implements| I
    I3 -->|implements| I
    I3 -->|triggers workflow| C
```

---

## Diagram 3: User Flow 1 - Canvas/Pod/Connection Operations

```mermaid
graph TD
    A["User Creates Canvas"] -->|canvasStore.createCanvas| B["POST /CANVAS_CREATE"]
    B -->|Response: CANVAS_CREATED| C["canvasStore.activeCanvasId = new ID"]
    C --> D["Toast: Success"]

    E["User Creates Pod"] -->|podStore.createPodWithBackend| F["POST /POD_CREATE"]
    F -->|Response: POD_CREATED| G["podStore.pods.push new Pod"]
    G -->|Check activeCanvasId| C

    H["User Selects Model"] -->|podStore.setModel| I["POST /POD_MODEL_SET"]
    I -->|Response: POD_MODEL_UPDATED| J["pod.model = selected"]

    K["User Binds Note to Pod"] -->|noteStore.bindToPod| L["POST /NOTE_BIND"]
    L -->|Response: NOTE_BOUND| M["note.boundToPodId = podId"]
    M -->|Update pod slot| N["pod.noteSlotId = noteId"]

    O["User Creates Connection"] -->|connectionStore.createConnection| P["POST /CONNECTION_CREATE"]
    P -->|Response: CONNECTION_CREATED| Q["connectionStore.connections.push"]
    Q -->|Validation| R{Valid?}
    R -->|No Self-Loop| S["Return null + Toast"]
    R -->|Yes| T["Connection Added"]

    U["User Updates Trigger Mode"] -->|connectionStore.updateConnectionTriggerMode| V["POST /CONNECTION_UPDATE"]
    V -->|Response: CONNECTION_UPDATED| W["connection.triggerMode updated"]

    X["Pod Chat Completes"] -->|handleChatComplete| Y{Check Connections}
    Y -->|Auto Mode| Z["POST /WORKFLOW_AUTO_TRIGGERED"]
    Z -->|Response| AA["targetPod.status = active"]
    Y -->|AI-Decide| AB["POST /WORKFLOW_AI_DECIDE_PENDING"]
    AB -->|Response: PENDING| AC["connection.status = ai-deciding"]
    AC -->|AI Result| AD["POST /WORKFLOW_AI_DECIDE_RESULT"]
    AD -->|Approved| AE["connection.status = ai-approved"]
    AD -->|Rejected| AF["connection.status = ai-rejected"]
    Y -->|Direct| AG["User Clicks Connection"]
    AG -->|POST /WORKFLOW_DIRECT_TRIGGERED| AH["connection.status = active"]

    AI["Workflow Completes"] -->|handleWorkflowComplete| AJ["POST /WORKFLOW_COMPLETE"]
    AJ -->|Response| AK["connection.status = idle"]

    AL["User Sets Schedule"] -->|podStore.setSchedule| AM["POST /POD_SCHEDULE_SET"]
    AM -->|Response: POD_SCHEDULE_UPDATED| AN["pod.schedule updated"]
    AO["Schedule Fires"] -->|Event: SCHEDULE_FIRED| AP["podStore.scheduleFiredPodIds.add"]
    AP -->|3 seconds| AQ["Animation Complete"]
```

---

## Diagram 4: User Flow 2 - Chat Conversation

```mermaid
graph TD
    A["User Opens Pod Chat"] -->|podStore.selectPod| B["Check websocket.isConnected"]
    B -->|Connected| C["ChatModal.vue Opens"]
    B -->|Disconnected| D["Show Reconnect Prompt"]

    E["User Sends Message"] -->|chatStore.sendMessage| F["POST /POD_CHAT_SEND"]
    F -->|Request Sent| G["chatStore.isTypingByPodId[podId] = true"]
    G -->|Add to messages| H["messagesByPodId.get podId push user msg"]

    I["Receive Stream Start"] -->|Event: POD_CHAT_MESSAGE| J["chatStore.handleChatMessage"]
    J -->|Create assistant msg| K["Message added with isPartial: true"]
    K -->|Set streaming| L["currentStreamingMessageId = msgId"]
    L -->|Track length| M["accumulatedLengthByMessageId set"]

    N["Receive Stream Delta"] -->|Event: POD_CHAT_MESSAGE| O["Append to currentMessage"]
    O -->|Update length| P["accumulatedLengthByMessageId increment"]

    Q["Receive Stream End"] -->|Event: POD_CHAT_COMPLETE| R["chatStore.handleChatComplete"]
    R -->|Update message| S["isPartial: false"]
    S -->|Stop typing| T["isTypingByPodId[podId] = false"]
    T -->|Clear streaming| U["currentStreamingMessageId = null"]
    U -->|Pod idle| V["podStore.status = idle"]
    V -->|Check downstream| W["Check connectionStore auto connections"]
    W -->|Trigger workflow| X["POST /WORKFLOW_AUTO_TRIGGERED"]

    Y["Tool Use Request"] -->|Event: POD_CHAT_TOOL_USE| Z["chatStore.handleToolUse"]
    Z -->|Add tool info| AA["message.toolUse.push"]
    AA -->|Set status| AB["tool.status = running"]

    AC["Tool Result"] -->|Event: POD_CHAT_TOOL_RESULT| AD["chatStore.handleToolResult"]
    AD -->|Update output| AE["tool.output = result"]
    AE -->|Set status| AF["tool.status = completed or error"]

    AG["AutoClear Enabled"] -->|Event: POD_MESSAGES_CLEARED| AH["chatStore.handleMessagesClearedEvent"]
    AH -->|Clear messages| AI["messagesByPodId.set podId []"]
    AI -->|Animation| AJ["autoClearAnimationPodId = podId"]
    AJ -->|3 seconds| AK["Clear pod output"]

    AL["Load History"] -->|chatStore.loadHistory| AM["POST /POD_CHAT_HISTORY_LOAD"]
    AM -->|Response: LOADED| AN["historyLoadingStatus = loading"]
    AN -->|Set messages| AO["messagesByPodId.set podId messages"]
    AO -->|Complete| AP["historyLoadingStatus = loaded"]

    AQ["User Aborts"] -->|chatStore.abortChat| AR["POST /POD_CHAT_ABORT"]
    AR -->|Response: ABORTED| AS["isTypingByPodId[podId] = false"]
    AS -->|Stop streaming| AT["currentStreamingMessageId = null"]
    AT -->|Pod idle| AU["podStore.status = idle"]
```

---

## Diagram 5: User Flow 3 - Copy/Paste & Batch Operations

```mermaid
graph TD
    A["User Starts Box Select"] -->|useBoxSelect| B["selectionStore.startSelection"]
    B -->|Set flag| C["isSelecting = true"]
    C -->|Record Ctrl| D{Ctrl Pressed?}
    D -->|Yes| E["initialSelectedElements = save"]
    D -->|No| F["Clear initial"]

    G["Update Selection Box"] -->|Mouse Move| H["selectionStore.updateSelection"]
    H -->|Update box| I["box.endX endY updated"]

    J["Calculate Elements"] -->|Intersection Check| K["Pods in range"]
    K -->|Check| L["Notes in range"]
    L -->|Exclude| M["Bound Notes filtered out"]
    M -->|Ctrl Mode| N{Toggle?}
    N -->|Yes| O["selectedElements = XOR initialSelected"]
    N -->|No| P["selectedElements = new selection"]

    Q["End Selection"] -->|Mouse Up| R["selectionStore.endSelection"]
    R -->|isSelecting = false| S["box = null"]
    S -->|Set flag| T["boxSelectJustEnded = true"]

    U["Copy Selected"] -->|Ctrl+C| V["clipboardStore.setCopy"]
    V -->|From podStore| W["copiedPods = selected pods"]
    W -->|From noteStores| X["copiedOutputStyleNotes = notes"]
    X -->|From noteStores| Y["copiedSkillNotes = notes"]
    Y -->|From noteStores| Z["copiedRepositoryNotes = notes"]
    Z -->|From noteStores| AA["copiedSubAgentNotes = notes"]
    AA -->|From noteStores| AB["copiedCommandNotes = notes"]
    AB -->|From connectionStore| AC["copiedConnections = related"]
    AC -->|Record time| AD["copyTimestamp = now"]

    AE["Check Clipboard"] -->|clipboardStore.isEmpty| AF{Has Data?}
    AF -->|No| AG["Skip Paste"]
    AF -->|Yes| AH["Proceed"]

    AI["Calculate Paste Position"] -->|Mouse Position| AJ["Relative offset from center"]

    AK["Create Pod Copies"] -->|For each pod| AL["podStore.createPodWithBackend"]
    AL -->|POST /POD_CREATE| AM["Response: POD_CREATED"]
    AM -->|Store mapping| AN["oldPodId -> newPodId"]

    AO["Create Note Copies"] -->|For each note type| AP["noteStore.create"]
    AP -->|POST /NOTE_CREATE| AQ["Response: NOTE_CREATED"]
    AQ -->|Update mapping| AR["oldNoteId -> newNoteId"]
    AR -->|Bind if needed| AS["Update boundToPodId to new pod"]

    AT["Recreate Connections"] -->|For each connection| AU["connectionStore.createConnection"]
    AU -->|POST /CONNECTION_CREATE| AV["Response: CONNECTION_CREATED"]
    AV -->|Use new IDs| AW["sourcePodId targetPodId mapped"]

    AX["Batch Drag Start"] -->|Mouse Down| AY["Record initial coords"]

    AZ["Batch Drag Move"] -->|Delta X Y| BA["Update all selected elements"]
    BA -->|For pods| BB["podStore x y updated locally"]
    BA -->|For notes| BC["noteStore x y updated locally"]

    BD["Batch Drag End"] -->|Mouse Up| BE["Sync to backend"]
    BE -->|For each moved| BF["POST /POD_MOVE or NOTE_MOVE"]
    BF -->|Response| BG["Confirm position"]
    BG -->|Failure| BH["Rollback to original"]

    BI["Batch Delete"] -->|Delete key| BJ["useDeleteSelection"]
    BJ -->|For each pod| BK["podStore.deletePodWithBackend"]
    BK -->|POST /POD_DELETE| BL["Response"]
    BJ -->|For connections| BM["connectionStore.deleteConnectionsByPodId"]
    BM -->|POST /CONNECTION_DELETE| BN["Response"]
    BJ -->|For notes| BO["noteStore.delete"]
    BO -->|POST /NOTE_DELETE| BP["Response"]
    BP -->|Clear selection| BQ["selectionStore.clearSelection"]
    BQ -->|Show toast| BR["Deleted X elements"]
```

---

## Diagram 6: Testing Layer Strategy

```mermaid
graph TB
    subgraph Unit["Unit Tests (Layer 1)"]
        A1["Utils Tests"]
        A2["keyboardHelpers.test.ts"]
        A3["domHelpers.test.ts"]
        A4["scheduleUtils.test.ts"]
        A5["errorSanitizer.test.ts"]
        A6["chatUtils.test.ts"]
    end

    subgraph Store["Store Tests (Layer 2)"]
        B1["canvasStore.test.ts"]
        B2["podStore.test.ts"]
        B3["connectionStore.test.ts"]
        B4["chatStore.test.ts"]
        B5["selectionStore.test.ts"]
        B6["clipboardStore.test.ts"]
        B7["noteStore.test.ts<br/>outputStyleStore<br/>skillStore<br/>repositoryStore<br/>subAgentStore<br/>commandStore"]
    end

    subgraph Composable["Composable Tests (Layer 3)"]
        C1["useBoxSelect.test.ts"]
        C2["useCopyPaste.test.ts"]
        C3["useBatchDrag.test.ts"]
        C4["useDeleteSelection.test.ts"]
        C5["useCanvasPan.test.ts"]
        C6["useCanvasZoom.test.ts"]
        C7["useSlotDropTarget.test.ts"]
        C8["useWebSocketErrorHandler.test.ts"]
    end

    subgraph Integration["Integration Tests (Layer 4)"]
        D1["Canvas/Pod Operations.test.ts"]
        D2["Chat Flow.test.ts"]
        D3["Copy/Paste Batch Ops.test.ts"]
        D4["Workflow Trigger.test.ts"]
    end

    subgraph Mock["Mock Boundaries"]
        E1["@/services/websocket"]
        E2["@/composables/useToast"]
        E3["WebSocketClient.on/.off/.emit"]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B2
    A4 --> B2
    A5 --> B1
    A6 --> B4

    B1 --> C1
    B1 --> C3
    B2 --> C2
    B2 --> C3
    B3 --> C4
    B4 --> C5
    B5 --> C1
    B6 --> C2
    B7 --> C4

    C1 --> D1
    C2 --> D3
    C3 --> D3
    C4 --> D3
    C5 --> D2
    C6 --> D2
    C7 --> D1
    C8 --> D2

    D1 -->|Mocks| E1
    D2 -->|Mocks| E1
    D3 -->|Mocks| E1
    D4 -->|Mocks| E1

    D1 -->|Mocks| E2
    D2 -->|Mocks| E2
    D3 -->|Mocks| E2

    E1 -->|Mock Response| E3
    E1 -->|Mock Events| E3

    style Mock fill:#ffcccc
    style Unit fill:#ccffcc
    style Store fill:#ccccff
    style Composable fill:#ffffcc
    style Integration fill:#ffccff
```

---

## Diagram 7: Mock Strategy & WebSocket Flow

```mermaid
graph LR
    subgraph Test["Test Code"]
        T1["it should create pod"]
    end

    subgraph Mock["Mock Layer"]
        M1["vi.mock<br/>@/services/websocket"]
        M2["createWebSocketRequest<br/>Returns Mock Response"]
        M3["websocketClient.on<br/>Trigger Event Handler"]
    end

    subgraph Store["Store Actions"]
        S1["podStore.createPodWithBackend"]
        S2["createWebSocketRequest<br/>POST /POD_CREATE"]
        S3["await response"]
        S4["Update podStore.pods"]
    end

    subgraph Event["Event Handling"]
        E1["websocketClient.on<br/>POD_CREATED"]
        E2["Event Handler Triggered"]
        E3["Update Store State"]
    end

    subgraph Assert["Assertions"]
        A1["expect pods.length toEqual"]
        A2["expect pod.model toEqual"]
        A3["expect toast was called"]
    end

    T1 -->|Calls| S1
    S1 -->|Calls| S2
    S2 -->|Mocked by| M2
    M2 -->|Returns| S3
    S3 -->|Updates| S4

    S2 -->|Triggered by| M3
    M3 -->|Calls| E1
    E1 -->|Handler| E2
    E2 -->|Updates| E3

    S4 -->|Verified by| A1
    E3 -->|Verified by| A2
    M1 -->|Mocks| A3

    style Mock fill:#ffcccc
    style Store fill:#ccccff
    style Event fill:#ffffcc
    style Assert fill:#ccffcc
```

---

## Diagram 8: Test Data Factory Pattern

```mermaid
graph TD
    A["Test File"] -->|import| B["factories/"]

    B -->|createMockCanvas| C["Canvas Factory"]
    C -->|Returns| C1["id: generated"]
    C -->|Returns| C2["name: Canvas 1"]
    C -->|Returns| C3["sortIndex: 0"]

    B -->|createMockPod| D["Pod Factory"]
    D -->|Returns| D1["id: pod-1"]
    D -->|Returns| D2["model: opus"]
    D -->|Returns| D3["x, y, rotation"]
    D -->|Returns| D4["status: idle"]
    D -->|Returns| D5["skillIds: []"]

    B -->|createMockNote| E["Note Factory<br/>OutputStyle/Skill/etc"]
    E -->|Returns| E1["id: note-1"]
    E -->|Returns| E2["x, y position"]
    E -->|Returns| E3["boundToPodId: null or id"]
    E -->|Returns| E4["Custom fields per type"]

    B -->|createMockConnection| F["Connection Factory"]
    F -->|Returns| F1["id: conn-1"]
    F -->|Returns| F2["sourcePodId: pod-1"]
    F -->|Returns| F3["targetPodId: pod-2"]
    F -->|Returns| F4["triggerMode: auto"]
    F -->|Returns| F5["status: idle"]

    B -->|createMockMessage| G["Message Factory"]
    G -->|Returns| G1["id: msg-1"]
    G -->|Returns| G2["role: user/assistant"]
    G -->|Returns| G3["content: text"]
    G -->|Returns| G4["isPartial: true/false"]
    G -->|Returns| G5["toolUse array"]

    B -->|createMockRequest| H["WebSocket Request Factory"]
    H -->|Returns| H1["requestId: generated"]
    H -->|Returns| H2["requestEvent: type"]
    H -->|Returns| H3["payload: object"]

    B -->|createMockResponse| I["WebSocket Response Factory"]
    I -->|Returns| I1["success: true/false"]
    I -->|Returns| I2["responseEvent: type"]
    I -->|Returns| I3["payload: object"]
```

---

## Test Coverage Summary

### Flow 1: Canvas/Pod Operations (18 test cases)
- Create Canvas (success, failure, validation)
- Create Pod (success, failure, validation)
- Set Pod Model (success, failure)
- Bind 5 Note Types (each: success, failure, edge cases)
- Create Connection (success, self-loop rejection, duplicate rejection)
- Update Trigger Mode (success, failure)
- Workflow Triggers (Auto, AI-Decide, Direct modes)
- Workflow Complete & Queue handling
- Pod Schedule (set, fire, animation)

### Flow 2: Chat Conversation (15 test cases)
- Open Pod Chat (connection check)
- Send Message (success, validation)
- Stream Reception (start, delta accumulation, end)
- Tool Use (request, result, error handling)
- Chat Complete (workflow trigger, AutoClear)
- History Loading (initial, load more, failure)
- Abort Chat

### Flow 3: Batch Operations (12 test cases)
- Box Selection (start, update, calculate, end, Ctrl mode)
- Copy (Pod + Note + Connection collection)
- Paste (create copies, rebind, recreate connections)
- Batch Drag (move, sync, rollback)
- Batch Delete (Pod/Note/Connection cascade)
- Undo operations (if implemented)

**Total: 45+ test scenarios**

---

## Mock Configuration Example

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  }
})

// tests/setup.ts
import { vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createPinia())

  vi.mock('@/services/websocket', () => ({
    createWebSocketRequest: vi.fn(),
    websocketClient: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      send: vi.fn(),
    },
    WebSocketRequestEvents: { /* ... */ },
    WebSocketResponseEvents: { /* ... */ },
  }))
})
```

---

## Testing Best Practices

1. **Mock Boundaries**: Always mock WebSocket and Toast at service layer
2. **Test Isolation**: Use factory functions for consistent test data
3. **State Management**: Test Store actions, getters, and state transitions separately
4. **Composable Testing**: Use `createPinia()` + `setActivePinia()` for each test
5. **Event Handling**: Verify both immediate effects and async event listeners
6. **Error Cases**: Test validation, network failures, and edge conditions
7. **Integration Points**: Verify Store ↔ Store interactions and WebSocket event chains
8. **Type Safety**: Leverage TypeScript for payload validation in tests
