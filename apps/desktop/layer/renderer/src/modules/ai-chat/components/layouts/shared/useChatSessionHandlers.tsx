import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useDialog } from "~/components/ui/modal/stacked/hooks"
import { useTimelineSummaryAutoContext } from "~/modules/ai-chat/hooks/useTimelineSummaryAutoContext"
import { AIPersistService } from "~/modules/ai-chat/services"
import { useChatActions, useCurrentChatId } from "~/modules/ai-chat/store/hooks"
import type { ChatSession } from "~/modules/ai-chat/types/ChatSession"

export interface UseChatSessionHandlersProps {
  sessions?: ChatSession[]
}

export const useChatSessionHandlers = ({ sessions = [] }: UseChatSessionHandlersProps) => {
  const { t } = useTranslation("ai")
  const chatActions = useChatActions()
  const currentChatId = useCurrentChatId()
  const shouldDisableTimelineSummary = useTimelineSummaryAutoContext()
  const { ask } = useDialog()

  const handleSessionSelect = useCallback(
    async (session: ChatSession) => {
      if (session.chatId === currentChatId) {
        console.warn("Session already active, no action taken")
        return
      }

      if (shouldDisableTimelineSummary) {
        chatActions.setTimelineSummaryManualOverride(true)
      }
      chatActions.switchToChat(session.chatId)
    },
    [chatActions, currentChatId, shouldDisableTimelineSummary],
  )

  const handleDeleteSession = useCallback(
    async (
      chatId: string,
      options: {
        event?: React.MouseEvent
        onBeforeDelete?: () => void
      } = {},
    ) => {
      options.event?.stopPropagation()
      options.event?.preventDefault()

      const session = sessions?.find((s) => s.chatId === chatId)
      if (!session) return

      const confirm = await ask({
        title: t("delete_chat"),
        message: t("delete_chat_message", {
          title: session.title || t("chat.history.untitled"),
        }),
        variant: "danger",
      })

      if (!confirm) return
      options.onBeforeDelete?.()

      try {
        await AIPersistService.deleteSession(chatId)

        toast.success(t("delete_chat_success"))

        if (chatId === currentChatId) {
          if (shouldDisableTimelineSummary) {
            chatActions.setTimelineSummaryManualOverride(true)
          }
          chatActions.newChat()
        }
      } catch (error) {
        console.error("Failed to delete session:", error)
        toast.error(t("delete_chat_error"))
      }
    },
    [sessions, ask, t, currentChatId, chatActions, shouldDisableTimelineSummary],
  )

  return {
    handleSessionSelect,
    handleDeleteSession,
  }
}
