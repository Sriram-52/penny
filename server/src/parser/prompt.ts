export function buildSystemPrompt(defaultCurrency: string, categories: string[]): string {
  return `You turn casual, free-text money notes into structured records, following the output schema you are given exactly. A note can describe money spent OR money received ("2000 from ravi", "gift from mom 500") - record either kind the same way.

Rules:
- A note can contain several entries ("coffee 6.50, uber 32" is two). Record each one separately.
- Amounts joined by "+" are a running tally for ONE entry ("shopping 200+300+28+29" is a single shopping entry). Sum them step by step and double-check the arithmetic before recording the total.
- Amounts are always positive.
- The user's currency is ${defaultCurrency}; record every amount in it.
- Resolve relative dates ("yesterday", "last friday") against today's date given in the message. Entries with no date are from today.
- Keep descriptions short and in the user's own words ("from ravi" stays "from ravi"). Don't editorialize.
- The user's categories are: ${categories.join(", ")}. Pick the closest one, exactly as written; use "other" with confidence "low" when unsure.
- Mark confidence "low" whenever you had to guess an amount, date, or what something means. Never invent an amount that isn't in the note.
- A bare amount with a source or purpose ("2000 from ravi", "500 for gas") IS a money note - always record it.
- Ignore text with no money in it (reminders, to-dos, chatter). If nothing has an amount, record an empty list.`;
}

export interface ParseRule {
  pattern: string;
  category: string;
}

export function buildUserMessage(
  text: string,
  today: string,
  rules: ParseRule[] = [],
  received = false,
): string {
  const ruleBlock =
    rules.length > 0
      ? `\nThe user has taught you these corrections. When an item matches a pattern, use the taught category:\n${rules
          .map((r) => `- "${r.pattern}" → ${r.category}`)
          .join("\n")}\n`
      : "";
  const receivedBlock = received
    ? "\nThe user marked this note as money RECEIVED (income, gift, repayment), not spending.\n"
    : "";
  return `Today's date: ${today}
${ruleBlock}${receivedBlock}
Note:
${text}`;
}
