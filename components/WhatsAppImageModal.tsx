import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Download, 
  ExternalLink, 
  Check, 
  Image as ImageIcon,
  MessageCircle,
  Smartphone
} from 'lucide-react';
import { WhatsAppImageShareOptions } from '../lib/receiptImageGenerator';

interface WhatsAppImageModalProps {
  options: WhatsAppImageShareOptions | null;
  onClose: () => void;
}

export const WhatsAppImageModal: React.FC<WhatsAppImageModalProps> = ({ options, onClose }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [sharing, setSharing] = useState<boolean>(false);
  const [copyStatusText, setCopyStatusText] = useState<string>('');

  if (!options) return null;

  const cleanPhone = options.phone ? options.phone.replace(/[^\d]/g, '') : '';
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : 'https://web.whatsapp.com';

  const handleCopyImage = async () => {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ 'image/png': options.blob });
        await navigator.clipboard.write([item]);
        setCopied(true);
        setCopyStatusText('✅ Sawirka waa la koobiyeeyay! Ku dhufo (Ctrl+V / Paste) WhatsApp-ka.');
        setTimeout(() => {
          setCopied(false);
          setCopyStatusText('');
        }, 4000);
      } else {
        throw new Error('ClipboardItem not supported');
      }
    } catch (err) {
      console.warn('Clipboard write error:', err);
      // Fallback: download image
      handleDownload();
      setCopyStatusText('⬇️ Sawirka waa la soo dejiyay!');
      setTimeout(() => setCopyStatusText(''), 3000);
    }
  };

  const handleNativeShare = async () => {
    try {
      setSharing(true);
      const file = new File([options.blob], options.filename || 'receipt.png', { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: options.title || 'Rasiidka Iibka',
          text: `Rasiidka ${options.customerName || ''}`
        });
      } else {
        // Fallback: Copy and Open WhatsApp
        await handleCopyImage();
        window.open(waUrl, '_blank');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        // If sharing cancelled or failed, copy and open WA
        await handleCopyImage();
        window.open(waUrl, '_blank');
      }
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = options.dataUrl;
    a.download = options.filename || 'receipt.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenWhatsApp = async () => {
    await handleCopyImage();
    window.open(waUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <MessageCircle size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                Sawirka Rasiidka WhatsApp (Image Receipt)
              </h3>
              <p className="text-xs font-bold text-slate-500">
                {options.customerName ? `Macaamiil: ${options.customerName}` : options.title}
                {cleanPhone ? ` • 📱 ${cleanPhone}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body - Image Preview */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-100/60 flex flex-col items-center justify-center">
          <div className="relative group max-w-full rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-white">
            <img 
              src={options.dataUrl} 
              alt="Receipt Preview" 
              className="max-h-[50vh] w-auto object-contain select-none"
            />
          </div>

          {copyStatusText && (
            <div className="mt-3 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg animate-in slide-in-from-bottom-2 flex items-center gap-2">
              <Check size={16} />
              {copyStatusText}
            </div>
          )}
        </div>

        {/* Action Buttons Toolbar */}
        <div className="p-5 border-t border-slate-100 bg-white space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Primary Action: Direct Share / Send Image */}
            <button
              onClick={handleNativeShare}
              disabled={sharing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-xs shadow-md transition-all uppercase tracking-wider"
            >
              <Smartphone size={16} />
              <span>{sharing ? 'Dirayaa...' : '📱 U Dir WhatsApp (Sawir ahaan)'}</span>
            </button>

            {/* Copy Image to Paste */}
            <button
              onClick={handleCopyImage}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-black text-xs transition-all uppercase tracking-wider ${
                copied 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-slate-900 hover:bg-black text-white shadow-md'
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Waa la Koobiyeeyay!' : '📋 Nuqul Sawirka (Copy Image)'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* Open WhatsApp Chat */}
            <button
              onClick={handleOpenWhatsApp}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs transition-colors"
            >
              <ExternalLink size={14} />
              <span>Fur WhatsApp Chat</span>
            </button>

            {/* Download PNG */}
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
            >
              <Download size={14} />
              <span>Soo Dejiso (PNG)</span>
            </button>
          </div>

          {/* Helper Notice */}
          <p className="text-[11px] text-slate-500 text-center font-medium">
            💡 <strong>Sida loo diro:</strong> Riix <em>"U Dir WhatsApp"</em> ama <em>"Nuqul Sawirka"</em> kadibna ku dhaji (<strong>Ctrl+V</strong>) WhatsApp chat-ka macamiilka.
          </p>
        </div>

      </div>
    </div>
  );
};
