import { supabase } from './supabase.js';

const formLogin = document.querySelector('.formIniciar-sesion');

if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault(); // Detiene el envío nativo del formulario

        // Capturamos los camposA
        const correoInput = formLogin.querySelector('input[name="correo"]');
        const contrasenaInput = formLogin.querySelector('input[name="contraseña"]') || formLogin.querySelector('input[name="contrasena"]');

        if (!correoInput || !contrasenaInput) {
            console.error('No se encontraron los inputs en el HTML');
            alert('Error: Verifique el nombre de los campos de entrada en el HTML');
            return;
        }

        const correoIngresado = correoInput.value.trim();
        const contrasenaIngresada = contrasenaInput.value.trim();

        console.log('Intentando iniciar sesión con:', correoIngresado);

        try {
            // Intentar buscar directamente en la tabla Usuarios
            const { data: usuario, error: dbError } = await supabase
                .from('Usuarios')
                .select('nombre, apellido, apodo, email')
                .eq('email', correoIngresado)
                .eq('contraseña', contrasenaIngresada);

            console.log('Resultado de la base de datos:', usuario, dbError);

            if (dbError) {
                throw dbError;
            }

            if (!usuario || usuario.length === 0) {
                alert('Correo o contraseña incorrectos. Revisa mayúsculas/minúsculas.');
                return;
            }

            // Solo se persisten los datos de perfil, nunca la contraseña.
            localStorage.setItem('usuarioSesion', JSON.stringify(usuario[0]));

            alert('¡Bienvenido ' + usuario[0].nombre + '! Redirigiendo...');
            window.location.href = 'principal.html'; 

        } catch (error) {
            console.error('Error durante el inicio de sesión:', error);
            alert('Error al conectar con la base de datos: ' + error.message);
        }
    });
}