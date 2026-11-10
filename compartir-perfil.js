import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';
import { crearUrlConInvitacion } from './invitacion-amigo.js';

export async function iniciarCompartirPerfil(contenedor = document) {
	const seccion = contenedor.querySelector('.CompartirPerfil');
	if (!seccion || seccion.dataset.inicializada === 'true') return;
	seccion.dataset.inicializada = 'true';

	const estado = document.createElement('p');
	const canvas = seccion.querySelector('[data-perfil-qr]');
	const nombreElemento = seccion.querySelector('[data-perfil-nombre]');
	const copiar = seccion.querySelector('.CopiarLink');
	const compartir = seccion.querySelector('[data-perfil-compartir]');
	const opcionesCompartir = seccion.querySelector('[data-perfil-share-options]');
	const compartirWhatsApp = seccion.querySelector('[data-share-whatsapp]');
	const compartirTelegram = seccion.querySelector('[data-share-telegram]');

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
		const inicial = nombre.charAt(0).toUpperCase() || 'U';
		document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
			elemento.textContent = inicial;
		});
		document.querySelectorAll('[data-usuario-nombre]').forEach((elemento) => {
			elemento.textContent = nombre;
		});
		nombreElemento.textContent = `@${sesion.perfil.apodo?.trim() || nombre}`;

		const { data: tokenInvitacion, error: tokenError } = await supabase
			.rpc('crear_invitacion_amigo');
		if (tokenError) throw tokenError;
		if (!tokenInvitacion) throw new Error('No se generó el enlace de invitación.');

		const urlPerfil = crearUrlConInvitacion('./index.html', tokenInvitacion);
		const textoCompartir = `¡Agrégame en TRENDSfer! ${nombreElemento.textContent}`;
		compartirWhatsApp.href = `https://wa.me/?text=${encodeURIComponent(`${textoCompartir} ${urlPerfil.href}`)}`;
		compartirTelegram.href = `https://t.me/share/url?url=${encodeURIComponent(urlPerfil.href)}&text=${encodeURIComponent(textoCompartir)}`;
		const moduloQr = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
		const generadorQr = moduloQr.default || moduloQr;
		await generadorQr.toCanvas(canvas, urlPerfil.href, {
			width: 240,
			margin: 2,
			color: { dark: '#111111', light: '#ffffff' }
		});
		canvas.setAttribute('aria-label', `Código QR para agregar a ${nombre} como amigo`);

		copiar.addEventListener('click', async () => {
			try {
				await navigator.clipboard.writeText(urlPerfil.href);
				copiar.textContent = 'Enlace copiado';
			} catch (error) {
				console.error('No se pudo copiar el enlace del perfil:', error);
				alert('No se pudo copiar el enlace. Comprueba los permisos del navegador.');
			}
		});

		compartir.addEventListener('click', async () => {
			if (typeof navigator.share !== 'function') {
				compartir.hidden = true;
				opcionesCompartir.hidden = false;
				return;
			}

			try {
				await navigator.share({
					title: 'Invitación a TRENDSfer',
					text: textoCompartir,
					url: urlPerfil.href
				});
			} catch (error) {
				if (error.name === 'AbortError') return;

				console.error('No se pudo abrir el menú para compartir:', error);
				compartir.hidden = true;
				opcionesCompartir.hidden = false;
			}
		});
	} catch (error) {
		console.error('No se pudo generar el código QR del perfil:', error);
		estado.textContent = 'No se pudo cargar el código QR. Recarga la página para intentarlo de nuevo.';
		estado.setAttribute('role', 'alert');
		seccion.append(estado);
	}
}

if (document.querySelector('.CompartirPerfil')) {
	iniciarCompartirPerfil();
}
