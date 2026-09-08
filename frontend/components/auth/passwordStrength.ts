export const MIN_PASSWORD_LENGTH = 8;

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  /** 0 = empty, 1 = weak / too short … 4 = strong. */
  score: StrengthScore;
  label: string;
  hint: string;
}

/** Cheap client-side strength estimate — a nudge, not a policy (the backend only enforces the minimum length). */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "", hint: `At least ${MIN_PASSWORD_LENGTH} characters.` };
  if (password.length < MIN_PASSWORD_LENGTH) {
    const left = MIN_PASSWORD_LENGTH - password.length;
    return { score: 1, label: "Too short", hint: `${left} more character${left === 1 ? "" : "s"} needed.` };
  }
  const mixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const digits = /\d/.test(password);
  const symbols = /[^A-Za-z0-9]/.test(password);
  const long = password.length >= 12;
  const variety = [mixedCase, digits, symbols].filter(Boolean).length;
  let score = Math.min(4, 1 + variety + (long ? 1 : 0)) as StrengthScore;
  if (!long && score > 3) score = 3;
  switch (score) {
    case 1:
      return { score, label: "Weak", hint: "Mix in numbers, symbols or capitals." };
    case 2:
      return { score, label: "Fair", hint: long ? "Add a symbol or a capital letter." : "Longer or more varied is safer." };
    case 3:
      return { score, label: "Good", hint: long ? "Add a symbol or a capital to make it strong." : "12+ characters would make it strong." };
    default:
      return { score: 4, label: "Strong", hint: "Strong password." };
  }
}
