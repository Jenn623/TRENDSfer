import { supabase } from './supabase.js';
import { obtenerPerfilActual } from './auth-profile.js';
import { cargarNotificaciones } from './notificaciones-data.js';
import { iniciarEdicionPerfil } from './editar-perfil.js';
import { iniciarCuentasCodi } from './cuentas-codi.js';

/* variables para manejar la presentacion de las cards */
const desktop = window.matchMedia('(min-width: 1024px)');
const detalle = document.getElementById('detalle');
const filas = document.querySelectorAll('.Cuenta p');
let idUsuarioActual;

async function cargarPerfil() {
    try {
        const sesion = await obtenerPerfilActual();
        if (!sesion) {
            window.location.replace('./index.html');
            return;
        }
        idUsuarioActual = sesion.perfil.id_usuarios;

        const nombrePerfil = sesion.perfil.apodo?.trim()
            || sesion.perfil.nombre?.trim()
            || sesion.authUser.email
            || 'Usuario';
        const inicial = nombrePerfil.trim().charAt(0).toUpperCase() || 'U';

        document.querySelectorAll('[data-usuario-nombre]').forEach((elemento) => {
            elemento.textContent = nombrePerfil;
        });
        document.querySelectorAll('[data-usuario-inicial]').forEach((elemento) => {
            elemento.textContent = inicial;
        });

        const canal = supabase
            .channel(`cuenta-notificaciones-${idUsuarioActual}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'Tickets' }, () => {
                const contenedor = detalle.querySelector('[data-notificaciones]');
                if (contenedor) {
                    cargarNotificaciones(contenedor, idUsuarioActual)
                        .catch((error) => console.error('Error actualizando notificaciones de cuenta:', error));
                }
            })
            .subscribe();
        window.addEventListener('beforeunload', () => supabase.removeChannel(canal), { once: true });
    } catch (error) {
        console.error('No se pudo cargar el perfil de la cuenta:', error);
        alert('No se pudo cargar la información de la cuenta: ' + error.message);
    }
}

const perfilListo = cargarPerfil();

// función asíncrona que carga la información (funciona solo con un servidor)
async function cargar(fila){
    const link = fila.querySelector('a');

    try{
        await perfilListo;
        if (!idUsuarioActual) return;
        const res = await fetch(link.getAttribute('href'));
        if(!res.ok) throw new Error('No existe la página');

        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const contenido = doc.querySelector(link.dataset.selector);
        if(!contenido) throw new Error('No encontré el bloque');

        detalle.replaceChildren(document.importNode(contenido, true));
        const notificaciones = detalle.querySelector('[data-notificaciones]');
        if (notificaciones) {
            await cargarNotificaciones(notificaciones, idUsuarioActual);
        }
        if (detalle.querySelector('.form-registro')) {
            iniciarEdicionPerfil(detalle);
        }
        if (detalle.querySelector('.Form-AgregarTarjeta')) {
            iniciarCuentasCodi(detalle);
        }
    }catch(error){
        console.error('No se pudo cargar el contenido de la cuenta:', error);
        detalle.textContent = 'No se pudo cargar esta sección.';
    }

    filas.forEach(f => f.classList.remove('activa'));
    fila.classList.add('activa');
}

filas.forEach(fila => {
    fila.addEventListener('click', e => {
        if(!desktop.matches) return;
        e.preventDefault();
        cargar(fila);
    });
});

async function abrirSeccionSolicitada() {
    if (new URLSearchParams(window.location.search).get('seccion') !== 'notificaciones') return;

    await perfilListo;
    if (!idUsuarioActual) return;

    if (!desktop.matches) {
        window.location.replace('./Notificaciones.html');
        return;
    }

    const filaNotificaciones = [...filas].find((fila) => (
        fila.querySelector('a')?.getAttribute('href') === './Notificaciones.html'
    ));
    if (filaNotificaciones) await cargar(filaNotificaciones);
}

document.querySelector('.CerrarSesion a')?.addEventListener('click', async (evento) => {
    evento.preventDefault();
    const { error } = await supabase.auth.signOut();
    if (error) {
        alert('No se pudo cerrar la sesión: ' + error.message);
        return;
    }
    localStorage.removeItem('usuarioSesion');
    window.location.replace('./index.html');
});

abrirSeccionSolicitada();
