import { ActionButton } from "@follow/components/ui/button/index.js"
import type { ReactNode } from "react"
import { startTransition, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu/dropdown-menu"
import { useChatHistory } from "~/modules/ai-chat/hooks/useChatHistory"

import { EmptyState, isUnreadSession, SessionItem, useChatSessionHandlers } from "./shared"

interface ChatHistoryDropdownProps {
  triggerElement?: ReactNode
  asChild?: boolean
}

export const ChatHistoryDropdown = ({
  triggerElement,
  asChild = true,
}: ChatHistoryDropdownProps) => {
  const { t } = useTranslation("ai")
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null)
  const { sessions, loading, loadHistory } = useChatHistory()

  const hasUnreadSessions = sessions.some((s) => isUnreadSession(s))

  const { handleSessionSelect, handleDeleteSession } = useChatSessionHandlers({
    sessions,
  })

  const handleDropdownOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        startTransition(() => {
          loadHistory()
        })
      }
    },
    [loadHistory],
  )

  const defaultTrigger = (
    <ActionButton tooltip={t("chat.history.title")} className="relative">
      <i className="i-focal-history size-5 text-text-secondary" />
      {hasUnreadSessions && (
        <span
          className="absolute right-1 top-1 block size-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-bg-default)] dark:shadow-[0_0_0_2px_var(--color-bg-default)]"
          aria-label={t("chat.history.unread_messages")}
        />
      )}
    </ActionButton>
  )

  return (
    <DropdownMenu onOpenChange={handleDropdownOpen}>
      <DropdownMenuTrigger asChild={asChild}>
        {triggerElement || defaultTrigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <div className="max-h-80 overflow-y-auto">
          {loading && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <i className="i-focal-loading-3 size-5 animate-spin text-text-secondary" />
            </div>
          ) : sessions.length > 0 ? (
            <>
              <div className="mb-1.5 px-2 py-1">
                <p className="text-xs font-medium text-text-secondary">Recent Chats</p>
              </div>
              {sessions.map((session) => (
                <SessionItem
                  key={session.chatId}
                  session={session}
                  onClick={() => handleSessionSelect(session)}
                  onDelete={(e) => {
                    handleDeleteSession(session.chatId, {
                      event: e,
                      onBeforeDelete: () => setLoadingChatId(session.chatId),
                    }).finally(() => {
                      setLoadingChatId(null)
                    })
                  }}
                  isLoading={loadingChatId === session.chatId}
                />
              ))}
            </>
          ) : (
            <EmptyState message="No chat history yet" />
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
