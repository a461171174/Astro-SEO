
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, Check, Sparkles } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, featureName }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
          >
            <div className="absolute top-6 right-6 z-10">
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 pt-10 text-center max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-4 relative shadow-inner">
                <CreditCard size={32} />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white"
                >
                  <Sparkles size={12} fill="currentColor" />
                </motion.div>
              </div>

              <h2 className="text-xl font-black text-slate-900 mb-2 tracking-tight">升级套餐解锁 {featureName}</h2>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto leading-relaxed text-xs">
                您的当前套餐暂不支持使用 {featureName} 功能，添加专属顾问解锁所有高级SEO工具
              </p>

              <div className="bg-slate-50/80 backdrop-blur-sm rounded-2xl p-4 mb-6 text-left space-y-3 border border-slate-100">
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                    <Check size={10} strokeWidth={3} />
                  </div>
                  <span className="font-medium">全套高级 SEO 策略与检测工具</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                    <Check size={10} strokeWidth={3} />
                  </div>
                  <span className="font-medium">AI 智能生成 SEO 博客内容</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
                    <Check size={10} strokeWidth={3} />
                  </div>
                  <span className="font-medium">AI 优化 SEO 工具</span>
                </div>
              </div>

              <div className="mb-6 flex flex-col items-center">
                <div className="w-full h-px bg-slate-100 mb-6" />
                <h3 className="text-md font-bold text-slate-900 mb-4">扫码添加专属顾问，获取升级方案</h3>
                <div className="relative group inline-block">
                  <div className="absolute inset-0 bg-blue-500/5 blur-2xl rounded-full" />
                  <div className="relative bg-white p-2.5 border border-slate-100 rounded-2xl shadow-xl inline-block">
                    <img 
                      src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=ContactCustomerService" 
                      alt="Customer Service QR" 
                      className="w-24 h-24"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={onClose}
                  className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all active:scale-[0.98] text-sm"
                >
                  稍后再说
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
