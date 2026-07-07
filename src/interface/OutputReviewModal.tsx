import { useState, useEffect } from 'react'
import { useCoreStore } from '../integration/store/coreStore'
import { useActiveTeam } from '../integration/store/teamStore'
import { useSceneManager } from '../simulation/SceneContext'
import {
  Sparkles,
  Settings2,
  Image as ImageIcon,
  Video,
  Music,
  Type,
  X,
  Check,
  Monitor,
  Clock,
  Maximize,
  Volume2,
  AlertCircle
} from 'lucide-react'
import { getAvailableModels, normalizeProviderId } from '../core/llm/constants'
import { useUiStore } from '../integration/store/uiStore'
import { InfoBubble } from './components/InfoBubble'
import CustomSelect from './components/CustomSelect'

export function OutputReviewModal() {
  const {
    isReviewingOutput,
    setReviewingOutput,
    pendingOutputPrompt,
    pendingOutputParams,
    resetProject,
    referenceImages
  } = useCoreStore()

  const activeTeam = useActiveTeam()
  const { llmConfig } = useUiStore()
  const providerModels = getAvailableModels(normalizeProviderId(llmConfig.provider))
  const scene = useSceneManager()
  const [prompt, setPrompt] = useState(pendingOutputPrompt)
  const [params, setParams] = useState(pendingOutputParams)
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)

  // Sync internal state when store changes
  useEffect(() => {
    if (isReviewingOutput) {
      setPrompt(pendingOutputPrompt)
      setParams(pendingOutputParams)
      setIsConfirmingReset(false)
    }
  }, [isReviewingOutput, pendingOutputPrompt, pendingOutputParams])

  if (!isReviewingOutput) return null

  const handleGenerate = async () => {
    const brain = scene?.getLeadBrain()
    if (brain) {
      // Trigger the actual generation
      await brain.processFinalAsset(prompt, params)
    }
  }

  const handleCancelAndReset = () => {
    setIsConfirmingReset(true)
  }

  const confirmReset = () => {
    resetProject()
    setIsConfirmingReset(false)
    setReviewingOutput(false)
  }

  const updateParam = (key: string, value: any) => {
    setParams((prev: any) => ({ ...prev, [key]: value }))
  }

  const renderImageControls = () => (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
          <Maximize size={12} /> Aspect Ratio
          <InfoBubble text="The horizontal or vertical proportions of the generated asset." />
        </label>
        <CustomSelect
          value={params.aspectRatio || '16:9'}
          onChange={(v) => updateParam('aspectRatio', v)}
          options={[
            { value: '1:1', label: '1:1 Square' },
            { value: '16:9', label: '16:9 Cinematic' },
            { value: '9:16', label: '9:16 Vertical' },
            { value: '4:3', label: '4:3 Classic' },
            { value: '3:2', label: '3:2 Professional' },
          ]}
          className="rounded-xl px-3 py-2 text-xs"
          aria-label="Aspect Ratio"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
          <Settings2 size={12} /> Image Size
          <InfoBubble text="Target dimensions for the final image. Higher sizes offer more detail but may take longer." />
        </label>
        <CustomSelect
          value={params.imageSize || '1K'}
          onChange={(v) => updateParam('imageSize', v)}
          options={[
            { value: '512', label: '512px (Fast)' },
            { value: '1K', label: '1K (Standard)' },
            { value: '2K', label: '2K (High Res)' },
            { value: '4K', label: '4K (Ultra)' },
          ]}
          className="rounded-xl px-3 py-2 text-xs"
          aria-label="Image Size"
        />
      </div>
    </div>
  )

  const renderVideoControls = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <Monitor size={12} /> Resolution
            <InfoBubble text="Video output quality. Higher resolutions increase visual fidelity and processing requirements." />
          </label>
          <CustomSelect
            value={params.resolution || '720p'}
            onChange={(v) => updateParam('resolution', v)}
            options={[
              { value: '720p', label: '720p HD' },
              { value: '1080p', label: '1080p Full HD' },
              { value: '4k', label: '4K Vision' },
            ]}
            className="rounded-xl px-3 py-2 text-xs"
            aria-label="Resolution"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <Clock size={12} /> Duration
            <InfoBubble text="Total runtime of the generated video clip." />
          </label>
          <CustomSelect
            value={String(params.durationSeconds || 4)}
            onChange={(v) => updateParam('durationSeconds', parseInt(v, 10))}
            options={[
              { value: '4', label: '4 Seconds' },
              { value: '6', label: '6 Seconds' },
              { value: '8', label: '8 Seconds' },
            ]}
            className="rounded-xl px-3 py-2 text-xs"
            aria-label="Duration"
          />
        </div>
      </div>
    </div>
  )

  const renderModelControl = () => {
    const type = activeTeam.outputType === 'music' ? 'music' : activeTeam.outputType
    const models = providerModels[type as keyof typeof providerModels] || []

    return (
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
          <Sparkles size={12} /> Generation Model
          <InfoBubble text="Select the specific Gemini model used for the final generation. Flash models are faster, Pro models are more capable." />
        </label>
        <CustomSelect
          value={params.model || activeTeam.outputModel}
          onChange={(v) => updateParam('model', v)}
          options={models.map((m) => ({ value: m, label: m }))}
          className="rounded-xl px-3 py-2 text-xs font-medium"
          aria-label="Generation Model"
        />
      </div>
    )
  }

  const Icon = {
    image: ImageIcon,
    video: Video,
    music: Music,
    text: Type
  }[activeTeam.outputType] || Sparkles

  return (
    <div className="fixed inset-0 z-[650]">
      <button
        type="button"
        className="absolute inset-0 z-0 bg-black/30 backdrop-blur-md border-0 p-0 cursor-default"
        onClick={handleCancelAndReset}
        aria-label="Close dialog"
      />
      <div className="absolute inset-0 z-10 flex items-center justify-center p-4 pointer-events-none">
      <div
        className="glass-panel-elevated rounded-[var(--apple-radius-lg)] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-modal-in pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b theme-panel" style={{ borderColor: 'var(--apple-border)' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-appleBlue/10 flex items-center justify-center text-appleBlue">
              <Icon size={24} />
            </div>
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-[var(--apple-text)]">
                Review & Optimize Output
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                The lead agent has synthesized the team's work. Fine-tune it before final generation.
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelAndReset}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-all active:scale-90"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 theme-muted">
          {/* Prompt Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                PROMPT / CONTENT
              </label>
              <div className="px-2 py-0.5 bg-zinc-100 rounded text-[9px] font-bold text-zinc-400 tracking-tighter">
                EDITABLE
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-40 theme-input rounded-2xl p-4 text-sm text-[var(--apple-text)] leading-relaxed font-sans focus:ring-2 focus:ring-ink outline-none resize-none shadow-sm"
              placeholder="Enter the final generation prompt..."
            />
          </div>

          {/* Parameters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {renderModelControl()}
              {activeTeam.outputType === 'image' && renderImageControls()}
              {activeTeam.outputType === 'video' && renderVideoControls()}
            </div>

            <div className="theme-panel rounded-2xl p-6 border space-y-4 shadow-sm" style={{ borderColor: 'var(--apple-border)' }}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-secondary)]">Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-[var(--apple-text-secondary)] uppercase font-medium tracking-wide">Team</p>
                  <p className="text-[13px] font-semibold text-[var(--apple-text)]">{activeTeam.teamName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--apple-text-secondary)] uppercase font-medium tracking-wide">Output Type</p>
                  <p className="text-[13px] font-semibold text-[var(--apple-text)] capitalize">{activeTeam.outputType}</p>
                </div>

                {referenceImages.length > 0 && (
                  <div className="pt-4 border-t border-black/5 space-y-3">
                    <p className="text-[10px] text-[var(--apple-text-secondary)] uppercase font-medium tracking-wide">Visual Inspiration</p>
                    <div className="grid grid-cols-3 gap-2">
                      {referenceImages.map((img, idx) => (
                        <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-white/5 bg-white/5">
                          <img src={img} alt="Ref" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-black/5">
                  <p className="text-[12px] leading-relaxed text-[var(--apple-text-secondary)]">
                    Adjust parameters and the synthesized prompt before final generation. Once approved, your deliverable will be created.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t theme-panel flex justify-end items-center gap-3" style={{ borderColor: 'var(--apple-border)' }}>
          <button
            onClick={handleCancelAndReset}
            className="px-6 py-3 theme-badge text-[var(--apple-text-secondary)] rounded-2xl text-[13px] font-semibold hover:bg-black/[0.03] hover:text-red-600 hover:border-red-200 transition-apple active:scale-[0.98]"
          >
            Cancel & Reset
          </button>

          <button
            onClick={handleGenerate}
            className="px-8 py-3 bg-appleBlue text-white rounded-2xl text-[13px] font-semibold hover:opacity-90 active:scale-[0.98] transition-apple shadow-sm flex items-center gap-2"
          >
            <Check size={14} strokeWidth={3} />
            Approve & Generate
          </button>
        </div>
      </div>
      </div>

      {/* Confirmation Modal Overlay */}
      {isConfirmingReset && (
        <div
          className="fixed inset-0 z-[660] flex items-center justify-center bg-ink/40 backdrop-blur-md p-4 cursor-default"
          onClick={(e) => {
            e.stopPropagation()
            setIsConfirmingReset(false)
          }}
        >
          <div
            className="theme-modal-panel border rounded-[24px] w-96 p-8 shadow-2xl flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--apple-text)]">Reset project?</h3>
              <p className="text-[13px] text-[var(--apple-text-secondary)] mt-2 leading-relaxed">
                All progress will be lost and the project will be reset to its initial state. This action cannot be undone.
              </p>
            </div>
            <div className="flex flex-col w-full gap-2 mt-2">
              <button
                onClick={confirmReset}
                className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-[13px] font-semibold hover:bg-red-600 active:scale-[0.98] transition-apple"
              >
                Yes, reset project
              </button>
              <button
                onClick={() => setIsConfirmingReset(false)}
                className="w-full py-3.5 bg-black/[0.04] text-[var(--apple-text-secondary)] rounded-2xl text-[13px] font-semibold hover:bg-black/[0.07] active:scale-[0.98] transition-apple"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
