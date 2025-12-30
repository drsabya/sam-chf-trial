import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function POST({ request }) {
  const { visitId, objectKey } = await request.json();

  if (!visitId || !objectKey) {
    return json(
      { ok: false, error: 'visitId and objectKey are required' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('visits')
    .update({ prescription_src: objectKey })
    .eq('id', visitId);

  if (error) {
    console.error('Prescription save failed:', error);
    return json(
      { ok: false, error: 'Failed to save prescription' },
      { status: 500 }
    );
  }

  return json({ ok: true });
}
