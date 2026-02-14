'use client'

import { useState, useTransition } from 'react'

interface SettingsPanelProps {
  autoScanEnabled: boolean
  autoScanFrequency: string
  digestEmailEnabled: boolean
}

export function SettingsPanel({ autoScanEnabled: initialAutoScan, autoScanFrequency: initialFreq, digestEmailEnabled: initialDigest }: SettingsPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [autoScan, setAutoScan] = useState(initialAutoScan)
  const [frequency, setFrequency] = useState(initialFreq)
  const [digest, setDigest] = useState(initialDigest)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  async function saveSettings(updates: Record<string, unknown>) {
    const res = await fetch('/api/v1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  function handleToggleAutoScan() {
    const newValue = !autoScan
    setAutoScan(newValue)
    startTransition(() => {
      saveSettings({ auto_scan_enabled: newValue })
    })
  }

  function handleToggleDigest() {
    const newValue = !digest
    setDigest(newValue)
    startTransition(() => {
      saveSettings({ digest_email_enabled: newValue })
    })
  }

  function handleFrequencyChange(newFreq: string) {
    setFrequency(newFreq)
    startTransition(() => {
      saveSettings({ auto_scan_frequency: newFreq })
    })
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 text-[#9898b0]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          <span className="text-sm font-medium text-[#0f0f23]">Settings</span>
          {saved && (
            <span className="text-xs text-emerald-600 animate-fade-in-up">Saved</span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-[#9898b0] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-black/[0.04] px-5 py-4 space-y-4">
          {/* Auto-scan toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#0f0f23]">Auto-scan my inbox</p>
              <p className="text-xs text-[#9898b0]">Automatically scan for new emails to categorize</p>
            </div>
            <button
              onClick={handleToggleAutoScan}
              disabled={isPending}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                autoScan ? 'bg-indigo-500' : 'bg-black/10'
              } disabled:opacity-50`}
              role="switch"
              aria-checked={autoScan}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  autoScan ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Frequency selector */}
          {autoScan && (
            <div className="flex items-center justify-between pl-4">
              <p className="text-sm text-[#64648a]">Scan frequency</p>
              <div className="flex gap-2">
                {(['weekly', 'daily'] as const).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => handleFrequencyChange(freq)}
                    disabled={isPending}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      frequency === freq
                        ? 'bg-indigo-500/10 text-indigo-700 border border-indigo-500/20'
                        : 'bg-black/[0.03] text-[#9898b0] border border-black/[0.04] hover:text-[#64648a]'
                    }`}
                  >
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Digest toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#0f0f23]">Weekly digest email</p>
              <p className="text-xs text-[#9898b0]">Get a summary of emails to clean up</p>
            </div>
            <button
              onClick={handleToggleDigest}
              disabled={isPending}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                digest ? 'bg-indigo-500' : 'bg-black/10'
              } disabled:opacity-50`}
              role="switch"
              aria-checked={digest}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  digest ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
