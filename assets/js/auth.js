import { supabase } from './supabase-client.js';

// --- Auth State Handlers ---
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/index.html'
    }
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.reload();
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

// --- Domain & Role Validation ---
const ADMIN_EMAILS = ['2024cs0529@svce.ac.in', 'collegewebsitegs@gmail.com', 'nandu.gouri.sreenandanam@gmail.com'];
const ALLOWED_DOMAIN = '@svce.ac.in';

export function validateEmail(email) {
  if (!email) return false;
  return email.endsWith(ALLOWED_DOMAIN) || ADMIN_EMAILS.includes(email);
}

export function isAdmin(email) {
  return ADMIN_EMAILS.includes(email);
}

// --- User Profile Logic ---
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}

export async function checkFacultyAccess(email) {
  // Hardcoded Faculty Whitelist for core staff
  const FACULTY_WHITELIST = [
    'rkkapilavani@svce.ac.in',
    'ranitha@svce.ac.in',
    'revathi@svce.ac.in'
  ];

  if (FACULTY_WHITELIST.includes(email)) return true;

  const { data, error } = await supabase
    .from('allowed_faculty')
    .select('id')
    .eq('email', email)
    .single();

  return !!data;
}

export async function saveUserProfile(profileData) {
  const { error } = await supabase
    .from('users')
    .insert([profileData]);

  if (error) throw error;
  return true;
}

// --- Navigation Logic ---
export function getRedirectUrl(role) {
  if (role === 'admin') return '/admin.html';
  if (role === 'mentor') return '/mentor.html';
  if (role === 'faculty') return '/faculty.html';
  return '/dashboard.html';
}
