import { useState, useRef, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Copy,
  Check,
  Send,
  Bot,
  User,
  Syringe,
  Phone,
  Clock,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'

interface Message {
  role: 'user' | 'agent'
  content: string
}

const DEFAULT_CONFIG = {
  primaryColor: '#0891B2',
  agentName: 'Assistente da Clínica',
  position: 'bottom-right' as 'bottom-right' | 'bottom-left',
}

export default function AdminPanel() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [copied, setCopied] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'agent', content: 'Olá! 👋 Como posso ajudar?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [sessionId] = useState(() => {
    const existing = localStorage.getItem('skip-test-session')
    if (existing) return existing
    const newId = crypto.randomUUID()
    localStorage.setItem('skip-test-session', newId)
    return newId
  })
  const [conversationId, setConversationId] = useState<string | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef('')

  const scheduleSend = useCallback((text: string) => {
    pendingRef.current = text
    if (timerRef.current) clearTimeout(timerRef.current)
    setWaiting(true)
    timerRef.current = setTimeout(() => {
      const msg = pendingRef.current
      pendingRef.current = ''
      setWaiting(false)
      if (msg.trim()) doSend(msg)
    }, 10000)
  }, [])

  const doSend = async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)
    try {
      const data = await pb.send('/backend/v1/chat', {
        method: 'POST',
        body: { message: text, session_id: sessionId, conversation_id: conversationId },
      })
      setConversationId(data.conversation_id)
      setMessages((prev) => [...prev, { role: 'agent', content: data.content }])
    } catch (err) {
      console.error('Chat error:', err)
      const msg = err instanceof Error ? err.message : 'Erro de conexão'
      setMessages((prev) => [...prev, { role: 'agent', content: `❌ ${msg}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || loading) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      setWaiting(false)
    }
    pendingRef.current = ''
    doSend(text)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInput(val)
    if (val.trim()) scheduleSend(val)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, waiting, loading])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  // Tudo derivado em runtime para que um clone deste projeto gere o snippet
  // apontando para o PROPRIO backend, sem edicao manual.
  //
  // VITE_POCKETBASE_URL e' a URL do backend (Skip Cloud), injetada pelo Skip em
  // build. NAO usar window.location.origin para a API: esse e' o host do
  // frontend, que devolve 405 sem CORS.
  const backendUrl = (import.meta.env.VITE_POCKETBASE_URL ?? '').replace(/\/+$/, '')
  const apiUrl = `${backendUrl}/backend/v1/chat`

  // O embed-sdk.js e' servido pelo frontend. Normaliza o host de preview para o
  // de producao, senao o snippet entregue ao cliente apontaria para o preview.
  const embedSdkUrl = `${window.location.origin.replace('--preview.goskip.app', '.goskip.app')}/embed-sdk.js`

  const snippet = `<!-- SKIP Agent: Assistente da Clinica -->
<script>
window.__SKIP_AGENT_CONFIG__ = ${JSON.stringify(
    {
      apiUrl,
      agentId: 'support-agent',
      primaryColor: config.primaryColor,
      agentName: config.agentName,
      position: config.position,
    },
    null,
    2,
  )};
</script>
<script src="${embedSdkUrl}" defer></script>`

  const copy = () => {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-600 to-teal-600 flex items-center justify-center text-white shadow-md">
            <Syringe className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h1 className="font-semibold text-slate-900 text-lg tracking-tight">
              Agente para Clínicas e Médicos
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Atendimento inteligente · Embeddável · SKIP Cloud
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Agente ativo
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-5">
        <Card className="overflow-hidden border-slate-200 shadow-md">
          <div className="bg-gradient-to-r from-cyan-600 to-teal-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">🏥 Clínica Saúde & Bem-Estar</h2>
                <p className="text-sm text-cyan-100">
                  Widget de atendimento · Preview em tempo real
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-cyan-100">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Seg-Sex 7h-19h
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> 2 min do metrô
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> (11) 99999-0000
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            <div className="border-r border-slate-100">
              <div className="p-6 space-y-4 bg-white">
                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                    Personalização do Widget
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Nome do Agente</Label>
                      <Input
                        value={config.agentName}
                        onChange={(e) => setConfig((p) => ({ ...p, agentName: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Cor Primária</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={config.primaryColor}
                          onChange={(e) =>
                            setConfig((p) => ({ ...p, primaryColor: e.target.value }))
                          }
                          className="w-9 h-9 rounded-lg border cursor-pointer"
                        />
                        <Input
                          value={config.primaryColor}
                          onChange={(e) =>
                            setConfig((p) => ({ ...p, primaryColor: e.target.value }))
                          }
                          className="font-mono h-9 flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500">Posição do Widget</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={config.position === 'bottom-right' ? 'default' : 'outline'}
                      size="sm"
                      className={
                        config.position === 'bottom-right' ? 'bg-cyan-600 hover:bg-cyan-700' : ''
                      }
                      onClick={() => setConfig((p) => ({ ...p, position: 'bottom-right' }))}
                    >
                      Inferior Direito
                    </Button>
                    <Button
                      variant={config.position === 'bottom-left' ? 'default' : 'outline'}
                      size="sm"
                      className={
                        config.position === 'bottom-left' ? 'bg-cyan-600 hover:bg-cyan-700' : ''
                      }
                      onClick={() => setConfig((p) => ({ ...p, position: 'bottom-left' }))}
                    >
                      Inferior Esquerdo
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="p-6">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">
                  🧪 Teste o Atendimento
                </Label>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div
                    className="px-4 py-3 text-white text-sm font-medium flex items-center gap-2"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                      <Bot className="w-4 h-4" />
                    </div>
                    <span>{config.agentName}</span>
                    <span className="ml-auto text-xs opacity-80 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-300" /> Online
                    </span>
                  </div>

                  <div ref={chatRef} className="h-72 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'agent' && (
                          <div className="w-7 h-7 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Bot className="w-3.5 h-3.5 text-cyan-600" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl ${msg.role === 'user' ? 'text-white rounded-br-md' : 'bg-white border border-slate-200 rounded-bl-md shadow-sm text-slate-700'}`}
                          style={
                            msg.role === 'user' ? { backgroundColor: config.primaryColor } : {}
                          }
                        >
                          {msg.content}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <User className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                      </div>
                    ))}

                    {waiting && (
                      <div className="flex gap-2 justify-start">
                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                            </span>
                            <span className="text-xs text-amber-700 font-medium">
                              Aguardando mensagem...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {loading && (
                      <div className="flex gap-2 justify-start">
                        <div className="w-7 h-7 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5 text-cyan-600" />
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                            <span
                              className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                              style={{ animationDelay: '0.15s' }}
                            />
                            <span
                              className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                              style={{ animationDelay: '0.3s' }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            Escrevendo...
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 border-t border-slate-200 bg-white flex gap-2">
                    <Input
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 text-sm h-10 rounded-xl border-slate-200"
                    />
                    <Button
                      size="icon"
                      onClick={handleSend}
                      disabled={!input.trim() || loading}
                      className="h-10 w-10 rounded-xl text-white hover:opacity-90 transition-all"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                    <span className="text-xs text-slate-400 mr-1 self-center">💡</span>
                    {['Qual o horário?', 'Como agendar?', 'Quais convênios?'].map((sug) => (
                      <button
                        key={sug}
                        onClick={() => {
                          setInput(sug)
                          scheduleSend(sug)
                        }}
                        className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:border-cyan-300 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 flex flex-col">
              <div className="p-6 border-b border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-sm">Agente: support-agent</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Respostas curtas · Janela de 10s · Foco clínicas
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-xs text-slate-400 uppercase tracking-wider">
                    Código de Embed
                  </Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-white h-8"
                    onClick={copy}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 mr-1.5" />
                    ) : (
                      <Copy className="w-4 h-4 mr-1.5" />
                    )}
                    {copied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
                <pre className="text-xs text-slate-200 font-mono whitespace-pre-wrap overflow-x-auto flex-1 leading-relaxed">
                  {snippet}
                </pre>

                <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                    Como incorporar
                  </p>
                  <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                    <li>Copie o código ao lado</li>
                    <li>
                      Cole no{' '}
                      <code className="text-cyan-400 bg-slate-800 px-1 rounded">&lt;head&gt;</code>{' '}
                      do site da clínica
                    </li>
                    <li>O widget aparecerá automaticamente</li>
                    <li>Personalize system prompt e base no SKIP</li>
                  </ol>
                  <div className="flex items-center gap-2 pt-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] text-slate-500">
                      10s janela · Shadow DOM · LGPD
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="text-center text-xs text-slate-400">SKIP · AI App Builder · ADAPTA</div>
      </div>
    </div>
  )
}
