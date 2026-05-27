import { motion } from 'framer-motion';
import { skeletonAnimation } from './animations';

interface EliteSkeletonProps {
  width?: string;
  height?: string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const roundedClasses = {
  none: '',
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  full: 'rounded-full',
};

export function EliteSkeleton({
  width = '100%',
  height = '20px',
  rounded = 'lg',
  className = '',
}: EliteSkeletonProps) {
  return (
    <motion.div
      animate={skeletonAnimation}
      className={`${roundedClasses[rounded]} ${className}`}
      style={{
        width,
        height,
        backgroundImage: 'linear-gradient(90deg, #F5E6E0 0%, #FDFBF9 50%, #F5E6E0 100%)',
        backgroundSize: '200% 100%',
      }}
    />
  );
}

// Card skeleton
export function EliteCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-2xl overflow-hidden shadow-elite-md"
    >
      <EliteSkeleton height="140px" rounded="none" />
      <div className="p-4 space-y-3">
        <EliteSkeleton width="75%" height="16px" />
        <EliteSkeleton width="100%" height="12px" />
        <EliteSkeleton width="60%" height="12px" />
        <div className="flex justify-between pt-2">
          <EliteSkeleton width="60px" height="12px" />
          <EliteSkeleton width="60px" height="12px" />
        </div>
      </div>
    </motion.div>
  );
}

// List skeleton
export function EliteListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="bg-white rounded-xl p-4 shadow-elite-sm flex items-center gap-3"
        >
          <EliteSkeleton width="48px" height="48px" rounded="xl" />
          <div className="flex-1 space-y-2">
            <EliteSkeleton width="70%" height="14px" />
            <EliteSkeleton width="50%" height="12px" />
          </div>
          <EliteSkeleton width="40px" height="24px" rounded="full" />
        </motion.div>
      ))}
    </div>
  );
}

// Profile skeleton
export function EliteProfileSkeleton() {
  return (
    <div className="flex flex-col items-center py-6">
      <motion.div
        animate={skeletonAnimation}
        className="w-20 h-20 rounded-full bg-[#F5E6E0]"
        style={{ backgroundImage: 'linear-gradient(90deg, #F5E6E0 0%, #FDFBF9 50%, #F5E6E0 100%)', backgroundSize: '200% 100%' }}
      />
      <div className="mt-4 space-y-2 w-full px-6">
        <EliteSkeleton width="60%" height="20px" className="mx-auto" />
        <EliteSkeleton width="40%" height="14px" className="mx-auto" />
        <div className="mt-6 space-y-3">
          <EliteSkeleton width="100%" height="48px" />
          <EliteSkeleton width="100%" height="48px" />
          <EliteSkeleton width="100%" height="48px" />
        </div>
      </div>
    </div>
  );
}

export default EliteSkeleton;
