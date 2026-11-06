import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';
import { cargarNotificaciones } from './notificaciones-data.js';

async function iniciarPagina() {
	try {
		const sesion = await obtenerPerfilActual();
		if (!sesion) {
			window.location.replace('./index.html');
			return;
		}

		const nombre = sesion.perfil.apodo?.trim()
			|| sesion.perfil.nombre?.trim()
			|| sesion.authUser.email
			|| 'Usuario';
		document.querySelector('[data-usuario-nombre]').textContent = nombre;
		document.querySelector('[data-usuario-inicial]').textContent = nombre.charAt(0).toUpperCase() || 'U';

		const contenedor = document.querySelector('[data-notificaciones]');
		await cargarNotificaciones(contenedor, sesion.perfil.id_usuarios);
		const canal = supabase
			.channel(`notificaciones-${sesion.perfil.id_usuarios}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'Tickets' }, () => {
				cargarNotificaciones(contenedor, sesion.perfil.id_usuarios)
					.catch((error) => console.error('Error actualizando notificaciones:', error));
			})
			.subscribe();

		window.addEventListener('beforeunload', () => supabase.removeChannel(canal), { once: true });
	} catch (error) {
		console.error('No se pudieron cargar las notificaciones:', error);
		alert('No se pudieron cargar las notificaciones: ' + error.message);
	}
}

iniciarPagina();
