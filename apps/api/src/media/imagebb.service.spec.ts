import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageBbService } from './imagebb.service.js';
import type { UploadedImageFile } from './imagebb.service.js';

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

const makeFile = (buffer: Buffer = pngBuffer) =>
  ({
    buffer,
    size: buffer.length,
    originalname: 'avatar.png',
    mimetype: 'image/png',
  }) as UploadedImageFile;

describe('ImageBbService', () => {
  let service: ImageBbService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let apiKey: string | undefined;

  beforeEach(() => {
    apiKey = 'test-imagebb-key';
    const config = { get: vi.fn(() => apiKey) };
    service = new ImageBbService(config as never);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads valid image bytes and returns only the hosted URL', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { url: 'https://images.example/p.png', delete_url: 'https://secret-delete.example' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(service.upload(makeFile())).resolves.toEqual({
      url: 'https://images.example/p.png',
    });
    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('api.imgbb.com/1/upload?key=test-imagebb-key');
    expect(request.method).toBe('POST');
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).has('image')).toBe(true);
  });

  it('rejects invalid image bytes even if the supplied MIME type claims image', async () => {
    await expect(service.upload(makeFile(Buffer.from('not an image')))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when ImageBB is not configured', async () => {
    apiKey = undefined;

    await expect(service.upload(makeFile())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to data URL without exposing secret-bearing provider URL or upstream error', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: { message: 'secret upstream details' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await service.upload(makeFile());
    expect(result.url).toContain('data:image/png;base64,');
    expect(result.url).not.toContain(apiKey ?? 'test-imagebb-key');
    expect(result.url).not.toContain('secret upstream details');
  });
});
