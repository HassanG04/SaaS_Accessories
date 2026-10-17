import { supabase } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'
import { readStorefrontContent, type StorefrontContent } from '@/features/settings/content'
import { resizeAndEncodeImage, validateProductImageFile } from '../products/imageUpload'

export interface ContentSnapshot {
  content: StorefrontContent
  revision: string
}

export async function getContentSnapshot(): Promise<ContentSnapshot> {
  const { data, error } = await supabase
    .from('shop_settings')
    .select('value, updated_at')
    .eq('key', 'storefront_content')
    .single()
  if (error) throw toAppError(error)
  return { content: readStorefrontContent(data.value), revision: data.updated_at }
}

/** null means another editor saved first; caller retains its unsaved draft. */
export async function saveContentSnapshot(snapshot: ContentSnapshot): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_update_storefront_content', {
    p_content: snapshot.content,
    p_expected_updated_at: snapshot.revision,
  })
  if (error) throw toAppError(error)
  return data
}

export async function uploadHeroImage(file: File): Promise<string> {
  await validateProductImageFile(file)
  const { blob, extension, contentType } = await resizeAndEncodeImage(file)
  const path = `settings/hero-${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('product-images').upload(path, blob, {
    contentType,
    upsert: false,
  })
  if (error) throw new AppError('UPL-003')
  // Do not delete the old path: another content/product reference may share it.
  return path
}
