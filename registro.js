// import { supabase } from './supabase.js'; // Ajusta la ruta según dónde tengas tu supabase.js

// // Seleccionamos el formulario de registro
// const formRegistro = document.querySelector('.form-registro');

// if (formRegistro) {
//     formRegistro.addEventListener('submit', async (e) => {
//         e.preventDefault(); // Evita que la página se recargue por defecto

//         // Capturamos los valores de los inputs de tu HTML
//         const nombre = formRegistro.querySelector('input[name="nombre"]').value;
//         const apellidos = formRegistro.querySelector('input[name="apellidos"]').value;
//         const apodo = formRegistro.querySelector('input[name="apodo"]').value;
//         const correo = formRegistro.querySelector('input[name="correo"]').value;
//         const contrasena = formRegistro.querySelector('input[name="contrasena"]').value;

//         try {
//             // 1. Registramos al usuario en el sistema de autenticación de Supabase
//             const { data: authData, error: authError } = await supabase.auth.signUp({
//                 email: correo,
//                 password: contrasena,
//             });

//             if (authError) throw authError;

//             const userId = authData.user.id; // Obtenemos el ID único generado por Supabase

//             // 2. Guardamos los datos extra (nombre, apellidos, apodo) en tu tabla "Usuarios"
//             const { error: dbError } = await supabase
//                 .from('Usuarios')
//                 .insert([
//                     { 
//                         id_usuario: userId, 
//                         nombre: `${nombre} ${apellidos}`, 
//                         apodo: apodo,
//                         correo: correo 
//                     }
//                 ]);

//             if (dbError) throw dbError;

//             alert('¡Cuenta creada con éxito! Redirigiendo al inicio de sesión...');
//             window.location.href = 'index.html'; // Lo mandamos al login

//         } catch (error) {
//             console.error('Error durante el registro:', error.message);
//             alert('Hubo un error al registrar la cuenta: ' + error.message);
//         }
//     });
// }

import { supabase } from './supabase.js';
import { crearUrlConInvitacion, obtenerInvitacionAmigo } from './invitacion-amigo.js';

const formRegistro = document.querySelector('.form-registro');
const idPerfilInvitador = obtenerInvitacionAmigo();

if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = formRegistro.querySelector('input[name="nombre"]').value;
        const apellidos = formRegistro.querySelector('input[name="apellidos"]').value;
        const apodo = formRegistro.querySelector('input[name="apodo"]').value;
        const email = formRegistro.querySelector('input[name="correo"]').value;
        const contraseña = formRegistro.querySelector('input[name="contrasena"]').value;

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password: contraseña,
                options: {
                    data: { nombre, apellido: apellidos, apodo }
                }
            });

            if (error) throw error;

            if (data.session) {
                window.location.href = crearUrlConInvitacion(
                    './principal.html',
                    idPerfilInvitador
                ).href;
                return;
            }

            alert('Cuenta creada. Revisa tu correo para confirmar el registro.');
            window.location.href = crearUrlConInvitacion(
                './index.html',
                idPerfilInvitador
            ).href;

        } catch (error) {
            console.error('Error durante el registro:', error.message);
            alert('Hubo un error al registrar la cuenta: ' + error.message);
        }
    });
}