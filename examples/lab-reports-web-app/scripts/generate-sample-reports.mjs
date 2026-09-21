/**
 * Generate the synthetic sample lab-report PDFs that ship with this example.
 * Entirely fictional patients and laboratory; every page carries a synthetic
 * marker. Layout mimics a typical lab printout (Test | Result | Units |
 * Reference | Flag) so Terra's standardization parses ranges and flags.
 *
 * Usage: node scripts/generate-sample-reports.mjs   (writes sample-reports/)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const CHROME =
  process.env.CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const outDir = resolve("sample-reports");
mkdirSync(outDir, { recursive: true });

/** row: [name, result, units, refLow, refHigh, flag?] */
const REPORTS = [
  {
    file: "marcus-reid-2023-05-10.pdf",
    patient: "REID, MARCUS",
    dob: "02/11/1968",
    sex: "Male",
    collected: "10 May 2023",
    reported: "11 May 2023",
    accession: "MCL-23-048291",
    sections: {
      "Lipid Panel": [
        ["Cholesterol, Total", "205", "mg/dL", "125", "200", "H"],
        ["Triglycerides", "140", "mg/dL", "40", "150", ""],
        ["HDL Cholesterol", "48", "mg/dL", "40", "60", ""],
        ["LDL Cholesterol (Calculated)", "132", "mg/dL", "50", "130", "H"],
      ],
      "Comprehensive Metabolic Panel": [
        ["Glucose", "96", "mg/dL", "74", "99", ""],
        ["Urea Nitrogen (BUN)", "16", "mg/dL", "7", "25", ""],
        ["Creatinine", "1.02", "mg/dL", "0.70", "1.30", ""],
        ["Sodium", "140", "mmol/L", "135", "146", ""],
        ["Potassium", "4.3", "mmol/L", "3.5", "5.3", ""],
        ["Chloride", "102", "mmol/L", "98", "110", ""],
        ["Calcium", "9.4", "mg/dL", "8.6", "10.3", ""],
        ["Total Protein", "7.1", "g/dL", "6.1", "8.1", ""],
        ["Albumin", "4.5", "g/dL", "3.6", "5.1", ""],
        ["Total Bilirubin", "0.7", "mg/dL", "0.2", "1.2", ""],
        ["Alkaline Phosphatase", "68", "U/L", "36", "130", ""],
        ["AST (SGOT)", "24", "U/L", "10", "40", ""],
        ["ALT (SGPT)", "27", "U/L", "9", "46", ""],
      ],
      "Complete Blood Count": [
        ["White Blood Cell Count", "6.4", "10*3/uL", "3.8", "10.8", ""],
        ["Red Blood Cell Count", "5.02", "10*6/uL", "4.20", "5.80", ""],
        ["Hemoglobin", "15.1", "g/dL", "13.2", "17.1", ""],
        ["Hematocrit", "44.6", "%", "38.5", "50.0", ""],
        ["Platelet Count", "241", "10*3/uL", "140", "400", ""],
      ],
      "Additional Chemistry": [
        ["Hemoglobin A1c", "5.4", "%", "4.0", "5.6", ""],
        ["TSH", "2.10", "uIU/mL", "0.40", "4.50", ""],
        ["Vitamin D, 25-Hydroxy", "38", "ng/mL", "30", "100", ""],
        ["C-Reactive Protein", "1.1", "mg/L", "0.0", "3.0", ""],
        ["Ferritin", "182", "ng/mL", "38", "380", ""],
        ["Creatine Kinase, Total", "112", "U/L", "44", "196", ""],
      ],
    },
  },
  {
    file: "marcus-reid-2024-09-05.pdf",
    patient: "REID, MARCUS",
    dob: "02/11/1968",
    sex: "Male",
    collected: "05 Sep 2024",
    reported: "06 Sep 2024",
    accession: "MCL-24-113306",
    sections: {
      "Lipid Panel": [
        ["Cholesterol, Total", "214", "mg/dL", "125", "200", "H"],
        ["Triglycerides", "158", "mg/dL", "40", "150", "H"],
        ["HDL Cholesterol", "47", "mg/dL", "40", "60", ""],
        ["LDL Cholesterol (Calculated)", "139", "mg/dL", "50", "130", "H"],
      ],
      "Comprehensive Metabolic Panel": [
        ["Glucose", "101", "mg/dL", "74", "99", "H"],
        ["Urea Nitrogen (BUN)", "17", "mg/dL", "7", "25", ""],
        ["Creatinine", "1.05", "mg/dL", "0.70", "1.30", ""],
        ["Sodium", "139", "mmol/L", "135", "146", ""],
        ["Potassium", "4.4", "mmol/L", "3.5", "5.3", ""],
        ["Chloride", "103", "mmol/L", "98", "110", ""],
        ["Calcium", "9.3", "mg/dL", "8.6", "10.3", ""],
        ["Total Protein", "7.0", "g/dL", "6.1", "8.1", ""],
        ["Albumin", "4.4", "g/dL", "3.6", "5.1", ""],
        ["Total Bilirubin", "0.8", "mg/dL", "0.2", "1.2", ""],
        ["Alkaline Phosphatase", "71", "U/L", "36", "130", ""],
        ["AST (SGOT)", "26", "U/L", "10", "40", ""],
        ["ALT (SGPT)", "30", "U/L", "9", "46", ""],
      ],
      "Complete Blood Count": [
        ["White Blood Cell Count", "6.8", "10*3/uL", "3.8", "10.8", ""],
        ["Red Blood Cell Count", "4.96", "10*6/uL", "4.20", "5.80", ""],
        ["Hemoglobin", "14.9", "g/dL", "13.2", "17.1", ""],
        ["Hematocrit", "44.1", "%", "38.5", "50.0", ""],
        ["Platelet Count", "236", "10*3/uL", "140", "400", ""],
      ],
      "Additional Chemistry": [
        ["Hemoglobin A1c", "5.6", "%", "4.0", "5.6", ""],
        ["TSH", "2.34", "uIU/mL", "0.40", "4.50", ""],
        ["Vitamin D, 25-Hydroxy", "29", "ng/mL", "30", "100", "L"],
        ["C-Reactive Protein", "1.8", "mg/L", "0.0", "3.0", ""],
        ["Ferritin", "210", "ng/mL", "38", "380", ""],
        ["Creatine Kinase, Total", "147", "U/L", "44", "196", ""],
      ],
    },
  },
  {
    file: "marcus-reid-2026-07-15.pdf",
    patient: "REID, MARCUS",
    dob: "02/11/1968",
    sex: "Male",
    collected: "15 Jul 2026",
    reported: "16 Jul 2026",
    accession: "MCL-26-201744",
    sections: {
      "Lipid Panel": [
        ["Cholesterol, Total", "224", "mg/dL", "125", "200", "H"],
        ["Triglycerides", "128", "mg/dL", "40", "150", ""],
        ["HDL Cholesterol", "51", "mg/dL", "40", "60", ""],
        ["LDL Cholesterol (Calculated)", "146", "mg/dL", "50", "130", "H"],
      ],
      "Comprehensive Metabolic Panel": [
        ["Glucose", "98", "mg/dL", "74", "99", ""],
        ["Urea Nitrogen (BUN)", "18", "mg/dL", "7", "25", ""],
        ["Creatinine", "1.08", "mg/dL", "0.70", "1.30", ""],
        ["Sodium", "141", "mmol/L", "135", "146", ""],
        ["Potassium", "4.2", "mmol/L", "3.5", "5.3", ""],
        ["Chloride", "104", "mmol/L", "98", "110", ""],
        ["Calcium", "9.5", "mg/dL", "8.6", "10.3", ""],
        ["Total Protein", "7.2", "g/dL", "6.1", "8.1", ""],
        ["Albumin", "4.6", "g/dL", "3.6", "5.1", ""],
        ["Total Bilirubin", "0.6", "mg/dL", "0.2", "1.2", ""],
        ["Alkaline Phosphatase", "74", "U/L", "36", "130", ""],
        ["AST (SGOT)", "41", "U/L", "10", "40", "H"],
        ["ALT (SGPT)", "38", "U/L", "9", "46", ""],
      ],
      "Complete Blood Count": [
        ["White Blood Cell Count", "7.1", "10*3/uL", "3.8", "10.8", ""],
        ["Red Blood Cell Count", "5.05", "10*6/uL", "4.20", "5.80", ""],
        ["Hemoglobin", "14.6", "g/dL", "13.2", "17.1", ""],
        ["Hematocrit", "43.8", "%", "38.5", "50.0", ""],
        ["Platelet Count", "229", "10*3/uL", "140", "400", ""],
      ],
      "Additional Chemistry": [
        ["Hemoglobin A1c", "5.5", "%", "4.0", "5.6", ""],
        ["TSH", "2.22", "uIU/mL", "0.40", "4.50", ""],
        ["Vitamin D, 25-Hydroxy", "24", "ng/mL", "30", "100", "L"],
        ["C-Reactive Protein", "0.9", "mg/L", "0.0", "3.0", ""],
        ["Ferritin", "236", "ng/mL", "38", "380", ""],
        ["Creatine Kinase, Total", "385", "U/L", "44", "196", "H"],
      ],
    },
  },
  {
    file: "elena-vasquez-2026-06-20.pdf",
    patient: "VASQUEZ, ELENA",
    dob: "22/07/1991",
    sex: "Female",
    collected: "20 Jun 2026",
    reported: "21 Jun 2026",
    accession: "MCL-26-198122",
    sections: {
      "Lipid Panel": [
        ["Cholesterol, Total", "168", "mg/dL", "125", "200", ""],
        ["Triglycerides", "84", "mg/dL", "40", "150", ""],
        ["HDL Cholesterol", "62", "mg/dL", "50", "90", ""],
        ["LDL Cholesterol (Calculated)", "89", "mg/dL", "50", "130", ""],
      ],
      "Complete Blood Count": [
        ["White Blood Cell Count", "5.9", "10*3/uL", "3.8", "10.8", ""],
        ["Red Blood Cell Count", "4.11", "10*6/uL", "3.80", "5.10", ""],
        ["Hemoglobin", "11.6", "g/dL", "11.9", "15.5", "L"],
        ["Hematocrit", "35.4", "%", "35.0", "45.0", ""],
        ["Ferritin", "14", "ng/mL", "16", "232", "L"],
        ["Platelet Count", "268", "10*3/uL", "140", "400", ""],
      ],
      "Additional Chemistry": [
        ["Glucose", "88", "mg/dL", "74", "99", ""],
        ["Hemoglobin A1c", "5.1", "%", "4.0", "5.6", ""],
        ["TSH", "1.84", "uIU/mL", "0.40", "4.50", ""],
        ["Vitamin D, 25-Hydroxy", "34", "ng/mL", "30", "100", ""],
      ],
    },
  },
];

function html(report) {
  const sections = Object.entries(report.sections)
    .map(
      ([title, rows]) => `
      <h2>${title}</h2>
      <table>
        <thead><tr><th>Test</th><th>Result</th><th>Units</th><th>Reference Range</th><th>Flag</th></tr></thead>
        <tbody>
          ${rows
            .map(
              ([name, result, units, lo, hi, flag]) => `
            <tr class="${flag ? "flagged" : ""}">
              <td>${name}</td><td class="num">${result}</td><td>${units}</td>
              <td class="num">${lo} - ${hi}</td><td class="flag">${flag}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 11px; color: #111; margin: 36px; }
    .lab { display: flex; justify-content: space-between; border-bottom: 2px solid #1a3a5c; padding-bottom: 8px; }
    .lab h1 { font-size: 17px; margin: 0; color: #1a3a5c; }
    .lab .sub { color: #555; font-size: 9px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 24px; margin: 12px 0 4px; }
    .meta div { font-size: 10.5px; }
    .meta b { display: inline-block; min-width: 86px; color: #444; font-weight: 600; }
    h2 { font-size: 12px; background: #eef2f6; padding: 4px 6px; margin: 14px 0 0; border-left: 3px solid #1a3a5c; }
    table { width: 100%; border-collapse: collapse; margin-top: 2px; }
    th { text-align: left; font-size: 9.5px; color: #666; border-bottom: 1px solid #bbb; padding: 3px 6px; }
    td { padding: 3px 6px; border-bottom: 1px solid #eee; }
    td.num { font-variant-numeric: tabular-nums; }
    tr.flagged td { font-weight: 700; }
    td.flag { color: #b02a00; font-weight: 700; }
    .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 6px; color: #777; font-size: 8.5px; }
  </style></head><body>
    <div class="lab">
      <div><h1>Meridian Clinical Laboratories</h1>
        <div class="sub">1200 Harbor Point Drive, Suite 400 &middot; CLIA 99D0000000 &middot; Laboratory Director: A. Whitfield, MD</div></div>
      <div class="sub">Accession: ${report.accession}<br>Report status: FINAL</div>
    </div>
    <div class="meta">
      <div><b>Patient:</b> ${report.patient}</div>
      <div><b>Date of birth:</b> ${report.dob}</div>
      <div><b>Sex:</b> ${report.sex}</div>
      <div><b>Collected:</b> ${report.collected}</div>
      <div><b>Reported:</b> ${report.reported}</div>
      <div><b>Ordering provider:</b> R. Okonkwo, MD</div>
    </div>
    ${sections}
    <div class="footer">SYNTHETIC SAMPLE DATA &mdash; generated for the Terra Panel example app. Not a real patient, provider, or laboratory. Flags: H = above reference range, L = below reference range.</div>
  </body></html>`;
}

for (const report of REPORTS) {
  const tmp = resolve(outDir, report.file.replace(/\.pdf$/, ".html"));
  writeFileSync(tmp, html(report));
  execFileSync(CHROME, [
    "--headless",
    "--disable-gpu",
    `--print-to-pdf=${resolve(outDir, report.file)}`,
    "--no-pdf-header-footer",
    tmp,
  ]);
  rmSync(tmp);
  console.log("wrote", report.file);
}
