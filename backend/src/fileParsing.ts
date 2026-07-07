import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

const MAX_TEXT_CHARS = 60_000; // extraction chunker handles the rest

export interface ParsedDocument {
    text: string;
    format: string;
    truncated: boolean;
}

const clean = (raw: string): string =>
    raw
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

export const parseDocument = async (buffer: Buffer, filename: string): Promise<ParsedDocument> => {
    const ext = (filename.toLowerCase().split('.').pop() || '').trim();
    let text: string;
    switch (ext) {
        case 'pdf': {
            const parser = new PDFParse({ data: new Uint8Array(buffer) });
            try {
                const result = await parser.getText();
                text = result.text;
            } finally {
                await parser.destroy();
            }
            break;
        }
        case 'docx': {
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
            break;
        }
        case 'txt':
        case 'md':
        case 'markdown':
            text = buffer.toString('utf-8');
            break;
        default: {
            const err: any = new Error(`Unsupported file type ".${ext}" — supported: pdf, docx, txt, md`);
            err.status = 422;
            throw err;
        }
    }
    text = clean(text);
    if (text.length < 100) {
        const err: any = new Error('Could not extract meaningful text from this file (scanned/image-only PDFs are not supported yet)');
        err.status = 422;
        throw err;
    }
    const truncated = text.length > MAX_TEXT_CHARS;
    return { text: truncated ? text.slice(0, MAX_TEXT_CHARS) : text, format: ext, truncated };
};
