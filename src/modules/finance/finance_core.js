/* Pure financial calculations. No DOM or database access; safe to unit-test independently. */
(function (root) {
  'use strict';
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const isSaleAffecting = tx => tx.kind === 'sale' || (tx.kind === 'correction' && tx.note === 'Koreksi penjualan');
  function summarizeSales(transactions) {
    const rows = (transactions || []).filter(isSaleAffecting);
    return {
      sold: rows.reduce((sum, tx) => sum + num(tx.quantity), 0),
      revenue: rows.reduce((sum, tx) => sum + num(tx.quantity) * num(tx.price), 0),
      cost: rows.reduce((sum, tx) => sum + num(tx.quantity) * num(tx.costPrice), 0),
      gross: rows.reduce((sum, tx) => sum + num(tx.quantity) * (num(tx.price) - num(tx.costPrice)), 0),
      count: rows.filter(tx => tx.kind === 'sale').length
    };
  }
  function calculateLedger({ transactions = [], daily = [], expenses = [], cashEntries = [] } = {}) {
    const sales = summarizeSales(transactions);
    const stockCost = transactions.filter(tx => tx.kind === 'stock_in').reduce((sum, tx) => sum + (tx.totalCost !== undefined ? num(tx.totalCost) : num(tx.quantity) * num(tx.costPrice)), 0);
    const operating = expenses.filter(row => !row.voided).reduce((sum, row) => sum + num(row.amount), 0);
    const cashOther = cashEntries.filter(row => !row.voided).reduce((sum, row) => sum + (row.kind === 'income' ? 1 : -1) * num(row.amount), 0);
    const inventory = daily.reduce((sum, row) => sum + Math.max(0, num(row.stockInitial) + num(row.stockAdded) - num(row.sold)) * num(row.costPrice), 0);
    return { ...sales, stockCost, operating, cash: sales.revenue - stockCost - operating + cashOther, inventory, net: sales.gross - operating };
  }
  root.StockFinanceCore = Object.freeze({ summarizeSales, calculateLedger, isSaleAffecting });
})(window);
