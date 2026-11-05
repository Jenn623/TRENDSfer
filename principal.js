const CLAVE_SESION = 'usuarioSesion';

function cargarSesion() {
	let usuario;

	try {
		usuario = JSON.parse(localStorage.getItem(CLAVE_SESION));
	} catch (error) {
		localStorage.removeItem(CLAVE_SESION);
	}

	if (!usuario || typeof usuario !== 'object') {
		window.location.replace('index.html');
		return;
	}

	const nombrePerfil = usuario.apodo || usuario.nombre || usuario.email || 'Usuario';
	const inicial = nombrePerfil.trim().charAt(0).toUpperCase() || 'U';

	document.querySelectorAll('[data-usuario-nombre]').forEach((elemento) => {
		elemento.textContent = nombrePerfil;
	});

	document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
		elemento.textContent = inicial;
	});
}

cargarSesion();
