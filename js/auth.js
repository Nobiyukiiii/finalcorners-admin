// ============================================================
// auth.js — Authentication module
// ============================================================

import { supabase } from './api.js';
import { showToast } from './toast.js';

/**
 * Returns the current session or null
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Guard: redirect to login if no session
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = './index.html';
    return false;
  }
  return true;
}

/**
 * Guard: redirect to dashboard if already logged in
 */
export async function redirectIfAuthenticated() {
  const session = await getSession();
  if (session) {
    window.location.href = './dashboard.html';
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
