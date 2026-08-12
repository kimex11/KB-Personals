import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CurrencyInput } from './CurrencyInput';

describe('CurrencyInput', () => {
  it('shows commas for a value with thousands', () => {
    render(<CurrencyInput value="1850.5" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('1,850.5');
  });

  it('shows an empty input for an empty value', () => {
    render(<CurrencyInput value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('strips commas and non-numeric characters before reporting the raw value', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1,850abc' } });
    expect(onChange).toHaveBeenLastCalledWith('1850');
  });

  it('keeps only one decimal point when the input contains multiple dots', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1.5.5' } });
    expect(onChange).toHaveBeenLastCalledWith('1.55');
  });
});
