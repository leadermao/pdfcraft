import type { PDFDocument, PDFFont } from 'pdf-lib';

const CJK_REGEX = /[^\x00-\x7F]/;

export function containsCjk(text: string): boolean {
  return CJK_REGEX.test(text);
}

let cachedFontBytes: ArrayBuffer | null = null;

async function loadFontBytes(): Promise<ArrayBuffer> {
  if (cachedFontBytes) return cachedFontBytes;

  const idb = await openFontCache();
  if (idb) {
    const stored = await idbGet(idb, 'NotoSansSC');
    if (stored) {
      cachedFontBytes = stored;
      return stored;
    }
  }

  const res = await fetch('/fonts/NotoSansSC-Regular.ttf');
  if (!res.ok) throw new Error(`Failed to fetch CJK font: ${res.status}`);
  const bytes = await res.arrayBuffer();
  cachedFontBytes = bytes;

  if (idb) {
    await idbPut(idb, 'NotoSansSC', bytes);
  }

  return bytes;
}

export async function getCjkFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  pdfDoc.registerFontkit(fontkit);
  const bytes = await loadFontBytes();
  return pdfDoc.embedFont(bytes, { subset: true });
}

const DB_NAME = 'pdfcraft-fonts';
const STORE_NAME = 'fonts';

function openFontCache(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbPut(db: IDBDatabase, key: string, value: ArrayBuffer): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
