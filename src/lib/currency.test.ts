import test from "node:test";
import assert from "node:assert/strict";
import { convert, FALLBACK_RATES_TO_USD } from "./currency";
import { convertCurrency, fmtMoney } from "./utils";

test("currency - cross-rate conversion through USD base", () => {
  const rates = {
    USD: 1,
    PHP: 58.0,
    JPY: 150.0,
    EUR: 0.9,
  };

  // Same currency identity
  assert.equal(convert(100, "USD", "USD", rates), 100);
  assert.equal(convert(1000, "JPY", "JPY", rates), 1000);

  // 150 JPY = 1 USD -> 58 PHP
  const jpyToPhp = convert(150, "JPY", "PHP", rates);
  assert.equal(Math.round(jpyToPhp), 58);

  // 58 PHP = 1 USD = 0.9 EUR
  const phpToEur = convert(58, "PHP", "EUR", rates);
  assert.equal(Math.round(phpToEur * 10) / 10, 0.9);

  // Unknown currency fallback returns original amount
  assert.equal(convert(500, "XYZ", "PHP", rates), 500);
  assert.equal(convert(500, "PHP", "XYZ", rates), 500);
});

test("currency - convertCurrency helper matches convert", () => {
  const rates = FALLBACK_RATES_TO_USD;
  const res1 = convert(10000, "JPY", "PHP", rates);
  const res2 = convertCurrency(10000, "JPY", "PHP", rates);
  assert.equal(res1, res2);
});

test("currency - fmtMoney formatting handles standard symbols", () => {
  assert.equal(fmtMoney(1500, "JPY"), "¥1,500");
  assert.equal(fmtMoney(2500, "PHP"), "₱2,500");
  assert.equal(fmtMoney(2500.5, "PHP"), "₱2,500.5");
  assert.equal(fmtMoney(100, "USD"), "$100");
  assert.equal(fmtMoney(50, "EUR"), "€50");
  assert.equal(fmtMoney(75, "GBP"), "£75");
});
