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
import type {
  EmbeddingProviderPreset,
  UserEmbeddingProviderConfig,
} from "@follow/shared/settings/interface"
import type { FormEvent } from "react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  EMBEDDING_PROVIDER_PRESETS,
  getEmbeddingDefaultConfig,
  getEmbeddingProviderPreset,
} from "./constants"

interface EmbeddingProviderModalContentProps {
  provider: UserEmbeddingProviderConfig | null
  onSave: (provider: UserEmbeddingProviderConfig) => void
  onCancel: () => void
}

export const EmbeddingProviderModalContent = ({
  provider,
  onSave,
  onCancel,
}: EmbeddingProviderModalContentProps) => {
  const { t } = useTranslation("ai")
  const initialPreset = provider?.preset ?? "siliconflow"

  const [formData, setFormData] = useState<UserEmbeddingProviderConfig>(() => ({
    ...(provider ?? getEmbeddingDefaultConfig(initialPreset)),
  }))

  const selectedPreset = useMemo(
    () => getEmbeddingProviderPreset(formData.preset),
    [formData.preset],
  )

  const handlePresetChange = (value: string) => {
    const preset = value as EmbeddingProviderPreset
    const defaults = getEmbeddingDefaultConfig(preset)
    setFormData((prev) => ({
      ...prev,
      preset,
      baseURL: defaults.baseURL,
      model: defaults.model,
      dimension: defaults.dimension,
    }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSave({
      ...formData,
      baseURL: formData.baseURL || selectedPreset?.defaultBaseURL || "",
      model: formData.model || selectedPreset?.defaultModel || "",
      dimension: formData.dimension || selectedPreset?.dimension || 1024,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-[40ch] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="embedding-preset">{t("embedding.providers.form.preset")}</Label>
        <Select value={formData.preset} onValueChange={handlePresetChange}>
          <SelectTrigger id="embedding-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMBEDDING_PROVIDER_PRESETS.map((option) => (
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
        <Label htmlFor="embedding-base-url">{t("embedding.providers.form.base_url")}</Label>
        <Input
          id="embedding-base-url"
          value={formData.baseURL}
          placeholder={
            selectedPreset?.defaultBaseURL ?? t("embedding.providers.form.base_url_placeholder")
          }
          onChange={(event) => setFormData((prev) => ({ ...prev, baseURL: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="embedding-model">{t("embedding.providers.form.model")}</Label>
        <Input
          id="embedding-model"
          value={formData.model}
          placeholder={
            selectedPreset?.defaultModel ?? t("embedding.providers.form.model_placeholder")
          }
          onChange={(event) => setFormData((prev) => ({ ...prev, model: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="embedding-dimension">{t("embedding.providers.form.dimension")}</Label>
        <Input
          id="embedding-dimension"
          type="number"
          min={1}
          value={formData.dimension}
          onChange={(event) =>
            setFormData((prev) => ({
              ...prev,
              dimension: Number.parseInt(event.target.value, 10) || prev.dimension,
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="embedding-api-key">{t("embedding.providers.form.api_key")}</Label>
        <Input
          id="embedding-api-key"
          type="password"
          value={formData.apiKey ?? ""}
          placeholder={t("embedding.providers.form.api_key_placeholder")}
          onChange={(event) =>
            setFormData((prev) => ({ ...prev, apiKey: event.target.value || null }))
          }
        />
        <p className="text-xs text-text-secondary">{t("embedding.providers.form.api_key_help")}</p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("words.cancel", { ns: "common" })}
        </Button>
        <Button type="submit">{t("words.save", { ns: "common" })}</Button>
      </div>
    </form>
  )
}
