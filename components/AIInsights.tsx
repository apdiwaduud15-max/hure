import React, { useState, useRef, useEffect } from 'react';
import { AppData, UserRole } from '../types';
import { BrainCircuit, Send, Sparkles, Loader2, Bot, User, Trash2, HelpCircle, ArrowRight, ShieldAlert } from 'lucide-react';

interface Props {
  data: AppData;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export const AIInsights: React.FC<Props> = ({ data }) => {
  const currentRole = data.settings?.currentUser?.role || UserRole.ADMIN;

  if (currentRole === UserRole.CASHIER || currentRole === UserRole.ADMIN) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 bg-white rounded-3xl border border-red-200 shadow-sm mt-12">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800">Gelitaanka AI Waa Laga Xidhay (Access Restricted)</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Gelitaanka iyo weydiinta AI Insights waxaa laga xidhay Cashier-ka iyo Admin-kaba. Waxaa loo ogol yahay kaliya <strong>Manager-ka Guud</strong>. Fadlan la xidhiidh Maamulaha haddii aad u baahan tahay caawimaad.
        </p>
      </div>
    );
  }

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: "Kusoo dhawaow Caawiyaha Caqliga Artificial (AI) ee Xaysimo Supermarket! Wuxuu kuu shaqaynayaa 24 saacadood (24/7). Wax alaale wixii aad waydiiso wuu kugu jawaabaybaa Somali iyo English-ba.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const getStoreContext = () => {
    const salesTxs = data.transactions.filter(t => t.type !== 'CASH_LOAN' && t.type !== 'DEBT_PAYMENT');
    const totalRevenue = salesTxs.reduce((a, b) => a + b.subtotal, 0);
    const totalCOGS = salesTxs.reduce((acc, t) => {
      return acc + t.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
    }, 0);
    const totalExpenses = data.expenses.reduce((a, b) => a + b.amount, 0);
    const netProfit = (totalRevenue - totalCOGS) - totalExpenses;

    return {
      storeName: data.settings.businessName,
      totalProducts: data.products.length,
      productsList: data.products.map(p => ({ name: p.name, price: p.sellPrice, stock: p.stock })),
      totalSalesCount: data.transactions.length,
      totalRevenueUSD: totalRevenue,
      netProfitUSD: netProfit,
      totalExpensesUSD: totalExpenses,
      debtorsCount: data.customers.filter(c => c.debtBalance > 0).length,
      totalDebtUSD: data.customers.reduce((a, b) => a + b.debtBalance, 0),
      debtorsList: data.customers.filter(c => c.debtBalance > 0).map(c => ({ name: c.name, debt: c.debtBalance }))
    };
  };

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
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
        text: resData.response || 'Tani waa jawaabta AI-ga.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: `⚠️ **Cillad:** ${err.message || 'Waxaa jirtay cillad marka la xiriirayo AI server-ka. Fadlan hubi internet-kaaga ama dub-isku day.'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
            <BrainCircuit size={36} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Xaysimo AI Intelligence Hub</h1>
            <p className="text-blue-100 text-xs md:text-sm font-medium mt-1">
              Caawiyahaaga caqliga badan ee Somali iyo English kugu jawaabaya!
            </p>
          </div>
        </div>
        <button
          onClick={() => setMessages([{
            id: 'welcome-reset',
            sender: 'assistant',
            text: 'Isku xirkii waa la cusbooneysiiyay. Maxaan kaa caawiyaa maanta?',
            timestamp: new Date()
          }])}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-2 border border-white/20 transition-all shrink-0"
        >
          <Trash2 size={16} /> Tir wada-hadalka (Clear Chat)
        </button>
      </div>

      {/* Chat Messages Container */}
      <div className="bg-white rounded-3xl shadow-lg border border-slate-200/80 overflow-hidden flex flex-col h-[580px]">
        <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 max-w-[88%] md:max-w-[78%] ${
                m.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                  m.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                }`}
              >
                {m.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>

              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white font-medium rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200 font-normal rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{m.text}</div>
                <div
                  className={`text-[10px] mt-2 font-bold ${
                    m.sender === 'user' ? 'text-blue-200 text-right' : 'text-slate-400'
                  }`}
                >
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3 mr-auto max-w-[80%]">
              <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Bot size={18} />
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-2 text-slate-600 text-sm font-bold">
                <Loader2 className="animate-spin text-blue-600" size={18} />
                AI-ga ayaa fikireysa oo kuu jawaabaysa...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 md:p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Geli suaashaada halkan... (e.g. Setahay, Sidee alaab loo diwaan geliyaa?)"
              className="flex-1 px-4 py-3.5 bg-slate-100 focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold text-slate-800 text-sm md:text-base placeholder:text-slate-400 transition-all"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95 disabled:opacity-50 shrink-0"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              <span className="hidden md:inline">Dir</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
