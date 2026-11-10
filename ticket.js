import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';

const formulario = document.querySelector('.Form-Ticket');
const entradaBusqueda = document.getElementById('buscador-deudores');
const idDeudorInput = formulario?.elements.deudor;
const sugerencias = document.getElementById('sugerencias-amigos');
const mensajeAmigos = document.querySelector('.AgregarAmigo p');
const botonConfirmar = formulario?.querySelector('button[type="submit"]');
let amigos = [];
let enviandoTicket = false;

function ocultarSugerencias() {
	sugerencias.replaceChildren();
	sugerencias.hidden = true;
	entradaBusqueda.setAttribute('aria-expanded', 'false');
}

function renderizarSugerencias() {
	const busqueda = entradaBusqueda.value.trim().toLocaleLowerCase();
	const coincidencias = amigos.filter((amigo) => amigo.busqueda.includes(busqueda));

	sugerencias.replaceChildren();
	if (coincidencias.length === 0) {
		if (busqueda) {
			const vacio = document.createElement('p');
			vacio.className = 'ticket-friend-empty';
			vacio.textContent = 'No se encontraron amigos.';
			sugerencias.append(vacio);
		}
		sugerencias.hidden = !busqueda;
		entradaBusqueda.setAttribute('aria-expanded', String(!sugerencias.hidden));
		return;
	}

	coincidencias.forEach((amigo) => {
		const opcion = document.createElement('button');
		opcion.type = 'button';
		opcion.className = 'ticket-friend-option';
		opcion.setAttribute('role', 'option');
		opcion.textContent = amigo.nombre;
		opcion.addEventListener('click', () => {
			entradaBusqueda.value = amigo.nombre;
			idDeudorInput.value = amigo.id;
			ocultarSugerencias();
		});
		sugerencias.append(opcion);
	});

	sugerencias.hidden = false;
	entradaBusqueda.setAttribute('aria-expanded', 'true');
}

async function cargarAmigos() {
	try {
		const sesion = await obtenerPerfilActual();
		if (!sesion) {
			window.location.replace('index.html');
			return;
		}

		const nombrePerfil = sesion.perfil.apodo?.trim()
			|| sesion.perfil.nombre?.trim()
			|| sesion.authUser.email
			|| 'Usuario';
		const inicial = nombrePerfil.charAt(0).toUpperCase() || 'U';
		document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
			elemento.textContent = inicial;
		});

		const { data: relaciones, error: relacionesError } = await supabase
			.from('Amigos')
			.select('id_solicitante, id_receptor')
			.eq('estado', 'aceptado')
			.or(`id_solicitante.eq.${sesion.perfil.id_usuarios},id_receptor.eq.${sesion.perfil.id_usuarios}`);

		if (relacionesError) throw relacionesError;

		const idsAmigos = [...new Set(relaciones.map((relacion) => (
			relacion.id_solicitante === sesion.perfil.id_usuarios
				? relacion.id_receptor
				: relacion.id_solicitante
		)))];

		if (idsAmigos.length > 0) {
			const { data: usuarios, error: usuariosError } = await supabase
				.from('Usuarios')
				.select('id_usuarios, nombre, apellido, apodo')
				.in('id_usuarios', idsAmigos)
				.order('apodo', { ascending: true });

			if (usuariosError) throw usuariosError;

			amigos = usuarios.map((usuario) => {
				const nombre = usuario.apodo?.trim()
					|| [usuario.nombre, usuario.apellido].filter(Boolean).join(' ').trim()
					|| 'Usuario';
				return {
					id: usuario.id_usuarios,
					nombre,
					busqueda: [usuario.apodo, usuario.nombre, usuario.apellido, nombre]
						.filter(Boolean)
						.join(' ')
						.toLocaleLowerCase()
				};
			});
		}

		botonConfirmar.disabled = amigos.length === 0;
		entradaBusqueda.disabled = amigos.length === 0;
		mensajeAmigos.textContent = amigos.length === 0
			? 'Aún no tienes amigos aceptados. Agrégalos desde la sección Amigos.'
			: 'Los tickets solo se pueden compartir con amigos aceptados.';
	} catch (error) {
		console.error('No se pudieron cargar los amigos para crear un ticket:', error);
		mensajeAmigos.textContent = 'No se pudieron cargar tus amigos: ' + error.message;
		mensajeAmigos.setAttribute('role', 'alert');
		entradaBusqueda.disabled = true;
		botonConfirmar.disabled = true;
	}
}

if (formulario) {
	cargarAmigos();

	entradaBusqueda.addEventListener('input', () => {
		idDeudorInput.value = '';
		renderizarSugerencias();
	});
	entradaBusqueda.addEventListener('focus', renderizarSugerencias);
	entradaBusqueda.addEventListener('keydown', (evento) => {
		if (evento.key === 'Escape') ocultarSugerencias();
	});
	document.addEventListener('click', (evento) => {
		if (!evento.target.closest('.ticket-friend-picker')) ocultarSugerencias();
	});

	formulario.addEventListener('submit', async (evento) => {
		evento.preventDefault();
		if (enviandoTicket) return;

		enviandoTicket = true;
		botonConfirmar.disabled = true;
		botonConfirmar.textContent = 'Enviando...';

		try {
			const sesion = await obtenerPerfilActual();
			if (!sesion) {
				window.location.replace('index.html');
				return;
			}

			const monto = Number(formulario.elements.Monto.value);
			const concepto = formulario.elements.Concepto.value.trim();
			const idDeudor = idDeudorInput.value;

			if (!idDeudor || !amigos.some((amigo) => amigo.id === idDeudor)
				|| !Number.isFinite(monto) || monto <= 0 || !concepto) {
				enviandoTicket = false;
				botonConfirmar.disabled = amigos.length === 0;
				botonConfirmar.textContent = 'Confirmar';
				alert('Selecciona un amigo de la lista e ingresa un monto y concepto válidos.');
				return;
			}

			const { error } = await supabase.from('Tickets').insert({
				id_acreedor: sesion.perfil.id_usuarios,
				id_deudor: idDeudor,
				monto,
				concepto
			});

			if (error) throw error;
			window.location.href = 'principal.html';
		} catch (error) {
			enviandoTicket = false;
			botonConfirmar.disabled = amigos.length === 0;
			botonConfirmar.textContent = 'Confirmar';
			console.error('No se pudo crear el ticket:', error);
			alert('No se pudo crear el ticket: ' + error.message);
		}
	});
}
