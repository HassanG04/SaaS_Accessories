import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { readStorefrontContent } from '@/features/settings/content'
import { getContentSnapshot, saveContentSnapshot, uploadHeroImage } from './content.api'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } },
}))
const snapshot = {
  content: { hero_title_ar: 'عنوان', hero_title_en: 'Title' },
  revision: '2026-10-18T00:00:00Z',
}
describe('persistent storefront content', () => {
  beforeEach(() => vi.clearAllMocks())
  it('drops unknown fields and malformed public values rather than rendering objects', () => {
    expect(
      readStorefrontContent({
        hero_title_en: {},
        instapay_handle: 'private',
        featured_product_id: -1,
        category_ids: [1, null, '2'],
        footer_order: ['terms', 'javascript:alert(1)'],
      }),
    ).toEqual({ category_ids: [1], footer_order: ['terms'] })
  })
  it('reads persisted content and its revision together', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { value: snapshot.content, updated_at: snapshot.revision },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ single })
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq }),
    } as unknown as ReturnType<typeof supabase.from>)
    expect(await getContentSnapshot()).toEqual(snapshot)
    expect(eq).toHaveBeenCalledWith('key', 'storefront_content')
  })
  it('sends the revision and coherent translations in one RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: '2026-10-18T01:00:00Z',
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)
    expect(await saveContentSnapshot(snapshot)).toBe('2026-10-18T01:00:00Z')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_update_storefront_content', {
      p_content: snapshot.content,
      p_expected_updated_at: snapshot.revision,
    })
  })
  it('preserves the stale-save conflict as a distinct result', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as unknown as Awaited<
      ReturnType<typeof supabase.rpc>
    >)
    expect(await saveContentSnapshot(snapshot)).toBeNull()
  })
  it('maps denied writes to the catalogue error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { hint: 'ADM-002', code: '42501' },
    } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)
    await expect(saveContentSnapshot(snapshot)).rejects.toMatchObject({ code: 'ADM-002' })
  })
  it('rejects a renamed HTML image before contacting storage', async () => {
    await expect(
      uploadHeroImage(new File(['<html>attack</html>'], 'hero.png', { type: 'image/png' })),
    ).rejects.toMatchObject({ code: 'UPL-001' })
    expect(supabase.storage.from).not.toHaveBeenCalled()
  })
})
