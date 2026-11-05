import { supabase } from './supabase.js';

/* variables para manejar la presentacion de las cards */
const desktop = window.matchMedia('(min-width: 1024px)');
const detalle = document.getElementById('detalle');
const filas = document.querySelectorAll('.Cuenta p');

// función asíncrona que carga la información (funciona solo con un servidor)
async function cargar(fila){
    const link = fila.querySelector('a');

    try{
        const res = await fetch(link.getAttribute('href'));
        if(!res.ok) throw new Error('No existe la página');

        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const contenido = doc.querySelector(link.dataset.selector);
        if(!contenido) throw new Error('No encontré el bloque');

        detalle.replaceChildren(document.importNode(contenido, true));
    }catch(error){
        detalle.textContent = '';
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

