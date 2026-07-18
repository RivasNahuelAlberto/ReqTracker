export async function extractDocumentText(file, importer = (specifier) => import(specifier)) {
  const fileName = file?.name || '';
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (!['txt', 'pdf', 'docx'].includes(extension)) {
    throw new Error('Solo se soportan archivos .txt, .pdf y .docx.');
  }

  if (extension === 'txt') {
    return file.text();
  }

  const arrayBuffer = await file.arrayBuffer();

  if (extension === 'pdf') {
    const pdfModule = await importer('pdfjs-dist/build/pdf');
    const pdfjsLib = pdfModule.default ?? pdfModule;
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.entry', import.meta.url).toString();

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let extractedText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => (item.str || '')).join(' ');
      extractedText += `${pageText}\n\n`;
    }

    return extractedText.trim();
  }

  if (extension === 'docx') {
    const mammothModule = await importer('mammoth');
    const mammoth = mammothModule.default ?? mammothModule;
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  }

  return '';
}
