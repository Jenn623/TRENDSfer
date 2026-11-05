ALTER TABLE public."Usuarios"
    ADD COLUMN IF NOT EXISTS auth_uid uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Usuarios_auth_uid_fkey'
          AND conrelid = 'public."Usuarios"'::regclass
    ) THEN
        ALTER TABLE public."Usuarios"
            ADD CONSTRAINT "Usuarios_auth_uid_fkey"
            FOREIGN KEY (auth_uid) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Usuarios_auth_uid_key'
          AND conrelid = 'public."Usuarios"'::regclass
    ) THEN
        ALTER TABLE public."Usuarios"
            ADD CONSTRAINT "Usuarios_auth_uid_key" UNIQUE (auth_uid);
    END IF;
END $$;

UPDATE public."Usuarios" AS perfil
SET auth_uid = auth_user.id
FROM auth.users AS auth_user
WHERE lower(perfil.email) = lower(auth_user.email)
  AND perfil.auth_uid IS NULL;

CREATE OR REPLACE FUNCTION public.crear_perfil_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public."Usuarios"
    SET auth_uid = NEW.id,
        nombre = coalesce(nullif(NEW.raw_user_meta_data ->> 'nombre', ''), nombre),
        apellido = coalesce(nullif(NEW.raw_user_meta_data ->> 'apellido', ''), apellido),
        apodo = coalesce(nullif(NEW.raw_user_meta_data ->> 'apodo', ''), apodo),
        email = NEW.email
    WHERE lower(trim(email)) = lower(trim(NEW.email))
      AND (auth_uid IS NULL OR auth_uid = NEW.id);

    IF FOUND THEN
        RETURN NEW;
    END IF;

    INSERT INTO public."Usuarios" (auth_uid, nombre, apellido, apodo, email)
    VALUES (
        NEW.id,
        coalesce(NEW.raw_user_meta_data ->> 'nombre', ''),
        coalesce(NEW.raw_user_meta_data ->> 'apellido', ''),
        coalesce(NEW.raw_user_meta_data ->> 'apodo', ''),
        NEW.email
    )
    ON CONFLICT (auth_uid) DO UPDATE SET
        nombre = excluded.nombre,
        apellido = excluded.apellido,
        apodo = excluded.apodo,
        email = excluded.email;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crear_perfil_auth_trigger ON auth.users;
CREATE TRIGGER crear_perfil_auth_trigger
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_auth();

CREATE OR REPLACE FUNCTION public.usuario_actual_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT id_usuarios
    FROM public."Usuarios"
    WHERE auth_uid = auth.uid()
    LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.usuario_actual_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_actual_id() TO authenticated;

ALTER TABLE public."Usuarios" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Habilitar la inserción para todos los usuarios" ON public."Usuarios";
DROP POLICY IF EXISTS "Permitir seleccionar para todos los usuarios" ON public."Usuarios";
DROP POLICY IF EXISTS "Permitir actualizar para todos los usuarios" ON public."Usuarios";
DROP POLICY IF EXISTS usuarios_authenticated_read ON public."Usuarios";
CREATE POLICY usuarios_authenticated_read
    ON public."Usuarios" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS usuarios_authenticated_only_guard ON public."Usuarios";
CREATE POLICY usuarios_authenticated_only_guard
    ON public."Usuarios" AS RESTRICTIVE FOR SELECT TO public
    USING (auth.uid() IS NOT NULL);

REVOKE ALL ON TABLE public."Usuarios" FROM anon, authenticated, PUBLIC;
GRANT SELECT (id_usuarios, nombre, apellido, apodo, email)
    ON TABLE public."Usuarios" TO authenticated;
REVOKE SELECT ("contraseña") ON TABLE public."Usuarios" FROM anon, authenticated, PUBLIC;

ALTER TABLE public."Tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tickets" ALTER COLUMN id_acreedor DROP DEFAULT;
ALTER TABLE public."Tickets" ALTER COLUMN id_deudor DROP DEFAULT;
ALTER TABLE public."Tickets" ALTER COLUMN estado SET DEFAULT 'Pendiente';
ALTER TABLE public."Tickets" ALTER COLUMN fecha_creacion SET DEFAULT now();

DROP POLICY IF EXISTS tickets_authenticated_read ON public."Tickets";
CREATE POLICY tickets_authenticated_read
    ON public."Tickets" FOR SELECT TO authenticated
    USING (
        id_acreedor = public.usuario_actual_id()
        OR id_deudor = public.usuario_actual_id()
    );
DROP POLICY IF EXISTS tickets_participant_read_guard ON public."Tickets";
CREATE POLICY tickets_participant_read_guard
    ON public."Tickets" AS RESTRICTIVE FOR SELECT TO public
    USING (
        auth.uid() IS NOT NULL
        AND (
            id_acreedor = public.usuario_actual_id()
            OR id_deudor = public.usuario_actual_id()
        )
    );

DROP POLICY IF EXISTS tickets_authenticated_insert ON public."Tickets";
CREATE POLICY tickets_authenticated_insert
    ON public."Tickets" FOR INSERT TO authenticated
    WITH CHECK (
        id_acreedor = public.usuario_actual_id()
        AND id_deudor <> public.usuario_actual_id()
    );
DROP POLICY IF EXISTS tickets_creator_insert_guard ON public."Tickets";
CREATE POLICY tickets_creator_insert_guard
    ON public."Tickets" AS RESTRICTIVE FOR INSERT TO public
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND id_acreedor = public.usuario_actual_id()
        AND id_deudor <> public.usuario_actual_id()
    );

REVOKE ALL ON TABLE public."Tickets" FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT ON TABLE public."Tickets" TO authenticated;

DO $$
DECLARE
    secuencia_ticket regclass;
BEGIN
    secuencia_ticket := pg_get_serial_sequence('public."Tickets"', 'id_ticket');
    IF secuencia_ticket IS NOT NULL THEN
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', secuencia_ticket);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'Tickets'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."Tickets";
    END IF;
END $$;