const CLAVE_INVITACION = 'invitacionAmigoPendiente';
const DURACION_INVITACION_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function obtenerInvitacionAmigo() {
	const idDeLaUrl = new URLSearchParams(window.location.search).get('invitar');
	if (idDeLaUrl && UUID_VALIDO.test(idDeLaUrl)) {
		localStorage.setItem(CLAVE_INVITACION, JSON.stringify({
			id: idDeLaUrl,
			creada: Date.now()
		}));
		return idDeLaUrl;
	}

	try {
		const guardada = JSON.parse(localStorage.getItem(CLAVE_INVITACION) || 'null');
		if (!guardada || !UUID_VALIDO.test(guardada.id)
			|| Date.now() - guardada.creada > DURACION_INVITACION_MS) {
			localStorage.removeItem(CLAVE_INVITACION);
			return null;
		}
		return guardada.id;
	} catch (error) {
		localStorage.removeItem(CLAVE_INVITACION);
		console.error('No se pudo recuperar la invitación de amistad:', error);
		return null;
	}
}

export function crearUrlConInvitacion(pagina, idPerfil) {
	const url = new URL(pagina, window.location.href);
	if (idPerfil && UUID_VALIDO.test(idPerfil)) {
		url.searchParams.set('invitar', idPerfil);
	}
	return url;
}

export function limpiarInvitacionAmigo() {
	localStorage.removeItem(CLAVE_INVITACION);
}
