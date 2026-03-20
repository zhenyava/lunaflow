import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CalendarMonth from './CalendarMonth';

describe('CalendarMonth', () => {
  it('renders days as buttons when onDayClick is provided', () => {
    const testMonth = new Date(2024, 7, 1); // August 2024
    const onDayClick = vi.fn();
    
    const { container } = render(
      <CalendarMonth 
        month={testMonth} 
        onDayClick={onDayClick}
      />
    );

    const buttons = container.querySelectorAll('button');
    // 6 weeks * 7 days = 42 buttons
    expect(buttons.length).toBe(42);
  });

  it('renders outside days with the outside class', () => {
    const testMonth = new Date(2024, 7, 1); // August 2024
    const onDayClick = vi.fn();
    
    const { container } = render(
      <CalendarMonth 
        month={testMonth} 
        onDayClick={onDayClick}
      />
    );

    // July 31st should be visible
    // In August 2024 grid, July 31st is the first Wednesday (if week starts on Sunday: Sun 28, Mon 29, Tue 30, Wed 31)
    
    // Let's check for my custom 'opacity-40' class which I added to 'outside'
    const customOutsideDays = container.querySelectorAll('.opacity-40');
    expect(customOutsideDays.length).toBeGreaterThan(0);
  });
});
