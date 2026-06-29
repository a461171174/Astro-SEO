import React, { useState, useRef, useEffect } from 'react';
import * as ICONS from 'lucide-react';

interface Option {
  id: string;
  title: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string | string[];
  onChange: (value: any) => void;
  placeholder: string;
  className?: string;
  multiple?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  className = "",
  multiple = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const getSelectedOptions = () => {
    if (multiple && Array.isArray(value)) {
      return options.filter(opt => value.includes(opt.id));
    }
    return options.find(opt => opt.id === value);
  };

  const selectedOptions = getSelectedOptions();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (id: string, e: React.MouseEvent) => {
    if (multiple) {
      e.stopPropagation();
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(id)) {
        onChange(currentValues.filter(v => v !== id));
      } else {
        onChange([...currentValues, id]);
      }
    } else {
      onChange(id);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="pl-4 pr-10 py-2 bg-slate-100 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer font-bold text-slate-600 flex items-center justify-between min-w-[140px] min-h-[40px]"
      >
        <div className="flex flex-wrap gap-1 items-center overflow-hidden">
          {multiple && Array.isArray(selectedOptions) && selectedOptions.length > 0 ? (
            selectedOptions.map(opt => (
              <span key={opt.id} className="bg-blue-600 text-white text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                {opt.title}
              </span>
            ))
          ) : (
            <span className="truncate">{(selectedOptions && !Array.isArray(selectedOptions)) ? selectedOptions.title : placeholder}</span>
          )}
        </div>
        <ICONS.ChevronDown className={`w-3 h-3 text-slate-400 absolute right-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-2 border-bottom border-slate-100 bg-slate-50">
            <div className="relative">
              <ICONS.Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input
                type="text"
                autoFocus
                className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 transition-all"
                placeholder="搜索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = multiple 
                  ? Array.isArray(value) && value.includes(opt.id)
                  : value === opt.id;
                  
                return (
                  <div
                    key={opt.id}
                    onClick={(e) => handleSelect(opt.id, e)}
                    className={`px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 text-blue-600 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.title}</span>
                    {isSelected && <ICONS.Check className="w-3 h-3" />}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">
                未找到匹配结果
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
