import { useState, useCallback, useRef, useEffect } from 'react';
import { Languages, Loader2, X } from 'lucide-react';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onTranslate?: (text: string) => void;
  placeholder?: string;
  label?: string;
  isTranslating?: boolean;
  multiline?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function TextInput({
  value,
  onChange,
  onTranslate,
  placeholder = 'Enter text...',
  label,
  isTranslating = false,
  multiline = false,
  maxLength,
  autoFocus = false,
  disabled = false,
}: TextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd + Enter to translate
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onTranslate && value.trim()) {
        e.preventDefault();
        onTranslate(value);
      }
    },
    [onTranslate, value]
  );

  const commonProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      onChange(e.target.value),
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
    onKeyDown: handleKeyDown,
    placeholder,
    disabled,
    maxLength,
    className: `
      w-full px-4 py-3 rounded-xl
      bg-white border-2
      ${isFocused ? 'border-daraja-500' : 'border-daraja-200'}
      ${disabled ? 'bg-daraja-50 text-daraja-400 cursor-not-allowed' : 'text-daraja-900'}
      placeholder:text-daraja-400
      focus:outline-none focus:ring-0
      transition-colors duration-200
    `,
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="form-label">{label}</label>
      )}

      <div className="relative">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            {...commonProps}
            rows={4}
            className={`${commonProps.className} min-h-[120px] resize-y`}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            {...commonProps}
          />
        )}

        {/* Clear button */}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-3 p-1 rounded-full
                       text-daraja-400 hover:text-daraja-600
                       hover:bg-daraja-100 transition-colors"
            aria-label="Clear input"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Character count */}
      {maxLength && (
        <div className="flex justify-end">
          <span className={`text-xs ${value.length > maxLength * 0.9 ? 'text-caution-500' : 'text-daraja-400'}`}>
            {value.length}/{maxLength}
          </span>
        </div>
      )}

      {/* Translate button */}
      {onTranslate && value.trim() && (
        <button
          type="button"
          onClick={() => onTranslate(value)}
          disabled={isTranslating || disabled}
          className="btn-secondary w-full"
        >
          {isTranslating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Translating...
            </>
          ) : (
            <>
              <Languages className="w-5 h-5 mr-2" />
              Translate
              <span className="text-xs text-daraja-400 ml-2">(Ctrl+Enter)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
