"use client"
import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send } from "lucide-react"
import { api } from "@/lib/api"
import { usePlugin } from "@/lib/plugins-context"
import type { ChatMessage } from "@/lib/types"

function getSessionKey(): string {
  const stored = localStorage.getItem("cf_chat_session")
  if (stored) return stored
  const key = crypto.randomUUID()
  localStorage.setItem("cf_chat_session", key)
  return key
}

export function ChatWidget() {
  const aiChatEnabled = usePlugin("ai_chat")
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load history from DB when widget first opens
  useEffect(() => {
    if (!aiChatEnabled || !open || historyLoaded) return
    const sessionKey = getSessionKey()
    api.get<{ session_key: string; messages: ChatMessage[] }>(`/api/ai_chat/history/${sessionKey}`)
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages)
        }
      })
      .catch(() => {})
      .finally(() => {
        setHistoryLoaded(true)
      })
  }, [open, historyLoaded, aiChatEnabled])

  // All hooks above — safe to conditionally return now
  if (!aiChatEnabled) return null

  async function send() {
    const message = input.trim()
    if (!message || loading) return
    setInput("")
    const userMsg: ChatMessage = { role: "user", content: message }
    setMessages((m) => [...m, userMsg])
    setLoading(true)
    try {
      const res = await api.post<{ reply: string; session_key: string }>("/api/ai_chat/chat", {
        message,
        session_key: getSessionKey(),
      })
      setMessages((m) => [...m, { role: "assistant", content: res.reply }])
    } catch (e) {
      setMessages((m) => [...m, {
        role: "assistant",
        content: e instanceof Error ? e.message : "Sorry, I couldn't process your request.",
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-brand hover:bg-brand-hover text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label="Chat with us"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ height: "480px" }}>
          {/* Header */}
          <div className="bg-brand text-white px-4 py-3 flex-shrink-0">
            <p className="font-semibold text-sm">Chat with us</p>
            <p className="text-xs text-white/70">Ask anything about our products</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-slate-400 text-center pt-4">
                👋 Hi! How can I help you today?
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-brand text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 px-3 py-2.5 flex gap-2 flex-shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Type a message…"
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-dark"
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="p-2 bg-brand hover:bg-brand-hover text-white rounded-lg disabled:opacity-40 transition-colors">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
