import { classNames } from '~/utils/classNames';
import type { TimeRange } from '~/types/sync';
import { motion } from 'framer-motion';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  options: Array<{ value: TimeRange; label: string }>;
}

export default function TimeRangeSelector({ value, onChange, options }: TimeRangeSelectorProps) {
  return (
    <motion.div
      className="flex items-center gap-2"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-2">
        <div className="i-ph:clock text-purple-500 w-4 h-4" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as TimeRange)}
          className={classNames(
            'px-3 py-1.5 text-sm rounded-lg',
            'bg-bolt-elements-background-depth-2',
            'hover:bg-bolt-elements-background-depth-3',
            'border border-bolt-elements-borderColor/10',
            'text-bolt-elements-textPrimary',
            'focus:outline-none focus:ring-1 focus:ring-purple-500/30',
            'cursor-pointer transition-all duration-200',
          )}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className={classNames('bg-bolt-elements-background-depth-2', 'text-bolt-elements-textPrimary', 'py-1')}
            >
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </motion.div>
  );
}
