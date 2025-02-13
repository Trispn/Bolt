import { classNames } from '~/utils/classNames';
import { motion } from 'framer-motion';
import { Progress } from '~/components/ui/Progress';

interface StatsCardProps {
  icon: string;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    label: string;
    progress?: number;
  };
}

export default function StatsCard({ icon, label, value, trend }: StatsCardProps) {
  return (
    <motion.div
      className={classNames(
        'p-5 rounded-xl',
        'bg-bolt-elements-background-depth-2',
        'hover:bg-bolt-elements-background-depth-3',
        'border border-bolt-elements-borderColor/10',
        'transition-all duration-200',
        'group',
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div
            className={classNames(
              'w-8 h-8 flex items-center justify-center rounded-lg',
              'bg-purple-500/10 text-purple-500',
              'group-hover:bg-purple-500/20',
              'transition-colors duration-200',
              icon,
            )}
          />
          {trend && (
            <motion.div
              className={classNames(
                'flex flex-col items-end gap-1',
                trend.value > 0
                  ? 'text-purple-500'
                  : trend.value < 0
                    ? 'text-red-500'
                    : 'text-bolt-elements-textTertiary',
              )}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium bg-bolt-elements-background-depth-3">
                <div className="i-ph:sliders-horizontal w-3.5 h-3.5" />
                <span>{trend.label}</span>
              </div>
              {trend.progress !== undefined && (
                <Progress
                  value={trend.progress}
                  className={classNames('h-1 w-16', {
                    'bg-purple-500/10 [&>div]:bg-purple-500': trend.value >= 0,
                    'bg-red-500/10 [&>div]:bg-red-500': trend.value < 0,
                  })}
                />
              )}
            </motion.div>
          )}
        </div>

        <div>
          <div className="text-2xl font-semibold text-bolt-elements-textPrimary mb-1">{value}</div>
          <div className="text-sm text-bolt-elements-textSecondary">{label}</div>
        </div>
      </div>
    </motion.div>
  );
}
