import React, { useState, useRef, useEffect } from 'react';
import { AppData, UserRole } from '../types';
import { BrainCircuit, X, Send, Bot, User, Loader2, Sparkles, MessageSquare } from 'lucide-react';

interface Props {
  data: AppData;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export const QuickAI: React.FC<Props> = ({ data }) => {
  const currentRole = data.settings?.currentUser?.role || UserRole.ADMIN;
  
  // Strictly prevent both Cashier and Admin from accessing or seeing AI (Only Manager is allowed)
  if (currentRole === UserRole.CASHIER || currentRole === UserRole.ADMIN) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'quick-1',
      sender: 'assistant',
      text: 'Kusoo dhawaow Xaysimo 24/7 AI! Wax alaale wixii aad waydiiso kugu jawaabaya 24 saacadood (Somali iyo English).',
      timestamp: new Date()
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const getStoreContext = () => {
    const salesTxs = data.transactions.filter(t => t.type !== 'CASH_LOAN' && t.type !== 'DEBT_PAYMENT');
    const totalRevenue = salesTxs.reduce((a, b) => a + b.subtotal, 0);
    const totalExpenses = data.expenses.reduce((a, b) => a + b.amount, 0);

    return {
      storeName: data.settings.businessName,
      totalProducts: data.products.length,
      totalSalesCount: data.transactions.length,
      totalRevenueUSD: totalRevenue,
      debtorsCount: data.customers.filter(c => c.debtBalance > 0).length,
      totalDebtUSD: data.customers.reduce((a, b) => a + b.debtBalance, 0)
    };
  };

  const handleSend = async (customText?: string) => {
    const query = customText || input;
    if (!query.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customText) setInput('');
    setLoading(true);

    try {
      const historyToSend = messages.map(m => ({ sender: m.sender, text: m.text }));
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyToSend,
          storeContext: getStoreContext(),
          role: currentRole
        })
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.details || resData.error || 'Cillad ayaa ka dhacday AI-ga.');
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: resData.response || 'Jawaabtu waa tan.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: `⚠️ **Cillad:** ${err.message || 'Error processing request.'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 lg:bottom-6 right-6 z-[90] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 group ring-4 ring-blue-100"
        title="Weydii AI Caawiyaha (Ask AI Assistant)"
      >
        <BrainCircuit size={26} className="group-hover:rotate-12 transition-transform" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap text-xs font-black uppercase tracking-wider ml-0 group-hover:ml-2">
          Ask AI
        </span>
      </button>

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-36 lg:bottom-20 right-4 md:right-6 w-[92vw] sm:w-[400px] h-[520px] bg-white rounded-3xl shadow-2xl border border-slate-200 z-[95] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <BrainCircuit size={20} />
              </div>
              <div>
                <h3 className="font-black text-sm tracking-tight">Xaysimo AI Assistant</h3>
                <p className="text-[10px] text-blue-100 font-bold">Somali & English AI Helper</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/20 rounded-xl transition-colors text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 max-w-[85%] ${
                  m.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm ${
                    m.sender === 'user' ? 'bg-blue-600' : 'bg-emerald-600'
                  }`}
                >
                  {m.sender === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-blue-600 text-white font-medium rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 font-normal rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 p-2">
                <Loader2 className="animate-spin text-blue-600" size={16} />
                AI-ga ayaa kuu jawaabaya...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex gap-1.5"
          >
            <input
              type="text"
              placeholder="Geli suaal..."
              className="flex-1 px-3 py-2.5 bg-slate-100 focus:bg-white border border-transparent focus:border-blue-500 rounded-xl outline-none text-xs font-bold text-slate-800"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default QuickAI;
