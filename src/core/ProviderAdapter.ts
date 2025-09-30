/**
 * 提供與外部 AI 服務溝通的抽象介面，讓遊戲邏輯不必關心實際呼叫的 API 細節。
 */
export interface ProviderAdapter {
  /**
   * 將遊戲整理好的提示資料送出並期待取得 JSON 結果。
   */
  requestChatJSON(promptBundle: unknown): Promise<any>;

  /**
   * 回報目前是否具有足夠資訊可以呼叫外部服務，例如 API Key 是否存在。
   */
  isReady(): boolean;
}

/**
 * 針對網頁版本所設計的 OpenAI GPT 呼叫實作，會使用 Vite 的環境變數讀取 API 設定。
 */
export class WebProviderAdapter implements ProviderAdapter {
  /** 預設的 OpenAI Chat Completions API 位址。 */
  private static readonly DEFAULT_API_URL = 'https://api.openai.com/v1/chat/completions';

  /** 儲存 API Key，避免在多次呼叫時重複讀取環境變數。 */
  private readonly apiKey?: string;

  /** 可讓使用者覆寫的 API 位址，若未提供則使用預設值。 */
  private readonly apiUrl: string;

  /** 選擇呼叫的模型名稱，預設使用輕量級模型以降低成本。 */
  private readonly model: string;

  constructor(options?: { apiKey?: string; apiUrl?: string; model?: string }) {
    // 自 Vite 的環境變數讀取設定，並允許於建構時覆寫。
    this.apiKey = options?.apiKey ?? import.meta.env.VITE_OPENAI_API_KEY;
    this.apiUrl = options?.apiUrl ?? import.meta.env.VITE_OPENAI_API_URL ?? WebProviderAdapter.DEFAULT_API_URL;
    this.model = options?.model ?? import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  /**
   * 只要 API Key 為非空字串即可視為就緒；其餘狀況一律判定不可呼叫外部服務。
   */
  isReady(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * 將遊戲上下文整理為提示後送給 OpenAI Chat Completions API，並解析為 JSON 回傳。
   */
  async requestChatJSON(promptBundle: unknown): Promise<any> {
    if (!this.isReady()) {
      throw new Error('OpenAI API 尚未設定 API Key，請在環境變數 VITE_OPENAI_API_KEY 中提供。');
    }

    const payload = this.buildPayload(promptBundle);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API 回應失敗：${response.status} ${response.statusText} - ${errorText}`);
    }

    const json = (await response.json()) as OpenAIChatCompletionResponse;
    const rawContent = json.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('OpenAI API 沒有提供任何回覆內容。');
    }

    try {
      return JSON.parse(rawContent);
    } catch (error) {
      throw new Error(`OpenAI 回傳內容無法解析成 JSON：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 將遊戲提供的上下文整理為最終送出的請求格式，包含系統提示、使用者提示與 JSON Schema。
   */
  private buildPayload(promptBundle: unknown): OpenAIChatCompletionPayload {
    const contextText =
      typeof promptBundle === 'string' ? promptBundle : JSON.stringify(promptBundle, null, 2);

    const schema: OpenAIJSONSchema = {
      name: 'ghost_comm_response',
      schema: {
        type: 'object',
        required: ['tone', 'options'],
        properties: {
          tone: {
            type: 'string',
            description: '靈體在本回合對話中展現的語氣描述'
          },
          options: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: {
              type: 'object',
              required: ['text', 'type', 'targets', 'requires', 'effect'],
              properties: {
                text: {
                  type: 'string',
                  description: '顯示給玩家的對話內容'
                },
                type: {
                  type: 'string',
                  enum: ['安撫', '提問', '交換', '儀式', '指認']
                },
                targets: {
                  type: 'array',
                  items: { type: 'string' }
                },
                requires: {
                  type: 'array',
                  items: { type: 'string' }
                },
                effect: {
                  type: 'string',
                  enum: ['解結', '鬆動', '平煞', '條件交換', '觸怒']
                },
                hint: {
                  type: 'string'
                }
              },
              additionalProperties: false
            }
          }
        },
        additionalProperties: false
      }
    };

    return {
      model: this.model,
      temperature: 0.6,
      max_tokens: 700,
      response_format: {
        type: 'json_schema',
        json_schema: schema
      },
      messages: [
        {
          role: 'system',
          content:
            '你是一位民俗靈異劇情設計助手，請根據提供的靈體資料與世界狀態，產生能推動劇情的回應選項。請務必以指定的 JSON Schema 回傳資料。'
        },
        {
          role: 'user',
          content: `以下是本回合的遊戲上下文，請輸出 JSON：\n${contextText}`
        }
      ]
    };
  }
}

/**
 * OpenAI Chat Completions 回應的簡化型別定義，僅保留目前需要的欄位。
 */
interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * OpenAI Chat Completions 要求所需的 JSON Schema 格式型別。
 */
interface OpenAIJSONSchema {
  name: string;
  schema: Record<string, unknown>;
}

/**
 * 呼叫 Chat Completions API 時的請求負載定義。
 */
interface OpenAIChatCompletionPayload {
  model: string;
  temperature: number;
  max_tokens: number;
  response_format: {
    type: 'json_schema';
    json_schema: OpenAIJSONSchema;
  };
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
}
