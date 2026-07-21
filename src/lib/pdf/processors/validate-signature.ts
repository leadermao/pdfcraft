/**
 * Validate Signature Processor
 * Extracts and validates digital signatures from PDFs.
 */
import forge from 'node-forge';
import type { ExtractedSignature, SignatureValidationResult } from '@/types/digital-signature';

/**
 * Extract all signatures from a PDF
 */
export function extractSignatures(pdfBytes: Uint8Array): ExtractedSignature[] {
  const signatures: ExtractedSignature[] = [];
  const pdfString = new TextDecoder('latin1').decode(pdfBytes);

  const sigRegex = /\/Type\s*\/Sig\b/g;
  let sigMatch;
  let sigIndex = 0;

  while ((sigMatch = sigRegex.exec(pdfString)) !== null) {
    try {
      const searchStart = Math.max(0, sigMatch.index - 5000);
      const searchEnd = Math.min(pdfString.length, sigMatch.index + 10000);
      const context = pdfString.substring(searchStart, searchEnd);

      const byteRangeMatch = context.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
      if (!byteRangeMatch) continue;

      const byteRange = [
        parseInt(byteRangeMatch[1], 10),
        parseInt(byteRangeMatch[2], 10),
        parseInt(byteRangeMatch[3], 10),
        parseInt(byteRangeMatch[4], 10),
      ];

      const contentsMatch = context.match(/\/Contents\s*<([0-9A-Fa-f]+)>/);
      if (!contentsMatch) continue;

      const contentsBytes = hexToBytes(contentsMatch[1]);
      const reasonMatch = context.match(/\/Reason\s*\(([^)]*)\)/);
      const locationMatch = context.match(/\/Location\s*\(([^)]*)\)/);
      const contactMatch = context.match(/\/ContactInfo\s*\(([^)]*)\)/);
      const nameMatch = context.match(/\/Name\s*\(([^)]*)\)/);
      const timeMatch = context.match(/\/M\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);

      let signingTime: string | undefined;
      if (timeMatch) {
        signingTime = `${timeMatch[1]}-${timeMatch[2]}-${timeMatch[3]}T${timeMatch[4]}:${timeMatch[5]}:${timeMatch[6]}`;
      }

      signatures.push({
        index: sigIndex++,
        contents: contentsBytes,
        byteRange,
        reason: reasonMatch ? reasonMatch[1] : undefined,
        location: locationMatch ? locationMatch[1] : undefined,
        contactInfo: contactMatch ? contactMatch[1] : undefined,
        name: nameMatch ? nameMatch[1] : undefined,
        signingTime,
      });
    } catch {
      // Skip malformed signatures
    }
  }

  return signatures;
}

/**
 * Validate a single signature
 */
export function validateSignature(
  signature: ExtractedSignature,
  pdfBytes: Uint8Array,
  trustedCert?: forge.pki.Certificate
): SignatureValidationResult {
  const result: SignatureValidationResult = {
    signatureIndex: signature.index,
    isValid: false,
    signerName: 'Unknown',
    issuer: 'Unknown',
    validFrom: new Date(0),
    validTo: new Date(0),
    isExpired: false,
    isSelfSigned: false,
    isTrusted: false,
    algorithms: { digest: 'Unknown', signature: 'Unknown' },
    serialNumber: '',
    byteRange: signature.byteRange,
    coverageStatus: 'unknown',
    reason: signature.reason,
    location: signature.location,
    contactInfo: signature.contactInfo,
  };

  try {
    const binaryString = uint8ArrayToBinaryString(signature.contents);
    const asn1 = forge.asn1.fromDer(binaryString);
    const p7 = forge.pkcs7.messageFromAsn1(asn1) as any;

    if (!p7.certificates || p7.certificates.length === 0) {
      result.errorMessage = 'No certificates found in signature';
      return result;
    }

    const signerCert = p7.certificates[0] as forge.pki.Certificate;

    const subjectCN = signerCert.subject.getField('CN');
    const subjectO = signerCert.subject.getField('O');
    const subjectE = signerCert.subject.getField('E') || signerCert.subject.getField('emailAddress');
    const issuerCN = signerCert.issuer.getField('CN');
    const issuerO = signerCert.issuer.getField('O');

    result.signerName = (subjectCN?.value as string) ?? 'Unknown';
    result.signerOrg = subjectO?.value as string | undefined;
    result.signerEmail = subjectE?.value as string | undefined;
    result.issuer = (issuerCN?.value as string) ?? 'Unknown';
    result.issuerOrg = issuerO?.value as string | undefined;
    result.validFrom = signerCert.validity.notBefore;
    result.validTo = signerCert.validity.notAfter;
    result.serialNumber = signerCert.serialNumber;

    const now = new Date();
    result.isExpired = now > result.validTo || now < result.validFrom;
    result.isSelfSigned = signerCert.isIssuer(signerCert);

    if (trustedCert) {
      try {
        const isTrustedIssuer = trustedCert.isIssuer(signerCert);
        const isSameCert = signerCert.serialNumber === trustedCert.serialNumber;
        let chainTrusted = false;
        for (const cert of p7.certificates) {
          if (trustedCert.isIssuer(cert) || (cert as forge.pki.Certificate).serialNumber === trustedCert.serialNumber) {
            chainTrusted = true;
            break;
          }
        }
        result.isTrusted = isTrustedIssuer || isSameCert || chainTrusted;
      } catch {
        result.isTrusted = false;
      }
    }

    result.algorithms = {
      digest: getDigestAlgorithmName(signerCert.siginfo?.algorithmOid || ''),
      signature: getSignatureAlgorithmName(signerCert.signatureOid || ''),
    };

    if (signature.signingTime) {
      result.signatureDate = new Date(signature.signingTime);
    }

    if (signature.byteRange && signature.byteRange.length === 4) {
      const [offset1, len1, start2, len2] = signature.byteRange;
      const totalEnd = start2 + len2;
      if (totalEnd === pdfBytes.length) {
        result.coverageStatus = 'full';
      } else if (totalEnd < pdfBytes.length) {
        result.coverageStatus = 'partial';
      }

      try {
        const data1 = pdfBytes.subarray(offset1, offset1 + len1);
        const data2 = pdfBytes.subarray(start2, start2 + len2);
        const md = forge.md.sha256.create();
        md.update(uint8ArrayToBinaryString(data1));
        md.update(uint8ArrayToBinaryString(data2));
        const computedDigest = md.digest().getBytes();

        const root = asn1 as any;
        const contentValue = root.value?.[1]?.value?.[0];
        if (contentValue) {
          const lastSet = contentValue.value?.[contentValue.value.length - 1];
          const firstSigner = lastSet?.value?.[0];
          if (firstSigner) {
            for (const attr of firstSigner.value) {
              if (attr.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && attr.type === 0 && attr.constructed) {
                for (const authAttr of (attr as any).value) {
                  if (authAttr.value?.[0]?.value) {
                    const oid = forge.asn1.derToOid(authAttr.value[0].value);
                    if (oid === '1.2.840.113549.1.9.4') {
                      const digestOctet = authAttr.value?.[1]?.value?.[0]?.value;
                      if (digestOctet && digestOctet === computedDigest) {
                        result.isValid = true;
                      } else {
                        result.isValid = false;
                        result.errorMessage = 'Document content has been modified after signing';
                      }
                    }
                  }
                }
                break;
              }
            }
          }
        }

        if (!result.isValid && !result.errorMessage) {
          result.errorMessage = 'Could not extract message digest for verification';
        }
      } catch {
        result.errorMessage = 'Signature integrity verification failed';
      }
    } else {
      result.errorMessage = 'Missing ByteRange for signature verification';
    }
  } catch (e) {
    result.errorMessage = e instanceof Error ? e.message : 'Failed to parse signature';
  }

  return result;
}

/**
 * Validate all signatures in a PDF
 */
export async function validatePdfSignatures(
  pdfBytes: Uint8Array,
  trustedCert?: forge.pki.Certificate
): Promise<SignatureValidationResult[]> {
  const signatures = extractSignatures(pdfBytes);
  return signatures.map(sig => validateSignature(sig, pdfBytes, trustedCert));
}

/**
 * Convert Uint8Array to binary string without stack overflow
 */
function uint8ArrayToBinaryString(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192;
  let result = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return result;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  let actualLength = bytes.length;
  while (actualLength > 0 && bytes[actualLength - 1] === 0) {
    actualLength--;
  }
  return bytes.slice(0, actualLength);
}

const DIGEST_ALGORITHMS: Record<string, string> = {
  '1.2.840.113549.2.5': 'MD5',
  '1.3.14.3.2.26': 'SHA-1',
  '2.16.840.1.101.3.4.2.1': 'SHA-256',
  '2.16.840.1.101.3.4.2.2': 'SHA-384',
  '2.16.840.1.101.3.4.2.3': 'SHA-512',
};

const SIGNATURE_ALGORITHMS: Record<string, string> = {
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.113549.1.1.5': 'RSA with SHA-1',
  '1.2.840.113549.1.1.11': 'RSA with SHA-256',
  '1.2.840.113549.1.1.12': 'RSA with SHA-384',
  '1.2.840.113549.1.1.13': 'RSA with SHA-512',
  '1.2.840.10045.2.1': 'ECDSA',
  '1.2.840.10045.4.3.2': 'ECDSA with SHA-256',
  '1.2.840.10045.4.3.3': 'ECDSA with SHA-384',
  '1.2.840.10045.4.3.4': 'ECDSA with SHA-512',
};

function getDigestAlgorithmName(oid: string): string {
  return DIGEST_ALGORITHMS[oid] || oid || 'Unknown';
}

function getSignatureAlgorithmName(oid: string): string {
  return SIGNATURE_ALGORITHMS[oid] || oid || 'Unknown';
}
