import { useEffect, useState } from 'react'
import { controlCenterAPI as api } from '../api/control-center-api'
import {
  cloneAiBehavior,
  cloneAiConfig,
  cloneChatMessages,
  cloneImageGenerationConfig,
  defaultAiConfig,
  defaultImageGenerationConfig
} from '../lib/defaults'
import { downloadTextFile } from '../lib/download'
import { messageFromError } from '../lib/errors'
import type {
  AiBehaviorConfig,
  AiBehaviorResult,
  AiBehaviorRule,
  AiConfigViewState,
  ChatMessage,
  ImageGenerationConfigViewState
} from '../../../shared/openpet-contracts'
import type { AiPaneProps } from '../panes/AiPane'

const parseBehaviorRules = (rulesText: string): AiBehaviorRule[] => {
  const parsed: unknown = JSON.parse(rulesText || '[]')
  if (!Array.isArray(parsed)) throw new Error('Behavior rules must be a JSON array')
  return parsed as AiBehaviorRule[]
}

export function useAiPane() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<AiConfigViewState>(defaultAiConfig)
  const [imageGenerationConfig, setImageGenerationConfig] = useState<ImageGenerationConfigViewState>(defaultImageGenerationConfig)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [imageApiKeyDraft, setImageApiKeyDraft] = useState('')
  const [status, setStatus] = useState('')
  const [chatDraft, setChatDraft] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatting, setChatting] = useState(false)
  const [behavior, setBehavior] = useState<AiBehaviorConfig>(defaultAiConfig.behavior)
  const [behaviorRulesText, setBehaviorRulesText] = useState('[]')
  const [dryRunText, setDryRunText] = useState('')
  const [dryRunResult, setDryRunResult] = useState<AiBehaviorResult | null>(null)
  const [replayDraft, setReplayDraft] = useState('')
  const [replayResult, setReplayResult] = useState<AiBehaviorResult | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([
      api.getAiConfig(),
      api.getImageGenerationConfig(),
      api.getAiConversation('control-center'),
      api.getAiBehavior()
    ]).then(([loadedConfig, loadedImageGenerationConfig, loadedChatMessages, loadedBehavior]) => {
      if (!mounted) return
      setConfig(cloneAiConfig(loadedConfig))
      setImageGenerationConfig(cloneImageGenerationConfig(loadedImageGenerationConfig))
      setChatMessages(cloneChatMessages(loadedChatMessages))
      const nextBehavior = cloneAiBehavior(loadedBehavior || loadedConfig?.behavior)
      setBehavior(nextBehavior)
      setBehaviorRulesText(JSON.stringify(nextBehavior.rules || [], null, 2))
      setLoading(false)
    }).catch((error) => {
      if (!mounted) return
      setStatus(messageFromError(error, 'AI 配置加载失败'))
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const onSave = async () => {
    setSaving(true)
    setStatus('')
    try {
      const { behavior: _behavior, ...configWithoutBehavior } = config
      void _behavior
      const savedConfig = cloneAiConfig(await api.saveAiConfig(configWithoutBehavior))
      setConfig(savedConfig)
      setStatus('AI 配置已保存')
    } catch (error) {
      setStatus(messageFromError(error, '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const onSaveImageGeneration = async () => {
    setSaving(true)
    setStatus('')
    try {
      const savedConfig = cloneImageGenerationConfig(await api.saveImageGenerationConfig(imageGenerationConfig))
      setImageGenerationConfig(savedConfig)
      setStatus('图片生成配置已保存')
    } catch (error) {
      setStatus(messageFromError(error, '图片生成配置保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const onSaveBehavior = async () => {
    setSaving(true)
    setStatus('')
    try {
      const parsedRules = parseBehaviorRules(behaviorRulesText)
      const savedBehavior = cloneAiBehavior(await api.saveAiBehavior({ ...behavior, rules: parsedRules }))
      setBehavior(savedBehavior)
      setBehaviorRulesText(JSON.stringify(savedBehavior.rules || [], null, 2))
      setConfig({ ...config, behavior: savedBehavior })
      setStatus('Behavior 配置已保存')
    } catch (error) {
      setStatus(messageFromError(error, 'Behavior 配置保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const onDryRunBehavior = async () => {
    const reply = dryRunText.trim()
    if (!reply) return
    setStatus('')
    try {
      const parsedRules = parseBehaviorRules(behaviorRulesText)
      const result = await api.dryRunAiBehavior({ reply, behavior: { ...behavior, rules: parsedRules } })
      setDryRunResult(result)
      setStatus(result.matched ? `Dry run 命中：${result.reason}` : `Dry run 未命中：${result.reason}`)
    } catch (error) {
      setDryRunResult(null)
      setStatus(messageFromError(error, 'Dry run 失败'))
    }
  }

  const onReplayBehaviorDecision = async () => {
    const decisionId = Number(replayDraft.trim())
    if (!Number.isFinite(decisionId) || decisionId <= 0) {
      setStatus('请输入有效的决策 ID')
      return
    }
    setStatus('')
    try {
      const result = await api.replayAiBehaviorDecision(decisionId)
      setReplayResult(result)
      setStatus(result.matched ? `Replay 命中：${result.reason}` : `Replay 未命中：${result.reason}`)
    } catch (error) {
      setReplayResult(null)
      setStatus(messageFromError(error, 'Replay 失败'))
    }
  }

  const onExportBehaviorDiagnostics = async () => {
    setStatus('')
    try {
      const content = await api.exportAiBehaviorDiagnostics()
      downloadTextFile('openpet-ai-behavior-diagnostics.json', content, 'application/json;charset=utf-8')
      setStatus('Behavior 诊断已导出')
    } catch (error) {
      setStatus(messageFromError(error, 'Behavior 诊断导出失败'))
    }
  }

  const onClearBehaviorDecisions = async () => {
    if (!window.confirm('清空 AI 行为决策记录？')) return
    setStatus('')
    try {
      await api.clearAiBehaviorDecisions()
      const nextBehavior = cloneAiBehavior(await api.getAiBehavior())
      setBehavior(nextBehavior)
      setConfig({ ...config, behavior: nextBehavior })
      setReplayResult(null)
      setDryRunResult(null)
      setStatus('Behavior 决策已清空')
    } catch (error) {
      setStatus(messageFromError(error, '清空失败'))
    }
  }

  const onSaveApiKey = async () => {
    setSaving(true)
    setStatus('')
    try {
      const result = await api.saveAiApiKey(apiKeyDraft)
      setConfig({ ...config, hasApiKey: result.hasApiKey })
      setApiKeyDraft('')
      setStatus('API Key 已保存')
    } catch (error) {
      setStatus(messageFromError(error, '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const onSaveImageGenerationApiKey = async () => {
    setSaving(true)
    setStatus('')
    try {
      const result = await api.saveImageGenerationApiKey(imageApiKeyDraft)
      setImageGenerationConfig((current) => ({
        ...current,
        cloud: {
          ...current.cloud,
          hasApiKey: result.hasApiKey,
          apiKeyPreview: result.apiKeyPreview
        }
      }))
      setImageApiKeyDraft('')
      setStatus('图片 API Key 已保存')
    } catch (error) {
      setStatus(messageFromError(error, '图片 API Key 保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const onClearImageGenerationApiKey = async () => {
    setSaving(true)
    setStatus('')
    try {
      const result = await api.clearImageGenerationApiKey()
      setImageGenerationConfig((current) => ({
        ...current,
        cloud: {
          ...current.cloud,
          hasApiKey: result.hasApiKey,
          apiKeyPreview: result.apiKeyPreview
        }
      }))
      setImageApiKeyDraft('')
      setStatus('图片 API Key 已清除')
    } catch (error) {
      setStatus(messageFromError(error, '图片 API Key 清除失败'))
    } finally {
      setSaving(false)
    }
  }

  const onCheckImageGenerationHealth = async () => {
    setSaving(true)
    setStatus('')
    try {
      const result = await api.checkImageGenerationHealth({ backend: imageGenerationConfig.defaultBackend })
      setStatus(result.ok ? '图片模型健康检查通过' : (result.message || '图片模型健康检查失败'))
    } catch (error) {
      setStatus(messageFromError(error, '图片模型健康检查失败'))
    } finally {
      setSaving(false)
    }
  }

  const onTest = async () => {
    setSaving(true)
    setStatus('测试中')
    try {
      const result = await api.testAiConnection()
      setStatus(result.ok ? `连接正常：${result.reply}` : '连接失败')
    } catch (error) {
      setStatus(messageFromError(error, '连接失败'))
    } finally {
      setSaving(false)
    }
  }

  const onSendChat = async () => {
    const message = chatDraft.trim()
    if (!message || chatting) return
    const nextMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: message }]
    setChatMessages(nextMessages)
    setChatDraft('')
    setChatting(true)
    setStatus('')
    try {
      const result = await api.chat({ conversationId: 'control-center', message })
      setChatMessages(Array.isArray(result.messages)
        ? cloneChatMessages(result.messages)
        : [...nextMessages, { role: 'assistant', content: result.reply }])
      if (result.action?.actionId) {
        setStatus(result.action.error
          ? `动作触发失败：${result.action.error}`
          : `已触发动作：${result.action.label || result.action.actionId}`)
      }
      const nextBehavior = cloneAiBehavior(await api.getAiBehavior())
      setBehavior(nextBehavior)
      setConfig((current) => ({ ...current, behavior: nextBehavior }))
    } catch (error) {
      setStatus(messageFromError(error, '发送失败'))
    } finally {
      setChatting(false)
    }
  }

  const paneProps = {
    config,
    imageGenerationConfig,
    saving,
    status,
    apiKeyDraft,
    setApiKeyDraft,
    imageApiKeyDraft,
    setImageApiKeyDraft,
    chatDraft,
    setChatDraft,
    chatMessages,
    chatting,
    behavior,
    behaviorRulesText,
    dryRunText,
    dryRunResult,
    replayDraft,
    replayResult,
    setDryRunText,
    setReplayDraft,
    setBehaviorRulesText,
    onChangeBehavior: (partial: Partial<AiBehaviorConfig>) => setBehavior({ ...behavior, ...partial }),
    onChange: (partial: Partial<AiConfigViewState>) => setConfig({ ...config, ...partial }),
    onChangeImageGeneration: (partial: Partial<ImageGenerationConfigViewState>) => setImageGenerationConfig((current) => cloneImageGenerationConfig({
      ...current,
      ...partial,
      cloud: {
        ...current.cloud,
        ...(partial.cloud || {})
      },
      local: {
        ...current.local,
        ...(partial.local || {})
      }
    })),
    onSave,
    onSaveImageGeneration,
    onSaveBehavior,
    onSaveApiKey,
    onSaveImageGenerationApiKey,
    onClearImageGenerationApiKey,
    onCheckImageGenerationHealth,
    onTest,
    onDryRunBehavior,
    onReplayBehaviorDecision,
    onExportBehaviorDiagnostics,
    onClearBehaviorDecisions,
    onSendChat
  } satisfies AiPaneProps

  return { loading, paneProps }
}
