import React, { useState } from 'react';

export const ChapaDepositPanel: React.FC<{ onDepositSuccess: () => void }> = ({ onDepositSuccess }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Telebirr');
  const [txnId, setTxnId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: Number(amount), method, txnId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ክፍያውን ማረጋገጥ አልተቻለም');
      }
      setSuccess(data.message || 'ቦርሳዎ በትክክል ተሞልቷል!');
      setAmount('');
      setTxnId('');
      if (onDepositSuccess) onDepositSuccess();
    } catch (err: any) {
      setError(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-6 text-white max-w-md mx-auto">
      <h3 className="text-xl font-bold text-amber-400 mb-4">ብር መሙላት (ዲፖዚት)</h3>
      
      {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-500/20 border border-green-500 text-green-300 p-3 rounded mb-4 text-sm">{success}</div>}

      <form onSubmit={handleDeposit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">የክፍያ መንገድ</label>
          <select 
            value={method} 
            onChange={(e) => setMethod(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500"
          >
            <option value="Telebirr">ቴሌብር (Telebirr)</option>
            <option value="CBE">ንግድ ባንክ (CBE)</option>
            <option value="M-Pesa">አም-ፔሳ (M-Pesa)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">የብር መጠን (ETB)</label>
          <input 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            placeholder="ለምሳሌ: 100" 
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">የግብይት ማረጋገጫ ቁጥር (Txn ID)</label>
          <input 
            type="text" 
            value={txnId} 
            onChange={(e) => setTxnId(e.target.value)} 
            placeholder="ለምሳሌ: TR24XXXXXX" 
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500"
          />
          <p className="text-xs text-slate-400 mt-1">በባንክ ወይም በቴሌብር የክፍያ ማረጋገጫ SMS ላይ የሚመጣውን ሪፈረንስ ቁጥር ያስገቡ።</p>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-3 rounded-lg transition duration-200 disabled:opacity-50"
        >
          {loading ? 'እየተረጋገጠ ነው...' : 'ክፍያ አረጋግጥ እና ቦርሳ ሙሉ'}
        </button>
      </form>
    </div>
  );
};
