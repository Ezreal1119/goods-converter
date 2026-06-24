export const GOODS_TEMP_COLUMNS = [
  "goodsCode",
  "goodsName",
  "goodsAlias",
  "goodsStatus",
  "goodsUnit",
  "goodsBrand",
  "goodsOrigin",
  "goodsQrCode",
  "goodsBarType",
  "goodsBarCode",
  "goodsLevel",
  "goodsFirstType",
  "goodsSecondType",
  "goodsThirdType",
  "supervisionPhone",
  "priceClerk",
  "remark",
  "retailPrice",
  "promotionPrice",
  "promotionStartDate",
  "promotionEndDate",
  "spec",
  "category",
  "stock",
] as const;

export type GoodsTempColumn = (typeof GOODS_TEMP_COLUMNS)[number];

export type SourceRow = Record<string, unknown>;

export type GoodsTempRow = Record<GoodsTempColumn, string | number>;

function cleanText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function parseNumber(value: unknown): number | "" {
  const text = cleanText(value);

  if (!text) {
    return "";
  }

  const number = Number(text.replace(/,/g, ""));

  return Number.isFinite(number) ? number : "";
}

function convertStatus(value: unknown): string {
  const status = cleanText(value).toUpperCase();

  // 暂定规则，之后按照你的正式规则修改
  if (status === "A") {
    return "1";
  }

  if (status === "D") {
    return "0";
  }

  return status;
}

function buildSpecification(row: SourceRow): string {
  const values = [
    cleanText(row.Z1NetContent),
    cleanText(row.Z1NetWeight),
    cleanText(row.EnNetContent),
    cleanText(row.EnNetWeight),
  ].filter(Boolean);

  return [...new Set(values)].join(" ");
}

export function isRepeatedHeader(row: SourceRow): boolean {
  return (
    cleanText(row.id).toLowerCase() === "id" ||
    cleanText(row.ArticleNo).toLowerCase() === "articleno" ||
    cleanText(row.Barcode).toLowerCase() === "barcode"
  );
}

export function convertRow(row: SourceRow): GoodsTempRow {
  return {
    goodsCode: cleanText(row.ArticleNo),

    // 暂定使用中文名称作为主名称
    goodsName:
      cleanText(row.Z1ArticleLongDesc) || cleanText(row.EnArticleLongDesc),

    goodsAlias: cleanText(row.EnArticleLongDesc),

    goodsStatus: convertStatus(row.ArticleStatus),

    // 暂定固定值
    goodsUnit: "PCS",

    goodsBrand: cleanText(row.BrandDesc),
    goodsOrigin: cleanText(row.Coo),

    goodsQrCode: "",

    // 暂定固定值
    goodsBarType: "CODE_128",

    goodsBarCode: cleanText(row.Barcode),

    goodsLevel: "",
    goodsFirstType: "",
    goodsSecondType: "",
    goodsThirdType: "",
    supervisionPhone: "",
    priceClerk: "",
    remark: "",

    retailPrice: parseNumber(row.RetailPrice),
    promotionPrice: parseNumber(row.PromotionPrice),

    promotionStartDate: cleanText(row.ValidFromDate),
    promotionEndDate: cleanText(row.ValidToDate),

    spec: buildSpecification(row),
    category: cleanText(row.Department),

    // 暂定固定值
    stock: 0,
  };
}

export function validateRow(row: GoodsTempRow, sourceIndex: number): string[] {
  const errors: string[] = [];

  if (!row.goodsCode) {
    errors.push(`第 ${sourceIndex + 1} 行缺少商品编码`);
  }

  if (!row.goodsName) {
    errors.push(`第 ${sourceIndex + 1} 行缺少商品名称`);
  }

  if (!row.goodsBarCode) {
    errors.push(`第 ${sourceIndex + 1} 行缺少商品条码`);
  }

  return errors;
}
