import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } from "docx";
import { saveAs } from "file-saver";

export async function downloadAsDocx(text: string, filename: string = "原稿") {
  const lines = text.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      paragraphs.push(new Paragraph({ text: "" }));
    } else if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^# /, ""),
          heading: HeadingLevel.HEADING_1,
        })
      );
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^## /, ""),
          heading: HeadingLevel.HEADING_2,
        })
      );
    } else {
      // **bold** の処理
      const parts = line.split(/\*\*(.*?)\*\*/g);
      const runs: TextRun[] = parts.map((part, i) =>
        i % 2 === 1
          ? new TextRun({ text: part, bold: true, font: "游明朝", size: 22 })
          : new TextRun({ text: part, font: "游明朝", size: 22 })
      );
      paragraphs.push(
        new Paragraph({
          children: runs,
          alignment: AlignmentType.LEFT,
          spacing: { after: 200 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1728, right: 1728 },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}

export function downloadAsEpub(text: string, filename: string = "原稿") {
  // epub簡易出力（テキストベース）
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${filename}</title></head>
<body>
${text.split("\n").map((l) => `<p>${l || "&nbsp;"}</p>`).join("\n")}
</body>
</html>`;
  const blob = new Blob([content], { type: "application/xhtml+xml" });
  saveAs(blob, `${filename}.xhtml`);
}
