export interface Transaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string; // ISO 'yyyy-MM-dd'
}

export interface SavingsGoal {
  id: string;
  title: string;
  saved: number;
  target: number;
}
