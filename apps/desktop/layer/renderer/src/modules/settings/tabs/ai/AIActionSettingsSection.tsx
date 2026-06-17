import { ResponsiveSelect } from "@follow/components/ui/select/responsive.js"
import { ACTION_LANGUAGE_MAP } from "@follow/shared"
import type { GeneralSettings } from "@follow/shared/settings/interface"
import { useTranslation } from "react-i18next"

import { defaultResources } from "~/@types/default-resource"
import {
  DEFAULT_ACTION_LANGUAGE,
  setGeneralSetting,
  useGeneralSettingKey,
  useGeneralSettingValue,
} from "~/atoms/settings/general"
import { setTranslationCache } from "~/modules/entry-content/atoms"

import { SettingRow } from "../../control"
import { createSetting } from "../../helper/builder"
import {
  useWrapEnhancedSettingItem,
  WrapEnhancedSettingTab,
} from "../../hooks/useWrapEnhancedSettingItem"
import { SettingItemGroup } from "../../section"

const { defineSettingItem: defineGeneralSettingItem, SettingBuilder: GeneralSettingBuilder } =
  createSetting("general", useGeneralSettingValue, setGeneralSetting)

export const AIActionSettingsSection = () => {
  const { t } = useTranslation("settings")
  const defineSettingItem = useWrapEnhancedSettingItem(
    defineGeneralSettingItem,
    WrapEnhancedSettingTab.General,
  )

  return (
    <GeneralSettingBuilder
      settings={[
        {
          type: "title",
          value: t("general.action.title"),
        },
        defineSettingItem("summary", {
          label: t("general.action.summary.label"),
          description: t("general.action.summary.description"),
        }),
        defineSettingItem("autoTag", {
          label: t("general.action.auto_tag.label"),
          description: t("general.action.auto_tag.description"),
        }),
        defineSettingItem("qualityScore", {
          label: t("general.action.quality_score.label"),
          description: t("general.action.quality_score.description"),
        }),
        defineSettingItem("translation", {
          label: t("general.action.translation.label"),
          description: t("general.action.translation.description"),
        }),
        TranslationModeSelector,
        ActionLanguageSelector,
      ]}
    />
  )
}

const TranslationModeSelector = () => {
  const { t } = useTranslation("settings")
  const translationMode = useGeneralSettingKey("translationMode")

  return (
    <SettingItemGroup>
      <SettingRow
        label={t("general.translation_mode.label")}
        description={t("general.translation_mode.description")}
      >
        <ResponsiveSelect
          size="sm"
          triggerClassName="w-48 shrink-0"
          defaultValue={translationMode}
          value={translationMode}
          onValueChange={(value) => {
            setGeneralSetting("translationMode", value as GeneralSettings["translationMode"])
          }}
          items={[
            { label: t("general.translation_mode.bilingual"), value: "bilingual" },
            { label: t("general.translation_mode.translation-only"), value: "translation-only" },
          ]}
        />
      </SettingRow>
    </SettingItemGroup>
  )
}

const ActionLanguageSelector = () => {
  const { t } = useTranslation("settings")
  const actionLanguage = useGeneralSettingKey("actionLanguage")

  return (
    <SettingItemGroup>
      <SettingRow
        label={t("general.action_language.label")}
        description={t("general.action_language.description")}
      >
        <ResponsiveSelect
          size="sm"
          triggerClassName="w-48 shrink-0"
          defaultValue={actionLanguage}
          value={actionLanguage}
          onValueChange={(value) => {
            setGeneralSetting("actionLanguage", value)
            setTranslationCache({})
          }}
          items={[
            { label: t("general.action_language.default"), value: DEFAULT_ACTION_LANGUAGE },
            ...Object.values(ACTION_LANGUAGE_MAP).map((item) => ({
              label: defaultResources[item.value].lang.name,
              value: item.value,
            })),
          ]}
        />
      </SettingRow>
    </SettingItemGroup>
  )
}
