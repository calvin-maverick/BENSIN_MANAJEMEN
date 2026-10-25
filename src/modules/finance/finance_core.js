/* Pure financial calculations. No DOM or database access; safe to unit-test independently. */
(function (root) {
  'use strict';
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const affectsSales = tx => tx.kind === 'sale' || (tx.kind === 'correction' && tx.note === 'Koreksi penjualan');
  const sourceKey = value => ['bensin', 'tanah', 'tambahan'].includes(value) ? value : 'tambahan';

  function summarizeSales(transactions) {
    const rows = (transactions || []).filter(affectsSales);
    return {
      sold: rows.reduce((sum, tx) => sum + num(tx.quantity), 0),
      revenue: rows.reduce((sum, tx) => sum + num(tx.quantity) * num(tx.price), 0),
      cost: rows.reduce((sum, tx) => sum + num(tx.quantity) * num(tx.costPrice), 0),
      gross: rows.reduce((sum, tx) => sum + num(tx.quantity) * (num(tx.price) - num(tx.costPrice)), 0),
      count: rows.filter(tx => tx.kind === 'sale').length
    };
  }

  function calculateLedger({ transactions = [], daily = [], expenses = [], cashEntries = [] } = {}) {
    const validExpenses = expenses.filter(row => !row.voided);
    const validCash = cashEntries.filter(row => !row.voided);
    const sales = summarizeSales(transactions);
    const stockIn = transactions.filter(tx => tx.kind === 'stock_in');
    const stockCost = stockIn.reduce((sum, tx) => sum + (tx.totalCost !== undefined ? num(tx.totalCost) : num(tx.quantity) * num(tx.costPrice)), 0);
    const stockCostByCategory = { bensin: 0, tanah: 0 };
    for (const tx of stockIn) stockCostByCategory[tx.category === 'bensin' ? 'bensin' : 'tanah'] += tx.totalCost !== undefined ? num(tx.totalCost) : num(tx.quantity) * num(tx.costPrice);
    const revenueByCategory = { bensin: 0, tanah: 0 };
    for (const tx of transactions.filter(affectsSales)) revenueByCategory[tx.category === 'bensin' ? 'bensin' : 'tanah'] += num(tx.quantity) * num(tx.price);
    const expensesBySource = { bensin: 0, tanah: 0, tambahan: 0 };
    for (const row of validExpenses) expensesBySource[sourceKey(row.source)] += num(row.amount);
    const cashBySource = { bensin: 0, tanah: 0, tambahan: 0 };
    for (const row of validCash) cashBySource[sourceKey(row.source)] += (row.kind === 'income' ? 1 : -1) * num(row.amount);
    const categoryCashEntries = { bensin: 0, tanah: 0 };
    for (const row of validCash) if (row.source === 'bensin' || row.source === 'tanah') categoryCashEntries[row.source] += (row.kind === 'income' ? 1 : -1) * num(row.amount);
    const operating = validExpenses.filter(row => row.expenseType !== 'capital').reduce((sum, row) => sum + num(row.amount), 0);
    const capitalExpenses = validExpenses.filter(row => row.expenseType === 'capital').reduce((sum, row) => sum + num(row.amount), 0);
    const inventory = daily.reduce((sum, row) => sum + Math.max(0, num(row.stockInitial) + num(row.stockAdded) - num(row.sold)) * num(row.costPrice), 0);
    const sourceBalances = {
      bensin: revenueByCategory.bensin - stockCostByCategory.bensin - expensesBySource.bensin + cashBySource.bensin,
      tanah: revenueByCategory.tanah - stockCostByCategory.tanah - expensesBySource.tanah + cashBySource.tanah,
      tambahan: cashBySource.tambahan - expensesBySource.tambahan
    };
    const cash = sourceBalances.bensin + sourceBalances.tanah + sourceBalances.tambahan;
    return { ...sales, stockCost, operating, capitalExpenses, cash, inventory, net: sales.gross - operating, sourceBalances };
  }
  root.StockFinanceCore = Object.freeze({ summarizeSales, calculateLedger, affectsSales });
})(window);
