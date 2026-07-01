import { useState } from 'react'
import { handleIncomingWhatsAppQuery } from '../../services/whatsappService'
import FeatureGate from '../../components/FeatureGate'

const EXAMPLES = [
  'balance for STU-XXXXXX',
  'results for STU-XXXXXX',
  'status for STU-XXXXXX',
  'hello',
]

export default function WhatsAppSimPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const send = async () => {
    if (!input.trim()) return
    const userMsg = input.trim()
    setMessages((m) => [...m, { from: 'user', text: userMsg }])
    setInput('')
    setLoading(true)
    try {
      const reply = await handleIncomingWhatsAppQuery(userMsg)
      setMessages((m) => [...m, { from: 'bot', text: reply }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <FeatureGate flag="whatsappSimulator">
      <div className="max-w-lg">
        <h2 className="text-xl font-bold text-[#0D3B66] mb-1">WhatsApp Query Simulator</h2>
        <p className="text-xs text-slate-400 mb-4">Debug tool — simulates the WhatsApp chatbot using live Firebase data.</p>

        <div className="mb-3 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => setInput(e)}
              className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200"
            >
              {e}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow p-4 h-80 overflow-y-auto mb-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-slate-300 text-sm text-center mt-24">Send a message to test the bot…</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                m.from === 'user'
                  ? 'bg-[#0D3B66] text-white rounded-tr-none'
                  : 'bg-slate-100 text-slate-700 rounded-tl-none'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 text-slate-400 rounded-2xl px-4 py-2 text-sm rounded-tl-none">
                Typing…
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && send()}
            placeholder="Type a query…"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-[#0D3B66] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a2f52] disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
    </FeatureGate>
  )
}
