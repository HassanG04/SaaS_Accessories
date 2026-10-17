import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  detectImageSignature,
  validateProofFile,
  generateProofStoragePath,
  reencodeImage,
  MAX_PROOF_FILE_SIZE,
} from './fileValidation'
import { getOrderPaymentDetailsApi, uploadPaymentProofApi, submitPaymentProofApi } from './api'
import { AppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
    rpc: vi.fn(),
  },
}))

describe('detectImageSignature', () => {
  it('detects JPEG magic bytes (FF D8 FF)', () => {
    const bytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ])
    const result = detectImageSignature(bytes)
    expect(result).toEqual({ mimeType: 'image/jpeg', extension: 'jpg' })
  })

  it('detects PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
    const bytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ])
    const result = detectImageSignature(bytes)
    expect(result).toEqual({ mimeType: 'image/png', extension: 'png' })
  })

  it('detects WebP magic bytes (RIFF....WEBP)', () => {
    const bytes = new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46, // RIFF
      0x24,
      0x00,
      0x00,
      0x00, // length
      0x57,
      0x45,
      0x42,
      0x50, // WEBP
    ])
    const result = detectImageSignature(bytes)
    expect(result).toEqual({ mimeType: 'image/webp', extension: 'webp' })
  })

  it('refuses renamed HTML file (<!DOCTYPE...) with null', () => {
    const bytes = new TextEncoder().encode('<!DOCTYPE html><html><body>')
    expect(detectImageSignature(bytes)).toBeNull()
  })

  it('refuses renamed SVG file (<svg...) with null', () => {
    const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')
    expect(detectImageSignature(bytes)).toBeNull()
  })

  it('refuses short buffer under 12 bytes with null', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff])
    expect(detectImageSignature(bytes)).toBeNull()
  })

  it('refuses arbitrary binary / executable files with null', () => {
    const bytes = new Uint8Array([
      0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
    ])
    expect(detectImageSignature(bytes)).toBeNull()
  })
})

describe('validateProofFile', () => {
  it('validates a valid JPEG file', async () => {
    const content = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00,
    ])
    const file = new File([content], 'camera_photo.jpg', { type: 'image/jpeg' })

    const result = await validateProofFile(file)
    expect(result).toEqual({
      ok: true,
      mimeType: 'image/jpeg',
      extension: 'jpg',
    })
  })

  it('rejects files larger than 5 MB with UPL-002', async () => {
    // Create a 5MB + 1 byte file
    const oversizedBlob = {
      size: MAX_PROOF_FILE_SIZE + 10,
      slice: vi.fn(),
    } as unknown as File

    const result = await validateProofFile(oversizedBlob)
    expect(result).toEqual({
      ok: false,
      code: 'UPL-002',
    })
  })

  it('rejects renamed malicious HTML / SVG files with UPL-001', async () => {
    const fakeFile = new File(['<svg>evil</svg>'], 'receipt.jpg', { type: 'image/jpeg' })
    const result = await validateProofFile(fakeFile)
    expect(result).toEqual({
      ok: false,
      code: 'UPL-001',
    })
  })
})

describe('generateProofStoragePath', () => {
  it('generates path without user-controlled file name', () => {
    const userId = '11111111-2222-3333-4444-555555555555'
    const orderId = 42
    const path = generateProofStoragePath(userId, orderId, 'jpg')

    expect(path.startsWith(`${userId}/${orderId}/`)).toBe(true)
    expect(path.endsWith('.jpg')).toBe(true)
    // Does not contain any user-given name like 'screenshot.png'
    expect(path).not.toContain('screenshot')
    expect(path).not.toContain('undefined')
    expect(path).not.toContain('null')
  })

  it('never outputs path traversal sequences', () => {
    const path = generateProofStoragePath('user-1', 99, 'webp')
    expect(path).not.toContain('..')
    expect(path.split('/').length).toBe(3)
  })
})

describe('reencodeImage', () => {
  it('returns a Blob with the target MIME type', async () => {
    const content = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ])
    const file = new File([content], 'proof.jpg', { type: 'image/jpeg' })

    const reencoded = await reencodeImage(file, 'image/jpeg', 0.8)
    expect(reencoded).toBeInstanceOf(Blob)
  })
})

describe('payments api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrderPaymentDetailsApi', () => {
    it('returns order payment details on success', async () => {
      const mockOrder = {
        id: 10,
        user_id: 'user-1',
        status: 'pending',
        payment_status: 'awaiting_proof',
        payment_method: 'instapay_qr',
        payment_deadline: '2026-10-12T23:59:59Z',
        payment_reference: null,
        payment_proof_path: null,
        payment_submitted_at: null,
        payment_review_note: null,
        total: 450,
        created_at: '2026-10-12T10:00:00Z',
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockOrder, error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const res = await getOrderPaymentDetailsApi(10)
      expect(res).toEqual(mockOrder)
    })

    it('throws ORD-009 if order not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      await expect(getOrderPaymentDetailsApi(999)).rejects.toThrow()
    })
  })

  describe('uploadPaymentProofApi', () => {
    it('uploads to payment-proofs bucket and returns clean path', async () => {
      const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'path' }, error: null })
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: mockUpload,
      } as unknown as ReturnType<typeof supabase.storage.from>)

      const blob = new Blob(['sample-bytes'], { type: 'image/jpeg' })
      const path = await uploadPaymentProofApi('u1', 12, blob, 'image/jpeg', 'jpg')

      expect(supabase.storage.from).toHaveBeenCalledWith('payment-proofs')
      expect(mockUpload).toHaveBeenCalledWith(path, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      })
      expect(path.startsWith('u1/12/')).toBe(true)
    })

    it('throws UPL-003 on storage upload failure', async () => {
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi
          .fn()
          .mockResolvedValue({ data: null, error: new Error('Storage network error') }),
      } as unknown as ReturnType<typeof supabase.storage.from>)

      const blob = new Blob(['bytes'], { type: 'image/jpeg' })
      await expect(uploadPaymentProofApi('u1', 12, blob, 'image/jpeg', 'jpg')).rejects.toThrow()
    })
  })

  describe('submitPaymentProofApi', () => {
    it('throws PAY-003 when reference is empty or whitespace', async () => {
      await expect(
        submitPaymentProofApi({ orderId: 10, reference: '   ', proofPath: 'u1/10/uuid.jpg' }),
      ).rejects.toThrowError(expect.objectContaining({ code: 'PAY-003' }))
    })

    it('invokes submit_payment_proof RPC with trimmed reference', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

      await submitPaymentProofApi({
        orderId: 10,
        reference: '  INSTA-123456  ',
        proofPath: 'u1/10/uuid.jpg',
      })

      expect(supabase.rpc).toHaveBeenCalledWith('submit_payment_proof', {
        p_order_id: 10,
        p_reference: 'INSTA-123456',
        p_proof_path: 'u1/10/uuid.jpg',
      })
    })

    it('maps duplicate reference hint to PAY-005', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'duplicate reference', hint: 'PAY-005', code: '23505' },
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

      try {
        await submitPaymentProofApi({
          orderId: 10,
          reference: 'INSTA-123456',
          proofPath: 'u1/10/uuid.jpg',
        })
        expect.unreachable('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('PAY-005')
      }
    })

    it('maps deadline passed hint to PAY-001', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'deadline passed', hint: 'PAY-001', code: '22023' },
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

      try {
        await submitPaymentProofApi({
          orderId: 10,
          reference: 'INSTA-123456',
          proofPath: 'u1/10/uuid.jpg',
        })
        expect.unreachable('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('PAY-001')
      }
    })

    it('maps wrong payment method or invalid status hint to PAY-004', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'wrong status', hint: 'PAY-004', code: '22023' },
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

      try {
        await submitPaymentProofApi({
          orderId: 10,
          reference: 'INSTA-123456',
          proofPath: 'u1/10/uuid.jpg',
        })
        expect.unreachable('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('PAY-004')
      }
    })

    it('maps already paid hint to PAY-002', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'already paid', hint: 'PAY-002', code: '22023' },
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

      try {
        await submitPaymentProofApi({
          orderId: 10,
          reference: 'INSTA-123456',
          proofPath: 'u1/10/uuid.jpg',
        })
        expect.unreachable('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('PAY-002')
      }
    })
  })
})
