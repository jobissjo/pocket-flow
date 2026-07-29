import { getDatabase, getCategoryBudgetUtilization } from './db';

export interface AIResponse {
  content: string;
  type: 'text' | 'chart';
  structured_data?: string;
}

export async function processAIQuery(queryText: string): Promise<AIResponse> {
  const db = await getDatabase();
  const lowerQuery = queryText.toLowerCase();

  // 1. Budget status query
  if (lowerQuery.includes('budget') || lowerQuery.includes('status') || lowerQuery.includes('limit')) {
    const budgetList = await getCategoryBudgetUtilization();

    let md = `### Budget Status Update\n\nHere is your current budget utilization:\n\n`;
    const chartData: { name: string; spent: number; limit: number; percent: number }[] = [];

    if (budgetList.length === 0) {
      md += `*No active category budgets set up yet. Tap "Manage limits" on your home dashboard to set up budget limits!*`;
    } else {
      budgetList.forEach(item => {
        const percent = item.limit > 0 ? Math.round((item.spent / item.limit) * 100) : 0;
        chartData.push({ name: item.category, spent: item.spent, limit: item.limit, percent });

        const statusIcon = percent > 95 ? '🔴 Over Limit' : percent > 75 ? '🟡 Warning' : '🟢 On Track';
        md += `- **${item.category}**: $${item.spent.toFixed(2)} / $${item.limit.toFixed(2)} (${percent}%) - *${statusIcon}*\n`;
      });

      md += `\nKeep an eye on the budgets highlighted in yellow or red. Overall, you are managing your finances well this month!`;
    }

    return {
      content: md,
      type: 'chart',
      structured_data: JSON.stringify({
        chartType: 'budget',
        data: chartData
      })
    };
  }

  // Helper list of limits
  function limitsList() {
    return ['Food', 'Transport', 'Shopping', 'Grocery'];
  }

  // 2. Spending Category breakdown / Most Spent
  if (lowerQuery.includes('spend') || lowerQuery.includes('spent') || lowerQuery.includes('most') || lowerQuery.includes('highest') || lowerQuery.includes('expense')) {
    const rows = await db.getAllAsync<{ category: string; total: number }>(
      `SELECT category, ABS(SUM(amount)) as total 
       FROM transactions 
       WHERE type = 'expense' 
       GROUP BY category 
       ORDER BY total DESC`
    );

    if (rows.length === 0) {
      return {
        content: `You haven't recorded any expenses yet! Use the **Add Transaction** screen to log some spending.`,
        type: 'text'
      };
    }

    const totalExpenseRow = await db.getFirstAsync<{ total: number }>(
      `SELECT ABS(SUM(amount)) as total FROM transactions WHERE type = 'expense'`
    );
    const grandTotal = totalExpenseRow?.total || 1;

    let md = `### Spending Breakdown\n\nYour highest expenses this month are listed below:\n\n`;
    const chartData: { category: string; amount: number; percentage: number }[] = [];

    rows.forEach((row) => {
      const percentage = Math.round((row.total / grandTotal) * 100);
      chartData.push({ category: row.category, amount: row.total, percentage });
      md += `- **${row.category}**: $${row.total.toFixed(2)} (${percentage}% of total)\n`;
    });

    md += `\nTotal spending: **$${grandTotal.toFixed(2)}**`;

    return {
      content: md,
      type: 'chart',
      structured_data: JSON.stringify({
        chartType: 'spend_breakdown',
        data: chartData
      })
    };
  }

  // 3. Category Specific query (Food, Dining, etc.)
  const categories = ['food', 'dining', 'travel', 'transport', 'grocery', 'shopping', 'digital', 'services', 'housing', 'electronics'];
  const matchedCategory = categories.find(cat => lowerQuery.includes(cat));
  
  if (matchedCategory) {
    // Map dining to food or dining in DB
    const dbCategory = matchedCategory === 'dining' ? 'Dining' : matchedCategory.charAt(0).toUpperCase() + matchedCategory.slice(1);
    
    const sumRow = await db.getFirstAsync<{ total: number; count: number }>(
      `SELECT ABS(SUM(amount)) as total, COUNT(*) as count 
       FROM transactions 
       WHERE type = 'expense' AND LOWER(category) = ?`,
      [dbCategory.toLowerCase()]
    );

    const total = sumRow?.total || 0;
    const count = sumRow?.count || 0;

    if (count === 0) {
      return {
        content: `I couldn't find any expenses in the **${dbCategory}** category. You can add one anytime!`,
        type: 'text'
      };
    }

    const recent = await db.getAllAsync<{ note: string; amount: number; date: string }>(
      `SELECT note, amount, date 
       FROM transactions 
       WHERE type = 'expense' AND LOWER(category) = ? 
       ORDER BY date DESC 
       LIMIT 5`,
      [dbCategory.toLowerCase()]
    );

    let md = `### ${dbCategory} Spending Summary\n\n`;
    md += `You spent a total of **$${total.toFixed(2)}** across **${count}** transaction${count > 1 ? 's' : ''}.\n\n`;
    md += `**Recent Transactions:**\n`;
    
    recent.forEach(r => {
      const dateStr = new Date(r.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
      md += `- *${dateStr}*: ${r.note || 'No description'} — **$${Math.abs(r.amount).toFixed(2)}**\n`;
    });

    return {
      content: md,
      type: 'text'
    };
  }

  // 4. Affordability Check
  const amountRegex = /(?:\$|usd)?\s*(\d+(?:[.,]\d{2})?)/i;
  const match = lowerQuery.match(amountRegex);
  if (lowerQuery.includes('afford') || lowerQuery.includes('buy') || lowerQuery.includes('purchase')) {
    if (match && match[1]) {
      const price = parseFloat(match[1].replace(',', ''));
      
      const balanceRow = await db.getFirstAsync<{ total: number }>(
        `SELECT SUM(balance) as total FROM accounts`
      );
      const totalBalance = balanceRow?.total || 0;

      const goalsRow = await db.getFirstAsync<{ remaining: number }>(
        `SELECT SUM(target_amount - current_amount) as remaining FROM savings_goals`
      );
      const remainingGoals = goalsRow?.remaining || 0;

      const availableFunds = totalBalance - remainingGoals;

      let md = `### Affordability Analysis (for $${price.toLocaleString()})\n\n`;
      md += `*   **Total Balances:** $${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
      md += `*   **Committed Savings Goals:** $${remainingGoals.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
      md += `*   **Unallocated Available Funds:** $${availableFunds.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n\n`;

      if (totalBalance < price) {
        md += `⚠️ **Recommendation:** No, your current total balance ($${totalBalance.toFixed(2)}) is less than the purchase price. We advise holding off until you accumulate more savings.`;
      } else if (availableFunds >= price) {
        md += `✅ **Recommendation:** Yes! You can afford this comfortably using your unallocated funds ($${availableFunds.toFixed(2)}) without disrupting your savings goals.`;
      } else {
        const deficit = price - availableFunds;
        md += `🤔 **Recommendation:** You have the money in your account ($${totalBalance.toFixed(2)}), but allocating $${price.toFixed(2)} to this purchase will draw **$${deficit.toFixed(2)}** from your active savings goals (e.g. New Car, Emergency Fund). If you proceed, consider extending your goal target dates!`;
      }

      return {
        content: md,
        type: 'text'
      };
    } else {
      return {
        content: `I can help you check if you can afford a purchase! Just specify the amount, for example: *"Can I afford to buy a camera for $850?"*`,
        type: 'text'
      };
    }
  }

  // 5. Default Fallback
  return {
    content: `I'm here to help, Alex! 

You can ask me questions like:
*   *"Where did I spend most this month?"* (Shows category chart)
*   *"Show my food expenses"* (Shows list and totals)
*   *"What is my budget status?"* (Shows limits vs actual progress)
*   *"Can I afford a laptop for $1,200?"* (Runs an affordability calculation against your offline accounts and savings goals)
*   *"List transactions"* (Searches recent records)

All analytics run completely offline on your device for absolute privacy.`,
    type: 'text'
  };
}
