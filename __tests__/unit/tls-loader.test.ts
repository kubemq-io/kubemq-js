import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { loadTlsCredentials } from '../../src/internal/transport/tls-loader.js';
import { readFile } from 'node:fs/promises';

const mockReadFile = vi.mocked(readFile);

describe('loadTlsCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for unconfigured certs', async () => {
    const result = await loadTlsCredentials({});

    expect(result.rootCerts).toBeNull();
    expect(result.clientCert).toBeNull();
    expect(result.clientKey).toBeNull();
  });

  it('converts PEM strings to Buffer', async () => {
    const pem = '-----BEGIN CERTIFICATE-----\nMIIBtest\n-----END CERTIFICATE-----';

    const result = await loadTlsCredentials({ caCert: pem });

    expect(result.rootCerts).toBeInstanceOf(Buffer);
    expect(result.rootCerts!.toString('utf-8')).toBe(pem);
    expect(result.clientCert).toBeNull();
    expect(result.clientKey).toBeNull();
  });

  it('passes through Buffer inputs', async () => {
    const buf = Buffer.from('raw-cert-bytes');

    const result = await loadTlsCredentials({ caCert: buf });

    expect(result.rootCerts).toBe(buf);
  });

  it('reads files for path strings', async () => {
    const fileContent = Buffer.from('cert-from-file');
    mockReadFile.mockResolvedValue(fileContent);

    const result = await loadTlsCredentials({ caCert: '/path/to/ca.pem' });

    expect(mockReadFile).toHaveBeenCalledWith('/path/to/ca.pem');
    expect(result.rootCerts).toBe(fileContent);
  });

  it('loads all three certs concurrently', async () => {
    const caCert = '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----';
    const clientCert = '-----BEGIN CERTIFICATE-----\nCLIENT\n-----END CERTIFICATE-----';
    const clientKeyBuf = Buffer.from('client-key-bytes');

    const result = await loadTlsCredentials({
      caCert,
      clientCert,
      clientKey: clientKeyBuf,
    });

    expect(result.rootCerts).toBeInstanceOf(Buffer);
    expect(result.rootCerts!.toString('utf-8')).toBe(caCert);
    expect(result.clientCert).toBeInstanceOf(Buffer);
    expect(result.clientCert!.toString('utf-8')).toBe(clientCert);
    expect(result.clientKey).toBe(clientKeyBuf);
  });

  it('reads file paths for clientCert and clientKey', async () => {
    const certContent = Buffer.from('client-cert-content');
    const keyContent = Buffer.from('client-key-content');
    mockReadFile.mockResolvedValueOnce(certContent).mockResolvedValueOnce(keyContent);

    const result = await loadTlsCredentials({
      clientCert: '/path/to/client.pem',
      clientKey: '/path/to/client-key.pem',
    });

    expect(mockReadFile).toHaveBeenCalledWith('/path/to/client.pem');
    expect(mockReadFile).toHaveBeenCalledWith('/path/to/client-key.pem');
    expect(result.clientCert).toBe(certContent);
    expect(result.clientKey).toBe(keyContent);
  });
});
