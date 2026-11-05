import { supabase } from './supabase.js';

export async function obtenerPerfilActual() {
	const { data: authData, error: authError } = await supabase.auth.getUser();
	if (authError) throw authError;
	if (!authData.user) return null;

	const { data: perfil, error: perfilError } = await supabase
		.from('Usuarios')
		.select('id_usuarios, nombre, apellido, apodo, email')
		.eq('email', authData.user.email)
		.maybeSingle();

	if (perfilError) throw perfilError;
	return perfil ? { authUser: authData.user, perfil } : null;
}