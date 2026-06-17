import type { AIChatSession } from "@follow-app/client-sdk"

import type { ChatSession } from "~/modules/ai-chat/types/ChatSession"

export const isUnreadSession = (session: ChatSession | AIChatSession): boolean => {
  if (!("lastSeenAt" in session) || !("updatedAt" in session)) return false
  return new Date(session.updatedAt) > new Date(session.lastSeenAt)
}
