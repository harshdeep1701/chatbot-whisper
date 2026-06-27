// ── Chat Models ──────────────────────────────────────────
// Request / response shapes for /api/chat and /api/chat/quota

/** A single chat message (used in history arrays) */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

/** POST /api/chat request body */
export interface ChatRequest {
  message: string;
  conversationId?: string;
  history?: ChatMessage[];
}

/** POST /api/chat response */
export interface ChatResponse {
  reply: string;
  conversationId: string;
  success: boolean;
  error?: string;
}

/** GET /api/chat/quota response */
export interface QuotaInfo {
  userId: number;
  tier: string;
  remainingTokens: number;
  totalTokensUsed: number;
}
