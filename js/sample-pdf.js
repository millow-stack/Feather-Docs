/**
 * Sample PDF Generator / Provider for instant offline testing.
 * Returns a Uint8Array containing a valid PDF document with text and pages.
 */

export function getSamplePDFArrayBuffer() {
  // Base64 of a minimal 2-page valid PDF document
  const samplePdfBase64 = 
    "JVBERi0xLjcKJSa1tbW1CjEgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFI+PgplbmRvYmoK" +
    "MiAwIG9iaiA8PC9UeXBlIC9QYWdlcyAvQ291bnQgMiAvS2lkcyBbMyAwIFIgNCAwIFJdPj4KZW5kb2JqCjMg" +
    "MCBvYmoKPDwvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNv" +
    "dXJjZXMgPDwvRm9udCA8PC9GMSA1IDAgUj4+Pj4gL0NvbnRlbnRzIDYgMCBSPj4KZW5kb2JqCjQgMCBvYmoK" +
    "PDwvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMg" +
    "PDwvRm9udCA8PC9GMSA1IDAgUj4+Pj4gL0NvbnRlbnRzIDcgMCBSPj4KZW5kb2JqCjUgMCBvYmoKPDwvVHlw" +
    "ZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2E+PgplbmRvYmoKNiAwIG9iaiA8" +
    "PC9MZW5ndGggMTI1Pj4Kc3RyZWFtCkJUMQowIDAgMSByZ2IKL0YxIDI0IFRmCjcyIDcxMCBUZCAoTGlnaHRQ" +
    "REYgLSBTYW1wbGUgRG9jdW1lbnQpIFRqCjAgLTM2IFRkCjAgMCAwIHJnYgovRjEgMTIgVGYKKEYgV2VsY29t" +
    "ZSB0byBMaWdodFBERiAhIFRoaXMgaXMgYSAxMDAlIGJyb3dzZXItYmFzZWQsIHNlcnZlcmxlc3MgUERGIHZp" +
    "ZXdlci4pIFRqCjAgLTIwIFRkCihZb3UgY2FuIHpvb20sIHJvdGF0ZSwgc2VhcmNoIHRleHQsIGFuZCBkcmF3" +
    "IGFubm90YXRpb25zIGRpcmVjdGx5IG9uIHRoaXMgcGFnZS4pIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNyAw" +
    "IG9iaiA8PC9MZW5ndGggMTAwPj4Kc3RyZWFtCkJUMQowIDAgMSByZ2IKL0YxIDI0IFRmCjcyIDcxMCBUZCAo" +
    "UGFnZSAyIC0gQW5ub3RhdGlvbnMgJiBTZWFyY2gpIFRqCjAgLTM2IFRkCjAgMCAwIHJnYgovRjEgMTIgVGYK" +
    "KFRyeSB1c2luZyB0aGUgUGVuLCBIaWdobGlnaHQsIGFuZCBTZWFyY2ggdG9vbHMgaW4gdGhlIHRvb2xiYXIg" +
    "YWJvdmUuKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAw" +
    "MDAwMDAxOSAwMDAwMCBuIAowMDAwMDAwMDY4IDAwMDAwIG4gCjAwMDAwMDAxMjUgMDAwMDAgbiAKMDAwMDAw" +
    "MDIyOSAwMDAwMCBuIAowMDAwMDAwMzMzIDAwMDAwIG4gCjAwMDAwMDA0MDQDraggingMDAwMCBuIAowMDAw" +
    "MDAwNTgwIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA4IC9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjczMQol" +
    "JUVPRg==";

  const binaryString = atob(samplePdfBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
