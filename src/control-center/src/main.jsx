import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const tabs = [
  { id: 'pet', label: 'Pet' },
  { id: 'actions', label: 'Actions' },
  { id: 'ai', label: 'AI' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'service', label: 'Service' },
  { id: 'about', label: 'About' }
]

const speedOptions = [
  { label: '慢', value: 1 },
  { label: '中', value: 2 },
  { label: '快', value: 3 }
]

const walkDurationOptions = [
  { label: '10秒', value: 10000 },
  { label: '15秒', value: 15000 },
  { label: '30秒', value: 30000 },
  { label: '60秒', value: 60000 }
]

const bubbleDurationOptions = [
  { label: '短', value: 800 },
  { label: '中', value: 1300 },
  { label: '长', value: 2000 }
]

const defaultSettings = {
  scale: 1,
  walkSpeed: 2,
  walkDuration: 15000,
  bubbleDuration: 1300,
  autoStart: false
}

const api = window.controlCenterAPI || {
  getSettings: async () => defaultSettings,
  saveSettings: async (settings) => settings,
  previewScale: () => {},
  close: () => {}
}

const cloneSettings = (settings) => ({ ...defaultSettings, ...settings })

function SegmentedControl({ label, value, options, onChange }) {
  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'active' : ''}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      className={checked ? 'toggle on' : 'toggle'}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}

function PetSettings({ settings, originalSettings, onChange, onSave, onReset, saving }) {
  const scalePercent = Math.round(settings.scale * 100)

  return (
    <section className="pane">
      <header className="pane-header">
        <div>
          <h1>Pet</h1>
          <p>当前宠物行为配置</p>
        </div>
        <div className="header-actions">
          <button type="button" className="ghost" onClick={onReset} disabled={saving}>
            还原
          </button>
          <button type="button" className="primary" onClick={onSave} disabled={saving}>
            {saving ? '保存中' : '保存'}
          </button>
        </div>
      </header>

      <div className="section">
        <div className="field-row">
          <div>
            <div className="field-label">宠物大小</div>
            <div className="field-note">{scalePercent}%</div>
          </div>
          <input
            className="range"
            type="range"
            min="50"
            max="150"
            step="5"
            value={scalePercent}
            onChange={(event) => onChange({ scale: Number(event.target.value) / 100 }, true)}
          />
        </div>

        <SegmentedControl
          label="散步速度"
          value={settings.walkSpeed}
          options={speedOptions}
          onChange={(walkSpeed) => onChange({ walkSpeed })}
        />
        <SegmentedControl
          label="散步时长"
          value={settings.walkDuration}
          options={walkDurationOptions}
          onChange={(walkDuration) => onChange({ walkDuration })}
        />
        <SegmentedControl
          label="气泡显示时长"
          value={settings.bubbleDuration}
          options={bubbleDurationOptions}
          onChange={(bubbleDuration) => onChange({ bubbleDuration })}
        />

        <div className="field-row">
          <div className="field-label">开机自启</div>
          <Toggle checked={settings.autoStart} onChange={(autoStart) => onChange({ autoStart })} />
        </div>
      </div>

      <div className="status-line">
        原始大小 {Math.round(originalSettings.scale * 100)}%
      </div>
    </section>
  )
}

function PlaceholderPane({ title, rows }) {
  return (
    <section className="pane">
      <header className="pane-header">
        <div>
          <h1>{title}</h1>
          <p>待接入</p>
        </div>
      </header>
      <div className="section compact">
        {rows.map((row) => (
          <div className="readonly-row" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('pet')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState(defaultSettings)
  const [originalSettings, setOriginalSettings] = useState(defaultSettings)
  const originalRef = useRef(defaultSettings)

  useEffect(() => {
    let mounted = true
    api.getSettings().then((loadedSettings) => {
      if (!mounted) return
      const nextSettings = cloneSettings(loadedSettings)
      originalRef.current = nextSettings
      setSettings(nextSettings)
      setOriginalSettings(nextSettings)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const restorePreview = () => api.previewScale(originalRef.current.scale)
    window.addEventListener('beforeunload', restorePreview)
    return () => window.removeEventListener('beforeunload', restorePreview)
  }, [])

  const page = useMemo(() => {
    if (activeTab === 'pet') {
      return (
        <PetSettings
          settings={settings}
          originalSettings={originalSettings}
          saving={saving}
          onChange={(partial, previewScale) => {
            const nextSettings = { ...settings, ...partial }
            setSettings(nextSettings)
            if (previewScale) api.previewScale(nextSettings.scale)
          }}
          onSave={async () => {
            setSaving(true)
            const savedSettings = cloneSettings(await api.saveSettings(settings))
            originalRef.current = savedSettings
            setOriginalSettings(savedSettings)
            setSettings(savedSettings)
            setSaving(false)
          }}
          onReset={() => {
            const restoredSettings = cloneSettings(originalRef.current)
            setSettings(restoredSettings)
            api.previewScale(restoredSettings.scale)
          }}
        />
      )
    }
    if (activeTab === 'actions') {
      return <PlaceholderPane title="Actions" rows={[
        { label: '动作帧导入', value: 'Phase 4' },
        { label: 'Pet pack', value: '已定义' },
        { label: '预览器', value: '待接入' }
      ]} />
    }
    if (activeTab === 'ai') {
      return <PlaceholderPane title="AI" rows={[
        { label: 'Provider', value: '待配置' },
        { label: 'API Key', value: '未保存' },
        { label: '聊天', value: '未启用' }
      ]} />
    }
    if (activeTab === 'plugins') {
      return <PlaceholderPane title="Plugins" rows={[
        { label: '已安装', value: '0' },
        { label: '权限模型', value: '待接入' },
        { label: '官方插件', value: '待接入' }
      ]} />
    }
    if (activeTab === 'service') {
      return <PlaceholderPane title="Service" rows={[
        { label: 'HTTP API', value: '未启用' },
        { label: 'MCP', value: '未启用' },
        { label: '监听地址', value: '127.0.0.1' }
      ]} />
    }
    return <PlaceholderPane title="About" rows={[
      { label: 'Electron', value: '42.4.0' },
      { label: 'Control Center', value: 'Phase 3' },
      { label: 'Runtime contract', value: 'Phase 2' }
    ]} />
  }, [activeTab, originalSettings, saving, settings])

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>ibot</strong>
          <span>Control Center</span>
        </div>
        <nav className="nav" aria-label="Control Center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="content">
        {loading ? <div className="loading">加载中</div> : page}
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
