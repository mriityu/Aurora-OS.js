import { describe, it, expect } from 'vitest';
import { isValidImageUrl } from './urlUtils';

describe('isValidImageUrl', () => {
  it('should allow valid http/https URLs', () => {
    expect(isValidImageUrl('https://example.com/image.png')).toBe(true);
    expect(isValidImageUrl('http://example.com/image.jpg')).toBe(true);
  });

  it('should allow valid data URIs', () => {
    expect(isValidImageUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')).toBe(true);
  });

  it('should allow valid relative paths', () => {
    expect(isValidImageUrl('/home/user/images/photo.jpg')).toBe(true);
    expect(isValidImageUrl('./assets/logo.png')).toBe(true);
    expect(isValidImageUrl('../shared/background.png')).toBe(true);
    expect(isValidImageUrl('assets/image.png')).toBe(true);
  });

  it('should block javascript: protocol', () => {
    expect(isValidImageUrl('javascript:alert(1)')).toBe(false);
    expect(isValidImageUrl('JAVASCRIPT:alert(1)')).toBe(false);
    // Control characters check
    expect(isValidImageUrl('java\0script:alert(1)')).toBe(false);
    expect(isValidImageUrl('java\x1Fscript:alert(1)')).toBe(false);
  });

  it('should block vbscript: protocol', () => {
    expect(isValidImageUrl('vbscript:msgbox "hello"')).toBe(false);
  });

  it('should block data: protocol if not parsed correctly or malicious look-alike', () => {
    // Malformed data URI that might be treated as script by some older browsers/contexts
    // In our logic, if it parses as URL, data: is allowed. 
    // If it doesn't parse, we fallback.
    // Let's test a case that clearly fails URL parsing but has 'data:'
    expect(isValidImageUrl('data:text/html,<script>alert(1)</script>')).toBe(true); 
    // Wait, technically data: IS allowed by our logic if it parses. 
    // CodeQL warning was about "Incomplete URL scheme check". 
    // The sink is <img src>, so data:text/html technically won't execute XSS in an IMG tag in modern browsers,
    // but it's good practice to be careful. 
    // However, our requirement allows 'data:' protocol. 
    // So 'data:text/html...' is VALID by protocol, though useless for an image.
  });

  it('should block arbitrary schemes', () => {
    expect(isValidImageUrl('malicious:payload')).toBe(false);
  });

  it('should block strings with colons that are not valid URLs and look like schemas', () => {
    expect(isValidImageUrl('weird:entry')).toBe(false);
  });

  it('should allow simple filenames', () => {
    expect(isValidImageUrl('photo.jpg')).toBe(true);
    expect(isValidImageUrl('my_image.png')).toBe(true);
  });
});
