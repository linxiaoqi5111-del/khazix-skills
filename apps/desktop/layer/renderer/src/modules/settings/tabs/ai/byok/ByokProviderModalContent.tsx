import { Button } from "@follow/components/ui/button/index.js"
import { Input } from "@follow/components/ui/input/index.js"
import { Label } from "@follow/components/ui/label/index.jsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@follow/components/ui/select/index.js"
import type { ByokProviderName, UserByokProviderConfig } from "@follow/shared/settings/interface"
import type { FormEvent } from "react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  getProviderDefaultBaseURL,
  getProviderDefaultModel,
  getProviderModelOptions,
  getProviderOption,
  PROVIDER_OPTIONS,
} from "./constants"

interface ByokProviderModalContentProps {
  provider: UserByokProviderConfig | null
  configuredProviders?: ByokProviderName[]
  onSave: (provider: UserByokProviderConfig) => void
  onCancel: () => void
}

const EMPTY_CONFIGURED_PROVIDERS: ByokProviderName[] = []

export const ByokProviderModalContent = ({
  provider,
  configuredProviders = EMPTY_CONFIGURED_PROVIDERS,
  onSave,
  onCancel,
}: ByokProviderModalContentProps) => {
  const { t } = useTranslation("ai")

  // Filter out already configured providers, but keep the current one if editing
  const availableProviders = PROVIDER_OPTIONS.filter(
    (option) => !configuredProviders.includes(option.value) || option.value === provider?.provider,
  )

  // Get the first available provider or fallback to the current one
  const defaultProvider = availableProviders[0]?.value ?? provider?.provider ?? "openai"

  const initialProvider = provider?.provider ?? defaultProvider

  const [formData, setFormData] = useState<UserByokProviderConfig>(() => ({
    provider: initialProvider,
    baseURL: provider?.baseURL ?? (getProviderDefaultBaseURL(initialProvider) || null),
    apiKey: provider?.apiKey ?? null,
    model: provider?.model ?? (getProviderDefaultModel(initialProvider) || null),
    headers: provider?.headers ?? {},
  }))

  const selectedProviderOption = useMemo(
    () => getProviderOption(formData.provider),
    [formData.provider],
  )

  const selectedProviderDefaultBaseURL = selectedProviderOption?.defaultBaseURL ?? ""
  const selectedProviderDefaultModel = selectedProviderOption?.defaultModel ?? ""
  const modelDatalistId = `byok-model-options-${formData.provider}`
  const modelOptions = getProviderModelOptions(formData.provider)

  const handleProviderChange = (value: string) => {
    const nextProvider = value as ByokProviderName
    setFormData((prev) => ({
      ...prev,
      provider: nextProvider,
      baseURL: getProviderDefaultBaseURL(nextProvider) || null,
      model: getProviderDefaultModel(nextProvider) || null,
    }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!formData.provider) {
      return
    }
    onSave({
      ...formData,
      baseURL: formData.baseURL || getProviderDefaultBaseURL(formData.provider) || null,
      model: formData.model || getProviderDefaultModel(formData.provider) || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-[40ch] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="provider">{t("byok.providers.form.provider")}</Label>
        <Select
          value={formData.provider}
          disabled={availableProviders.length === 0}
          onValueChange={handleProviderChange}
        >
          <SelectTrigger id="provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableProviders.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex items-center gap-2">
                  <i className={`${option.iconClassName} size-4 text-text-secondary`} />
                  <span>{option.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="baseURL">{t("byok.providers.form.base_url")}</Label>
          {!!selectedProviderDefaultBaseURL &&
            formData.baseURL !== selectedProviderDefaultBaseURL && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                buttonClassName="h-6 px-2"
                textClassName="text-xs"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    baseURL: selectedProviderDefaultBaseURL,
                  }))
                }
              >
                {t("byok.providers.form.use_default_base_url")}
              </Button>
            )}
        </div>
        <Input
          id="baseURL"
          type="url"
          placeholder={t("byok.providers.form.base_url_placeholder")}
          value={formData.baseURL ?? ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              baseURL: e.target.value || null,
            })
          }
        />
        <p className="text-xs text-text-secondary">{t("byok.providers.form.base_url_help")}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="model">{t("byok.providers.form.model")}</Label>
          {!!selectedProviderDefaultModel && formData.model !== selectedProviderDefaultModel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              buttonClassName="h-6 px-2"
              textClassName="text-xs"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  model: selectedProviderDefaultModel,
                }))
              }
            >
              {t("byok.providers.form.use_default_model")}
            </Button>
          )}
        </div>
        <Input
          id="model"
          list={modelDatalistId}
          placeholder={t("byok.providers.form.model_placeholder")}
          value={formData.model ?? ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              model: e.target.value || null,
            })
          }
        />
        {modelOptions.length > 0 && (
          <datalist id={modelDatalistId}>
            {modelOptions.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        )}
        <p className="text-xs text-text-secondary">{t("byok.providers.form.model_help")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiKey">{t("byok.providers.form.api_key")}</Label>
        <Input
          id="apiKey"
          type="password"
          placeholder={t("byok.providers.form.api_key_placeholder")}
          value={formData.apiKey ?? ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              apiKey: e.target.value || null,
            })
          }
        />
        <p className="text-xs text-text-secondary">{t("byok.providers.form.api_key_help")}</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("words.cancel", { ns: "common" })}
        </Button>
        <Button type="submit">{t("words.save", { ns: "common" })}</Button>
      </div>
    </form>
  )
}
