import React, { useState, useEffect } from 'react';
import { X, Delete, Calculator as CalcIcon, Copy, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculatorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key >= '0' && e.key <= '9') handleNumber(e.key);
      else if (e.key === '.') handleNumber('.');
      else if (e.key === '+') handleOperator('+');
      else if (e.key === '-') handleOperator('-');
      else if (e.key === '*') handleOperator('×');
      else if (e.key === '/') handleOperator('÷');
      else if (e.key === 'Enter' || e.key === '=') calculate();
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, display, expression]);

  if (!isOpen) return null;

  const handleNumber = (val: string) => {
    if (display === '0' && val !== '.') {
      setDisplay(val);
    } else if (val === '.' && display.includes('.')) {
      return;
    } else {
      setDisplay(display + val);
    }
  };

  const handleOperator = (op: string) => {
    setExpression(`${display} ${op} `);
    setDisplay('0');
  };

  const handleClear = () => {
    setDisplay('0');
    setExpression('');
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const calculate = () => {
    if (!expression) return;
    try {
      const parts = expression.trim().split(' ');
      const prev = parseFloat(parts[0]);
      const op = parts[1];
      const current = parseFloat(display);

      if (isNaN(prev) || isNaN(current)) return;

      let result = 0;
      switch (op) {
        case '+':
          result = prev + current;
          break;
        case '-':
          result = prev - current;
          break;
        case '×':
        case '*':
          result = prev * current;
          break;
        case '÷':
        case '/':
          result = current !== 0 ? prev / current : 0;
          break;
        case '%':
          result = (prev * current) / 100;
          break;
        default:
          return;
      }

      const formattedResult = Number.isInteger(result) ? result.toString() : result.toFixed(2);
      setExpression(`${expression}${display} =`);
      setDisplay(formattedResult);
    } catch {
      setDisplay('Error');
    }
  };

  const handlePercentage = () => {
    const val = parseFloat(display);
    if (!isNaN(val)) {
      setDisplay((val / 100).toString());
    }
  };

  const handleToggleSign = () => {
    const val = parseFloat(display);
    if (!isNaN(val)) {
      setDisplay((val * -1).toString());
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 w-full max-w-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <CalcIcon size={20} className="text-blue-400" />
            <h3 className="font-black text-sm tracking-wide text-slate-200 uppercase">Hisabiye / Calculator</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Display Screen */}
        <div className="p-5 bg-slate-950 flex flex-col items-end justify-end min-h-[110px] space-y-1 relative">
          <div className="text-xs font-mono text-slate-400 h-5 overflow-x-auto whitespace-nowrap">
            {expression}
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-black text-emerald-400 tracking-tight break-all max-w-full">
            {display}
          </div>
          <button
            onClick={copyToClipboard}
            className="absolute left-4 bottom-4 p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1 transition-all"
            title="Copy result"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="text-[10px] font-bold">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Buttons Grid */}
        <div className="p-4 grid grid-cols-4 gap-2.5 bg-slate-900">
          {/* Row 1 */}
          <button onClick={handleClear} className="py-3 bg-rose-500/20 text-rose-400 border border-rose-500/30 font-black rounded-2xl hover:bg-rose-500/30 active:scale-95 text-base transition-all">
            AC
          </button>
          <button onClick={handleToggleSign} className="py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl hover:bg-slate-700 active:scale-95 text-base transition-all">
            ±
          </button>
          <button onClick={handlePercentage} className="py-3 bg-slate-800 text-slate-300 font-bold rounded-2xl hover:bg-slate-700 active:scale-95 text-base transition-all">
            %
          </button>
          <button onClick={() => handleOperator('÷')} className="py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 active:scale-95 text-lg transition-all shadow-md shadow-blue-600/30">
            ÷
          </button>

          {/* Row 2 */}
          <button onClick={() => handleNumber('7')} className="py-3.5 bg-slate-800/80 text-white font-black text-lg rounded-2xl hover:bg-slate-700 active:scale-95 transition-all">
            7
          </button>
          <button onClick={() => handleNumber('8')} className="py-3.5 bg-slate-800/80 text-white font-black text-lg rounded-2xl hover:bg-slate-700 active:scale-95 transition-all">
            8
          </button>
          <button onClick={() => handleNumber('9')} className="py-3.5 bg-slate-800/80 text-white font-black text-lg rounded-2xl hover:bg-slate-700 active:scale-95 transition-all">
            9
          </button>
          <button onClick={() => handleOperator('×')} className="py-3.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 active:scale-95 text-lg transition-all shadow-md shadow-blue-600/30">
            ×
          </button>

          {/* Row 3 */}
          <button onClick={() => handleNumber('4')} className="py-3.5 bg-slate-800/80 text-white font-black text-lg rounded-2xl hover:bg-slate-700 active:scale-95 transition-all">
            4
          </button>
          <button onClick={() => handleNumber('5')} className="py-3.5 bg-slate-800/80 text-white font-black text-lg rounded-2xl hover:bg-slate-700 active:scale-95 transition-all">
            5
          </button>
          <button onClick={() => handleNumber('6')} className="py-3.5 bg-slate-800/80 text-white font-black text-lg rounded-2xl hover:bg-slate-700 active:scale-95 transition-all">
            6
          </button>
          <button onClick={() => handleOperator('-')} className="py-3.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 active:scale-95 text-lg transition-all shadow-md shadow-blue-600/30">
            -
          </button>

          {/* Row 4 */}
          <button onClick={() => handleNumber('1')} className="py-3.5 bg-slate-800/80 text-white font-black text-lg rounded-2xl hover:bg-slate-700 active:scale-95 transition-all">
            1
          </button>
          <button onClick={() => handleNumber('2')} className="py-3.5 bg-slate-800/80 text-white font-black text-lg rounded-2xl hover:bg-slate-700 active:scale-95 transition-all">
            2
          </button>
          <button onClick={() => handleNumber('3')} className="py-3.5 bg-slate-800/80 text-white font-black text-lg rounded-2xl hover:bg-slate-700 active:scale-95 transition-all">
            3
          </button>
          <button onClick={() => handleOperator('+')} className="py-3.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 active:scale-95 text-lg transition-all shadow-md shadow-blue-600/30">
            +
          </button>

          {/* Row 5 */}
          <button onClick={() => handleNumber('0')} className="py-3.5 bg-slate-800/80 text-white font-black text-lg rounded-2xl hover:bg-slate-700 active:scale-95 transition-all">
            0
          </button>
          <button onClick={() => handleNumber('.')} className="py-3.5 bg-slate-800/80 text-white font-black text-lg rounded-2xl hover:bg-slate-700 active:scale-95 transition-all">
            .
          </button>
          <button onClick={handleBackspace} className="py-3.5 bg-slate-800/80 text-slate-300 font-bold rounded-2xl hover:bg-slate-700 active:scale-95 flex items-center justify-center transition-all">
            <Delete size={20} />
          </button>
          <button onClick={calculate} className="py-3.5 bg-emerald-500 text-slate-950 font-black text-xl rounded-2xl hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/20">
            =
          </button>
        </div>
      </div>
    </div>
  );
};
