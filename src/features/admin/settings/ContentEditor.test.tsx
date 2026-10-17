import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { contentLabels, editorCopy } from '@/i18n/contentEditor'
import { CONTENT_FIELDS } from '@/features/settings/content'
import { supabase } from '@/lib/supabase'
import ContentEditor from './ContentEditor'

vi.mock('@/lib/supabase', () => {
  const supabase = {
    from: vi.fn(),
    rpc: vi.fn(),
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `/test-images/${path}` } }),
      }),
    },
  }
  return { supabase, getSupabase: () => supabase }
})
const revision = '2026-10-18T00:00:00Z'
function mount(lang: 'ar' | 'en' = 'en') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <LanguageProvider initialLanguage={lang}>
        <ContentEditor />
      </LanguageProvider>
    </QueryClientProvider>,
  )
  return client
}
describe('content editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.from).mockImplementation(((table: string) => {
      const result = {
        data:
          table === 'shop_settings'
            ? { value: { hero_title_ar: 'عنوان', hero_title_en: 'Title' }, updated_at: revision }
            : [],
        error: null,
      }
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        single: () => Promise.resolve(result),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      }
      return chain
    }) as unknown as typeof supabase.from)
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: '2026-10-18T01:00:00Z',
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)
  })
  it('has complete bilingual labels without adding them to the entry dictionaries', () => {
    expect(Object.keys(contentLabels).sort()).toEqual([...CONTENT_FIELDS].sort())
    expect(Object.keys(editorCopy.ar).sort()).toEqual(Object.keys(editorCopy.en).sort())
    expect(Object.values(contentLabels).every(([ar, en]) => ar.length > 0 && en.length > 0)).toBe(
      true,
    )
  })
  it('publishes one coherent document and invalidates the public cache', async () => {
    const user = userEvent.setup(),
      client = mount()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const input = await screen.findByLabelText('Hero title (English)')
    await user.clear(input)
    await user.type(input, 'New title')
    await user.click(screen.getByRole('button', { name: 'Publish changes' }))
    await screen.findByText('Content published')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_update_storefront_content', {
      p_expected_updated_at: revision,
      p_content: { hero_title_ar: 'عنوان', hero_title_en: 'New title' },
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['settings', 'public'] })
  })
  it('keeps the unsaved draft when another admin saved first', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as unknown as Awaited<
      ReturnType<typeof supabase.rpc>
    >)
    const user = userEvent.setup()
    mount()
    const input = await screen.findByLabelText('Hero title (English)')
    await user.type(input, ' pending')
    await user.click(screen.getByRole('button', { name: 'Publish changes' }))
    await screen.findByText(editorCopy.en.conflict)
    expect(input).toHaveValue('Title pending')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })
  it('requires both translations and uses Arabic controls in Arabic', async () => {
    const user = userEvent.setup()
    mount('ar')
    const input = await screen.findByLabelText('عنوان الواجهة (English)')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'نشر التغييرات' }))
    expect(await screen.findByText(/ADM-007/)).toBeInTheDocument()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
  it('keeps policy previews escaped as text', async () => {
    const user = userEvent.setup()
    mount()
    await screen.findByLabelText('Hero title (English)')
    await user.click(screen.getByRole('button', { name: 'Policies' }))
    await user.type(screen.getByLabelText('Full terms (English)'), '<script>test</script>')
    await user.click(screen.getByText('Text preview'))
    expect(screen.getByText('<script>test</script>', { selector: 'p' })).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })
})
