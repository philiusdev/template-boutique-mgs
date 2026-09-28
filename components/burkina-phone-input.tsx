"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatBurkinaPhoneInput, toBurkinaPhoneNumber } from "@/lib/phone";

export function BurkinaPhoneInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  required = false,
  disabled = false,
  className = "text-input",
}: {
  id: string;
  name: string;
  value?: string | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [changeVersion, setChangeVersion] = useState(0);
  const formattedValue = formatBurkinaPhoneInput(value);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const digitCount = pendingCaret.current;
    if (!input || digitCount === null) return;

    let caret = 0;
    let digits = 0;
    while (caret < formattedValue.length && digits < digitCount) {
      if (/\d/.test(formattedValue[caret])) digits += 1;
      caret += 1;
    }
    input.setSelectionRange(caret, caret);
    pendingCaret.current = null;
  }, [changeVersion, formattedValue]);

  return (
    <>
      <span className="burkina-phone-field">
        <span className="burkina-phone-prefix" aria-hidden="true">+226</span>
        <input
          ref={inputRef}
          id={id}
          className={className}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          enterKeyHint="done"
          placeholder="70 00 00 00"
          value={formattedValue}
          onChange={(event) => {
            const inputValue = event.currentTarget.value;
            const caret = event.currentTarget.selectionStart ?? inputValue.length;
            const allDigits = inputValue.replace(/\D/g, "");
            const digitsBeforeCaret = inputValue.slice(0, caret).replace(/\D/g, "").length;
            const countryCodeDigitsBeforeCaret = allDigits.startsWith("226") && allDigits.length > 8
              ? Math.min(3, digitsBeforeCaret)
              : 0;
            pendingCaret.current = Math.max(0, digitsBeforeCaret - countryCodeDigitsBeforeCaret);
            setChangeVersion((version) => version + 1);
            onChange(toBurkinaPhoneNumber(inputValue));
          }}
          onBlur={onBlur}
          aria-label="Numéro de téléphone burkinabè"
          aria-describedby={`${id}-hint`}
          required={required}
          disabled={disabled}
        />
        <input type="hidden" name={name} value={value ?? ""} />
      </span>
      <small id={`${id}-hint`} className="field-hint burkina-phone-hint">Entrez les 8 chiffres ; +226 est déjà ajouté.</small>
    </>
  );
}
