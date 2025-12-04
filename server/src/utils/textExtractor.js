import fs from 'fs';
import * as mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import PPTX2Json from 'pptx2json';

console.log('[textExtractor] v2 loader active');

/**
 * Extracts text content from various file types
 * @param {string|Buffer} input - Path to the file or file buffer
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} Extracted text content
 */
async function extractTextFromFile(input, mimeType) {
  try {
    switch (mimeType) {
      case 'application/pdf':
        return await extractFromPDF(input);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractFromDOCX(input);
      case 'text/plain':
        return await extractFromTXT(input);
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        return await extractFromPPTX(input);
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
      case 'image/webp':
        return await extractFromImage(input);
      default:
        throw new Error(`Unsupported MIME type: ${mimeType}`);
    }
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

/**
 * Extract text from PDF files
 * Supports pdf-parse v1 (default function) and v2 (PDFParse class)
 */
async function extractFromPDF(input) {
  try {
    const dataBuffer = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
    const mod = await import('pdf-parse');

    let text = '';

    if (typeof mod?.PDFParse === 'function') {
      console.log('[textExtractor] using PDFParse class (v2)');
      const parser = new mod.PDFParse({ data: dataBuffer });
      const result = await parser.getText();
      await parser.destroy();
      text = result?.text || '';
    } else if (typeof mod?.default === 'function') {
      console.log('[textExtractor] using default function (v1)');
      const result = await mod.default(dataBuffer);
      text = (result && typeof result === 'object' && 'text' in result) ? result.text : (typeof result === 'string' ? result : '');
    } else if (typeof mod === 'function') {
      console.log('[textExtractor] using module as function (interop)');
      const result = await mod(dataBuffer);
      text = (result && typeof result === 'object' && 'text' in result) ? result.text : (typeof result === 'string' ? result : '');
    } else {
      console.error('[textExtractor] unsupported pdf-parse export shape:', Object.keys(mod || {}));
      throw new Error('Unsupported pdf-parse export shape');
    }

    return text;
  } catch (error) {
    console.error('[textExtractor] PDF extraction error:', error);
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from DOCX files
 */
async function extractFromDOCX(input) {
  try {
    let result;
    if (Buffer.isBuffer(input)) {
      result = await mammoth.extractRawText({ arrayBuffer: input });
    } else {
      result = await mammoth.extractRawText({ path: input });
    }
    return result.value;
  } catch (error) {
    throw new Error(`DOCX extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from TXT files
 */
async function extractFromTXT(input) {
  try {
    if (Buffer.isBuffer(input)) {
      return input.toString('utf8');
    } else {
      return fs.readFileSync(input, 'utf8');
    }
  } catch (error) {
    throw new Error(`TXT extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from PPTX files
 * Handles both constructor and function export styles
 */
async function extractFromPPTX(input) {
  try {
    let pptx;
    if (Buffer.isBuffer(input)) {
      // For buffers, we might need to create a temporary approach
      // For now, return a placeholder since PPTX processing with buffers is complex
      console.warn('PPTX buffer processing not fully implemented, returning placeholder');
      return '[PPTX file uploaded - processing not available in serverless environment]';
    } else {
      try {
        // Some versions expose a class
        pptx = new PPTX2Json(input);
      } catch (_e) {
        // Fallback: some builds expose a function default export
        const mod = await import('pptx2json');
        const fn = mod?.default ?? mod;
        pptx = await fn(input);
      }
    }

    let text = '';
    if (pptx?.slides) {
      pptx.slides.forEach(slide => {
        if (slide?.text) {
          text += slide.text + '\n';
        }
      });
    }
    return text.trim();
  } catch (error) {
    throw new Error(`PPTX extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from image files using OCR
 */
async function extractFromImage(input) {
  let worker;
  try {
    worker = await createWorker('eng');
    let result;
    if (Buffer.isBuffer(input)) {
      result = await worker.recognize(input);
    } else {
      result = await worker.recognize(input);
    }
    return result.data.text.trim();
  } catch (error) {
    throw new Error(`Image OCR extraction failed: ${error.message}`);
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

export {
  extractTextFromFile,
  extractFromImage,
  extractFromPPTX
};