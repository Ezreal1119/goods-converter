import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import {
  GOODS_TEMP_COLUMNS,
  type GoodsTempColumn,
  type GoodsTempRow,
} from "./convert";

const WORKSHEET_PATH = "xl/worksheets/sheet1.xml";
const LAST_COLUMN = "X";

const NUMERIC_COLUMNS = new Set<GoodsTempColumn>([
  "retailPrice",
  "promotionPrice",
  "stock",
]);

function columnName(index: number): string {
  let column = "";
  let value = index + 1;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }

  return column;
}

function escapeXmlText(value: string): string {
  const validXmlText = Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);

      return code > 31 || code === 9 || code === 10 || code === 13;
    })
    .join("");

  return validXmlText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeCellValue(value: string | number): string {
  return String(value);
}

function buildCellXml(
  rowIndex: number,
  columnIndex: number,
  column: GoodsTempColumn,
  value: string | number,
): string {
  const normalized = normalizeCellValue(value);

  if (normalized === "") {
    return "";
  }

  const reference = `${columnName(columnIndex)}${rowIndex}`;

  if (NUMERIC_COLUMNS.has(column) && typeof value === "number") {
    return `<c r="${reference}"><v>${value}</v></c>`;
  }

  return `<c r="${reference}" t="inlineStr"><is><t>${escapeXmlText(
    normalized,
  )}</t></is></c>`;
}

function buildDataRowXml(row: GoodsTempRow, rowIndex: number): string {
  const cells = GOODS_TEMP_COLUMNS.map((column, columnIndex) =>
    buildCellXml(rowIndex, columnIndex, column, row[column]),
  ).join("");

  return `<row r="${rowIndex}" spans="1:${GOODS_TEMP_COLUMNS.length}">${cells}</row>`;
}

function getHeaderRowXml(sheetDataXml: string): string {
  const headerRowMatch = sheetDataXml.match(/<row\b[^>]*\br="1"[^>]*>[\s\S]*?<\/row>/);

  if (!headerRowMatch) {
    throw new Error("GoodsTemp 模板中找不到第 1 行表头。");
  }

  return headerRowMatch[0];
}

function replaceDimension(sheetXml: string, lastRow: number): string {
  return sheetXml.replace(
    /<dimension\b[^>]*\/>/,
    `<dimension ref="A1:${LAST_COLUMN}${lastRow}"/>`,
  );
}

function replaceSheetData(sheetXml: string, rows: GoodsTempRow[]): string {
  const sheetDataMatch = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);

  if (!sheetDataMatch) {
    throw new Error("GoodsTemp 模板中找不到 sheetData。");
  }

  const headerRowXml = getHeaderRowXml(sheetDataMatch[1]);
  const dataRowsXml = rows
    .map((row, index) => buildDataRowXml(row, index + 2))
    .join("");

  return sheetXml.replace(
    /<sheetData>[\s\S]*?<\/sheetData>/,
    `<sheetData>${headerRowXml}${dataRowsXml}</sheetData>`,
  );
}

export function fillGoodsTempTemplate(
  templateBuffer: ArrayBuffer,
  rows: GoodsTempRow[],
): Uint8Array {
  const files = unzipSync(new Uint8Array(templateBuffer));
  const worksheet = files[WORKSHEET_PATH];

  if (!worksheet) {
    throw new Error("GoodsTemp 模板中找不到 Sheet1 工作表。");
  }

  const lastRow = Math.max(rows.length + 1, 1);
  const sheetXml = strFromU8(worksheet);
  const updatedSheetXml = replaceSheetData(
    replaceDimension(sheetXml, lastRow),
    rows,
  );

  files[WORKSHEET_PATH] = strToU8(updatedSheetXml);

  return zipSync(files);
}
