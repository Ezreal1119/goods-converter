import { useMemo, useState } from "react";
import Papa from "papaparse";

import {
  convertRow,
  isRepeatedHeader,
  validateRow,
  type GoodsTempRow,
  type SourceRow,
} from "./conversion/convert";
import { fillGoodsTempTemplate } from "./conversion/workbookTemplate";

import "./App.css";

type ConversionResult = {
  rows: GoodsTempRow[];
  skippedRows: number;
  warnings: string[];
};

function App() {
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const previewRows = useMemo(() => {
    return result?.rows.slice(0, 10) ?? [];
  }, [result]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setResult(null);
    setErrorMessage("");

    if (!file) {
      setFileName("");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("请选择 CSV 文件。");
      event.target.value = "";
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);

    try {
      const csvText = await file.text();

      Papa.parse<SourceRow>(csvText, {
        header: true,
        skipEmptyLines: true,

        complete: (parseResult) => {
          const convertedRows: GoodsTempRow[] = [];
          const warnings: string[] = [];
          let skippedRows = 0;

          parseResult.data.forEach((sourceRow, index) => {
            if (isRepeatedHeader(sourceRow)) {
              skippedRows += 1;
              return;
            }

            const converted = convertRow(sourceRow);

            if (!converted.goodsCode) {
              skippedRows += 1;
              warnings.push(`第 ${index + 2} 行没有商品编码，已跳过。`);
              return;
            }

            warnings.push(...validateRow(converted, index + 1));
            convertedRows.push(converted);
          });

          if (parseResult.errors.length > 0) {
            parseResult.errors.forEach((error) => {
              warnings.push(
                `CSV 解析警告：第 ${error.row ?? "未知"} 行，${error.message}`,
              );
            });
          }

          setResult({
            rows: convertedRows,
            skippedRows,
            warnings,
          });

          setIsProcessing(false);
        },

        error: (error: Error) => {
          setErrorMessage(`CSV 读取失败：${error.message}`);
          setIsProcessing(false);
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";

      setErrorMessage(`文件处理失败：${message}`);
      setIsProcessing(false);
    }
  }

  async function downloadGoodsTemp() {
    if (!result || result.rows.length === 0) {
      setErrorMessage("目前没有可以导出的商品数据。");
      return;
    }

    setErrorMessage("");

    try {
      const templateResponse = await fetch("/templates/GoodsTemp.xlsx");

      if (!templateResponse.ok) {
        throw new Error(
          `无法读取 GoodsTemp 模板：HTTP ${templateResponse.status}`,
        );
      }

      const templateBuffer = await templateResponse.arrayBuffer();
      const workbookBytes = fillGoodsTempTemplate(templateBuffer, result.rows);
      const workbookBuffer = new ArrayBuffer(workbookBytes.byteLength);
      new Uint8Array(workbookBuffer).set(workbookBytes);

      const sourceBaseName = fileName.replace(/\.csv$/i, "") || "GoodsTemp";
      const workbookBlob = new Blob([workbookBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const downloadUrl = URL.createObjectURL(workbookBlob);
      const downloadLink = document.createElement("a");

      downloadLink.href = downloadUrl;
      downloadLink.download = `${sourceBaseName}_GoodsTemp.xlsx`;
      document.body.append(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";

      setErrorMessage(`Excel 导出失败：${message}`);
    }
  }

  return (
    <main className="page-shell">
      <section className="converter-card">
        <header className="page-header">
          <div>
            <p className="eyebrow">CSV CONVERTER</p>
            <h1>GoodsTemp 转换工具</h1>
            <p className="subtitle">
              上传商品 CSV，检查转换结果，然后下载 GoodsTemp.xlsx。
              文件只在当前浏览器中处理。
            </p>
          </div>
        </header>

        <section className="upload-section">
          <label className="upload-box">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
            />

            <span className="upload-title">选择 CSV 文件</span>

            <span className="upload-description">
              {fileName || "点击这里选择需要转换的商品文件"}
            </span>
          </label>
        </section>

        {isProcessing && <div className="status-message">正在读取 CSV……</div>}

        {errorMessage && <div className="error-message">{errorMessage}</div>}

        {result && (
          <>
            <section className="summary-grid">
              <div className="summary-card">
                <span>有效商品</span>
                <strong>{result.rows.length}</strong>
              </div>

              <div className="summary-card">
                <span>跳过数据</span>
                <strong>{result.skippedRows}</strong>
              </div>

              <div className="summary-card">
                <span>警告数量</span>
                <strong>{result.warnings.length}</strong>
              </div>
            </section>

            <section className="preview-section">
              <div className="section-heading">
                <div>
                  <h2>转换预览</h2>
                  <p>这里只显示前 10 条，下载文件包含全部数据。</p>
                </div>

                <button
                  className="download-button"
                  onClick={downloadGoodsTemp}
                  type="button"
                >
                  下载 GoodsTemp.xlsx
                </button>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>goodsCode</th>
                      <th>goodsName</th>
                      <th>goodsBrand</th>
                      <th>goodsBarCode</th>
                      <th>retailPrice</th>
                      <th>promotionPrice</th>
                      <th>goodsStatus</th>
                    </tr>
                  </thead>

                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr key={`${row.goodsCode}-${index}`}>
                        <td>{row.goodsCode}</td>
                        <td>{row.goodsName}</td>
                        <td>{row.goodsBrand}</td>
                        <td>{row.goodsBarCode}</td>
                        <td>{row.retailPrice}</td>
                        <td>{row.promotionPrice}</td>
                        <td>{row.goodsStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {result.warnings.length > 0 && (
              <section className="warning-section">
                <h2>检查结果</h2>

                <ul>
                  {result.warnings.slice(0, 30).map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>

                {result.warnings.length > 30 && (
                  <p>另外还有 {result.warnings.length - 30} 条警告未显示。</p>
                )}
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default App;
