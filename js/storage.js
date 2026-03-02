// ============================================================
// storage.js — Supabase Storage operations
// ============================================================

import { supabase } from './api.js';
import { STORAGE_BUCKET } from './config.js';

/**
 * Upload a file to the storage bucket
 * @param {string} folder - e.g. 'songs', 'members'
 * @param {File} file - the file to upload
 * @returns {{ url: string, path: string }}
 */
export async function uploadFile(folder, file) {
  const ext = file.name.split('.').pop();
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
  const path = `${folder}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/**
 * Replace an existing file in storage
 * Deletes the old file if oldPath is provided, then uploads the new one.
 */
export async function replaceFile(folder, file, oldPath) {
  if (oldPath) {
    await deleteFile(oldPath);
  }
  return await uploadFile(folder, file);
}

/**
 * Delete a file from storage by its path
 */
export async function deleteFile(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) throw error;
}

/**
 * Get a public URL for a path
 */
export function getPublicUrl(path) {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
