'use client';

import { Input } from '@/components/ui/input';

interface CurrencyInputProps {
  id?: string;
  value: string;
  onChange: (rawValue: string) => void;
  className?: string;
  placeholder?: string;
}

function stripToNumberString(input: string): string {
  let cleaned = input.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  return cleaned;
}

function formatWithCommas(rawValue: string): string {
  if (rawValue === '') return '';
  const [integerPart, decimalPart] = rawValue.split('.');
  const withCommas = integerPart === '' ? '' : Number(integerPart).toLocaleString('en-US');
  return decimalPart !== undefined ? `${withCommas}.${decimalPart}` : withCommas;
}

export function CurrencyInput({ id, value, onChange, className, placeholder }: CurrencyInputProps) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={formatWithCommas(value)}
      onChange={(e) => onChange(stripToNumberString(e.target.value))}
    />
  );
}
