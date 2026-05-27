import React, { useMemo } from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
  showDetails?: boolean;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    label: 'At least 12 characters',
    test: (pwd) => pwd.length >= 12,
  },
  {
    label: 'One lowercase letter',
    test: (pwd) => /[a-z]/.test(pwd),
  },
  {
    label: 'One uppercase letter',
    test: (pwd) => /[A-Z]/.test(pwd),
  },
  {
    label: 'One number',
    test: (pwd) => /\d/.test(pwd),
  },
  {
    label: 'One special character (@$!%*?&)',
    test: (pwd) => /[@$!%*?&]/.test(pwd),
  },
];

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showDetails = true,
}) => {
  const { strength, level, color, label } = useMemo(() => {
    if (!password) {
      return { strength: 0, level: 0, color: 'bg-nilin-border', label: '' };
    }

    const passedRequirements = PASSWORD_REQUIREMENTS.filter((req) =>
      req.test(password)
    ).length;

    const strengthPercent = (passedRequirements / PASSWORD_REQUIREMENTS.length) * 100;

    if (strengthPercent < 40) {
      return {
        strength: strengthPercent,
        level: 1,
        color: 'bg-red-400',
        label: 'Weak',
      };
    } else if (strengthPercent < 60) {
      return {
        strength: strengthPercent,
        level: 2,
        color: 'bg-orange-400',
        label: 'Fair',
      };
    } else if (strengthPercent < 80) {
      return {
        strength: strengthPercent,
        level: 3,
        color: 'bg-amber-400',
        label: 'Good',
      };
    } else {
      return {
        strength: strengthPercent,
        level: 4,
        color: 'bg-green-500',
        label: 'Strong',
      };
    }
  }, [password]);

  const requirementResults = useMemo(() => {
    return PASSWORD_REQUIREMENTS.map((req) => ({
      ...req,
      passed: req.test(password),
    }));
  }, [password]);

  const passedCount = requirementResults.filter((r) => r.passed).length;
  const totalCount = PASSWORD_REQUIREMENTS.length;

  if (!password) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-nilin-warmGray">Password strength</span>
          <span
            className={`font-medium ${
              level === 1
                ? 'text-red-500'
                : level === 2
                ? 'text-orange-500'
                : level === 3
                ? 'text-amber-500'
                : 'text-green-600'
            }`}
          >
            {label}
          </span>
        </div>
        <div className="h-1.5 bg-nilin-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${color}`}
            style={{ width: `${strength}%` }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      {showDetails && (
        <div className="space-y-1.5">
          <span className="text-xs text-nilin-warmGray">
            {passedCount}/{totalCount} requirements met
          </span>
          <ul className="space-y-1">
            {requirementResults.map((req, index) => (
              <li
                key={index}
                className={`flex items-center gap-2 text-xs transition-colors ${
                  req.passed ? 'text-green-600' : 'text-nilin-warmGray'
                }`}
              >
                {req.passed ? (
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span>{req.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;

// Utility function for password validation
export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Get password strength score (0-4)
export const getPasswordStrength = (password: string): number => {
  if (!password) return 0;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[@$!%*?&]/.test(password)) score++;
  if (password.length >= 16) score++;

  return Math.min(4, Math.floor(score / 2));
};
