import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';

export function iniciarEdicionPerfil(root = document) {
	const formulario = root.querySelector('.form-registro');
	if (!formulario || formulario.dataset.inicializado === 'true') return;
	formulario.dataset.inicializado = 'true';

	const campoNombre = formulario.querySelector('[name="nombre"]');
	const campoApellido = formulario.querySelector('[name="apellidos"]');
	const campoApodo = formulario.querySelector('[name="apodo"]');
	const campoCorreo = formulario.querySelector('[name="correo"]');
	const campoContrasena = formulario.querySelector('[name="contrasena"]');
	const botonGuardar = formulario.querySelector('[type="submit"]');

	async function cargarDatos() {
		try {
			const sesion = await obtenerPerfilActual();
			if (!sesion) {
				window.location.replace('./index.html');
				return null;
			}

			campoNombre.value = sesion.perfil.nombre || '';
			campoApellido.value = sesion.perfil.apellido || '';
			campoApodo.value = sesion.perfil.apodo || '';
			campoCorreo.value = sesion.authUser.email || sesion.perfil.email || '';
			const nombreVisible = sesion.perfil.apodo?.trim()
				|| sesion.perfil.nombre?.trim()
				|| sesion.authUser.email
				|| 'Usuario';
			document.querySelectorAll('[data-usuario-nombre]').forEach((elemento) => {
				elemento.textContent = nombreVisible;
			});
			document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
				elemento.textContent = nombreVisible.charAt(0).toUpperCase() || 'U';
			});
			return sesion;
		} catch (error) {
			console.error('No se pudo cargar el perfil para editarlo:', error);
			alert('No se pudo cargar el perfil: ' + error.message);
			return null;
		}
	}

	let sesionActual;
	const sesionLista = cargarDatos().then((sesion) => {
		sesionActual = sesion;
		return sesion;
	});

	formulario.addEventListener('submit', async (evento) => {
		evento.preventDefault();
		botonGuardar.disabled = true;

		try {
			const sesion = sesionActual || await sesionLista;
			if (!sesion) return;

			const nombre = campoNombre.value.trim();
			const apellido = campoApellido.value.trim();
			const apodo = campoApodo.value.trim();
			const email = campoCorreo.value.trim();
			const contrasena = campoContrasena.value;

			if (!nombre || !apellido || !apodo || !email) {
				alert('Completa nombre, apellido, apodo y correo electrónico.');
				return;
			}

			const cambios = {
				data: { nombre, apellido, apodo }
			};
			const cambioCorreo = email.toLowerCase() !== (sesion.authUser.email || '').toLowerCase();
			if (cambioCorreo) cambios.email = email;
			if (contrasena) cambios.password = contrasena;

			const { error } = await supabase.auth.updateUser(cambios);
			if (error) throw error;

			campoContrasena.value = '';
			sesionActual = await obtenerPerfilActual();
			if (!sesionActual
				|| sesionActual.perfil.nombre !== nombre
				|| sesionActual.perfil.apellido !== apellido
				|| sesionActual.perfil.apodo !== apodo) {
				throw new Error('El perfil de la base de datos no se sincronizó. Ejecuta supabase-tickets-auth.sql en el editor SQL de Supabase y vuelve a intentarlo.');
			}

			const nombreVisible = apodo || nombre;
			document.querySelectorAll('[data-usuario-nombre]').forEach((elemento) => {
				elemento.textContent = nombreVisible;
			});
			document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
				elemento.textContent = nombreVisible.charAt(0).toUpperCase() || 'U';
			});
			alert(cambioCorreo
				? 'Perfil actualizado. Confirma el cambio de correo desde el mensaje que te enviamos.'
				: 'Perfil actualizado correctamente.');
		} catch (error) {
			console.error('No se pudo actualizar el perfil:', error);
			alert('No se pudo actualizar el perfil: ' + error.message);
		} finally {
			botonGuardar.disabled = false;
		}
	});
}
