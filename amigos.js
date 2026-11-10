import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';

const listaAmigos = document.querySelector('.list-friends');
const listaSolicitudes = document.querySelector('.list-solicitud');
const entradaBusqueda = document.getElementById('barra-busqueda');
let amigos = [];
let solicitudes = [];

function crearAvatar(nombre) {
	const avatar = document.createElement('div');
	const inicial = document.createElement('p');

	avatar.className = 'avatar';
	inicial.className = 'profile-info';
	inicial.textContent = nombre.trim().charAt(0).toUpperCase() || 'U';
	avatar.append(inicial);
	return avatar;
}

function renderizarAmigos() {
	const busqueda = entradaBusqueda.value.trim().toLocaleLowerCase();
	const amigosFiltrados = amigos.filter((amigo) => amigo.busqueda.includes(busqueda));

	listaAmigos.replaceChildren();
	listaAmigos.classList.toggle('estado-vacio', amigosFiltrados.length === 0);
	if (amigosFiltrados.length === 0) {
		listaAmigos.textContent = busqueda ? 'No se encontraron amigos.' : 'Aún no tienes amigos.';
		return;
	}

	amigosFiltrados.forEach((amigo) => {
		const elemento = document.createElement('div');
		const informacion = document.createElement('div');
		const nombre = document.createElement('p');

		elemento.className = 'avatar-container';
		informacion.className = 'friend-info';
		nombre.textContent = amigo.nombre;
		informacion.append(nombre);
		elemento.append(crearAvatar(amigo.nombre), informacion);
		listaAmigos.append(elemento);
	});
}

function renderizarSolicitudes() {
	const busqueda = entradaBusqueda.value.trim().toLocaleLowerCase();
	const solicitudesFiltradas = solicitudes.filter((solicitud) => solicitud.busqueda.includes(busqueda));

	listaSolicitudes.replaceChildren();
	listaSolicitudes.classList.toggle('estado-vacio', solicitudesFiltradas.length === 0);
	if (solicitudesFiltradas.length === 0) {
		listaSolicitudes.textContent = busqueda ? 'No se encontraron solicitudes.' : 'No tienes solicitudes pendientes.';
		return;
	}

	solicitudesFiltradas.forEach((solicitud) => {
		const elemento = document.createElement('div');
		const informacion = document.createElement('div');
		const nombre = document.createElement('div');
		const textoNombre = document.createElement('h3');
		const botones = document.createElement('div');
		const confirmar = document.createElement('button');
		const eliminar = document.createElement('button');

		elemento.className = 'solicitud';
		informacion.className = 'info';
		nombre.className = 'nombre';
		textoNombre.textContent = solicitud.nombre;
		nombre.append(textoNombre);
		botones.className = 'btn-solicitud';
		confirmar.className = 'btn-opciones btn-confirmar';
		confirmar.type = 'button';
		confirmar.textContent = 'Confirmar';
		confirmar.dataset.solicitudAccion = 'aceptado';
		eliminar.className = 'btn-opciones btn-eliminar';
		eliminar.type = 'button';
		eliminar.textContent = 'Eliminar';
		eliminar.dataset.solicitudAccion = 'denegado';
		[confirmar, eliminar].forEach((boton) => {
			boton.dataset.solicitudId = solicitud.id;
		});
		botones.append(confirmar, eliminar);
		informacion.append(nombre, botones);
		elemento.append(crearAvatar(solicitud.nombre), informacion);
		listaSolicitudes.append(elemento);
	});
}

async function cargarAmigosYSolicitudes(idUsuarioActual) {
	const { data: relaciones, error: relacionesError } = await supabase
		.from('Amigos')
		.select('id-amigo, id_solicitante, id_receptor, estado')
		.or(`id_solicitante.eq.${idUsuarioActual},id_receptor.eq.${idUsuarioActual}`);

	if (relacionesError) throw relacionesError;

	const relacionesActivas = relaciones.filter((relacion) => relacion.estado === 'aceptado'
		|| (relacion.estado === 'pendiente' && relacion.id_receptor === idUsuarioActual));
	const idsUsuarios = [...new Set(relacionesActivas.map((relacion) => (
		relacion.estado === 'pendiente' ? relacion.id_solicitante
			: relacion.id_solicitante === idUsuarioActual ? relacion.id_receptor : relacion.id_solicitante
	)))];
	let usuarios = [];

	if (idsUsuarios.length > 0) {
		const { data, error: usuariosError } = await supabase
			.from('Usuarios')
			.select('id_usuarios, nombre, apodo')
			.in('id_usuarios', idsUsuarios);

		if (usuariosError) throw usuariosError;
		usuarios = data;
	}

	const usuariosPorId = new Map(usuarios.map((usuario) => [
		usuario.id_usuarios,
		{
			nombre: usuario.apodo || usuario.nombre || 'Usuario',
			busqueda: [usuario.apodo, usuario.nombre].filter(Boolean).join(' ').toLocaleLowerCase()
		}
	]));

	amigos = relaciones
		.filter((relacion) => relacion.estado === 'aceptado')
		.map((relacion) => {
			const idAmigo = relacion.id_solicitante === idUsuarioActual
				? relacion.id_receptor : relacion.id_solicitante;
			return {
				id: relacion['id-amigo'],
				...(usuariosPorId.get(idAmigo) || { nombre: 'Usuario', busqueda: 'usuario' })
			};
		});
	solicitudes = relaciones
		.filter((relacion) => relacion.estado === 'pendiente' && relacion.id_receptor === idUsuarioActual)
		.map((relacion) => ({
			id: relacion['id-amigo'],
			...(usuariosPorId.get(relacion.id_solicitante) || { nombre: 'Usuario', busqueda: 'usuario' })
		}));

	renderizarAmigos();
	renderizarSolicitudes();
}

async function actualizarSolicitud(idUsuarioActual, idSolicitud, estado) {
	const { data, error } = await supabase
		.from('Amigos')
		.update({ estado })
		.eq('id-amigo', idSolicitud)
		.eq('id_receptor', idUsuarioActual)
		.eq('estado', 'pendiente')
		.select('id-amigo')
		.maybeSingle();

	if (error) throw error;
	if (!data) throw new Error('La solicitud ya no está pendiente o no tienes permiso para modificarla.');
	await cargarAmigosYSolicitudes(idUsuarioActual);
}

async function iniciarPagina() {
	try {
		const sesion = await obtenerPerfilActual();
		if (!sesion) {
			window.location.replace('index.html');
			return;
		}

		const nombrePerfil = sesion.perfil.apodo || sesion.perfil.nombre || sesion.authUser.email || 'Usuario';
		const inicial = nombrePerfil.trim().charAt(0).toUpperCase() || 'U';
		document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
			elemento.textContent = inicial;
		});

		await cargarAmigosYSolicitudes(sesion.perfil.id_usuarios);
		entradaBusqueda.addEventListener('input', () => {
			renderizarAmigos();
			renderizarSolicitudes();
		});

		listaSolicitudes.addEventListener('click', async (evento) => {
			const boton = evento.target.closest('button[data-solicitud-accion]');
			if (!boton) return;

			boton.disabled = true;
			try {
				await actualizarSolicitud(
					sesion.perfil.id_usuarios,
					boton.dataset.solicitudId,
					boton.dataset.solicitudAccion
				);
			} catch (error) {
				console.error('No se pudo actualizar la solicitud de amistad:', error);
				alert('No se pudo actualizar la solicitud: ' + error.message);
				boton.disabled = false;
			}
		});
	} catch (error) {
		console.error('No se pudieron cargar amigos y solicitudes:', error);
		alert('No se pudo cargar la información: ' + error.message);
	}
}

document.getElementById('form-busqueda').addEventListener('submit', (evento) => evento.preventDefault());
iniciarPagina();