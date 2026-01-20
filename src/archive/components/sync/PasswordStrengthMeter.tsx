/**
 * Passphrase Strength Meter
 * 
 * Visual indicator showing passphrase strength with helpful feedback.
 */

interface PasswordStrengthMeterProps {
  password: string;
}

interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  feedback: string;
}

/**
 * Calculate password strength score and provide feedback
 */
function calculateStrength(password: string): StrengthResult {
  if (!password) {
    return { score: 0, label: '', color: '', feedback: '' };
  }

  let score = 0;
  const feedback: string[] = [];

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;

  // Character variety bonuses
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const varietyCount = [hasLowercase, hasUppercase, hasNumbers, hasSymbols].filter(Boolean).length;
  
  // Bonus for variety (but don't exceed max score)
  if (varietyCount >= 3 && score < 4) score = Math.min(4, score + 1);
  if (varietyCount === 4 && score < 4) score = Math.min(4, score + 1);

  // Cap score at 4
  const finalScore = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;

  // Generate feedback
  if (password.length < 12) {
    feedback.push('Use 12+ characters');
  }
  if (!hasUppercase && !hasNumbers && !hasSymbols) {
    feedback.push('Add numbers or symbols');
  }
  if (password.length >= 16 && varietyCount >= 3) {
    feedback.push('Excellent passphrase!');
  }

  const strengthLevels: Record<number, { label: string; color: string }> = {
    0: { label: '', color: '' },
    1: { label: 'Weak', color: '#ef4444' },      // red-500
    2: { label: 'Fair', color: '#f59e0b' },      // amber-500
    3: { label: 'Good', color: '#22c55e' },      // green-500
    4: { label: 'Strong', color: '#10b981' },    // emerald-500
  };

  return {
    score: finalScore,
    label: strengthLevels[finalScore].label,
    color: strengthLevels[finalScore].color,
    feedback: feedback[0] || '',
  };
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = calculateStrength(password);

  if (!password) {
    return null;
  }

  return (
    <div className="mt-2">
      {/* Strength bar */}
      <div className="flex gap-1 h-1.5">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="flex-1 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: level <= strength.score ? strength.color : 'rgba(128, 128, 128, 0.2)',
            }}
          />
        ))}
      </div>
      
      {/* Label and feedback */}
      <div className="flex justify-between items-center mt-1">
        <span 
          className="text-xs font-medium"
          style={{ color: strength.color }}
        >
          {strength.label}
        </span>
        {strength.feedback && (
          <span className="text-xs opacity-50">
            {strength.feedback}
          </span>
        )}
      </div>
    </div>
  );
}
