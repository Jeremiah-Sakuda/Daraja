import type { WorkflowField, FieldOption } from '../../types/workflow';

interface FieldInputProps {
  field: WorkflowField;
  value: string | string[] | number | boolean;
  onChange: (value: string | string[] | number | boolean) => void;
  disabled?: boolean;
}

export function FieldInput({ field, value, onChange, disabled = false }: FieldInputProps) {
  const renderInput = () => {
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className="input-field"
          />
        );

      case 'longText':
        return (
          <textarea
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className="textarea-field"
            rows={4}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="input-field"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value as number}
            onChange={(e) => onChange(Number(e.target.value))}
            min={field.validation?.min}
            max={field.validation?.max}
            disabled={disabled}
            className="input-field"
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChange(true)}
              disabled={disabled}
              className={`
                px-6 py-3 rounded-xl font-medium transition-colors
                ${value === true
                  ? 'bg-trust-500 text-white'
                  : 'bg-daraja-100 text-daraja-700 hover:bg-daraja-200'
                }
              `}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => onChange(false)}
              disabled={disabled}
              className={`
                px-6 py-3 rounded-xl font-medium transition-colors
                ${value === false
                  ? 'bg-alert-500 text-white'
                  : 'bg-daraja-100 text-daraja-700 hover:bg-daraja-200'
                }
              `}
            >
              No
            </button>
          </div>
        );

      case 'select':
        return (
          <select
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="input-field"
          >
            <option value="">Select an option...</option>
            {field.options?.map((opt: FieldOption) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'multiSelect':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="flex flex-wrap gap-2">
            {field.options?.map((opt: FieldOption) => {
              const isSelected = selectedValues.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (isSelected) {
                      onChange(selectedValues.filter((v) => v !== opt.value));
                    } else {
                      onChange([...selectedValues, opt.value]);
                    }
                  }}
                  className={`
                    px-4 py-2 rounded-xl font-medium transition-colors
                    ${isSelected
                      ? 'bg-daraja-600 text-white'
                      : 'bg-daraja-100 text-daraja-700 hover:bg-daraja-200'
                    }
                  `}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className="input-field"
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <label className="form-label">
        {field.label}
        {field.required && <span className="text-alert-500 ml-1">*</span>}
      </label>
      {renderInput()}
      {field.helpText && (
        <p className="text-xs text-daraja-500">{field.helpText}</p>
      )}
    </div>
  );
}
