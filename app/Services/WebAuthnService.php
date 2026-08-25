<?php

namespace App\Services;

use App\Models\Passkey;
use App\Models\User;
use ParagonIE\ConstantTime\Base64UrlSafe;
use Symfony\Component\Serializer\SerializerInterface;
use Webauthn\AttestationStatement\AttestationStatementSupportManager;
use Webauthn\AttestationStatement\NoneAttestationStatementSupport;
use Webauthn\AuthenticatorAssertionResponse;
use Webauthn\AuthenticatorAssertionResponseValidator;
use Webauthn\AuthenticatorAttestationResponse;
use Webauthn\AuthenticatorAttestationResponseValidator;
use Webauthn\AuthenticatorSelectionCriteria;
use Webauthn\CeremonyStep\CeremonyStepManager;
use Webauthn\CeremonyStep\CeremonyStepManagerFactory;
use Webauthn\CredentialRecord;
use Webauthn\Denormalizer\WebauthnSerializerFactory;
use Webauthn\PublicKeyCredential;
use Webauthn\PublicKeyCredentialCreationOptions;
use Webauthn\PublicKeyCredentialParameters;
use Webauthn\PublicKeyCredentialRequestOptions;
use Webauthn\PublicKeyCredentialRpEntity;
use Webauthn\PublicKeyCredentialUserEntity;

// Servicio que centraliza las ceremonias WebAuthn (passkeys): genera las opciones
// de registro e inicio de sesión y verifica las respuestas firmadas por el
// dispositivo con la huella. La huella nunca viaja ni se guarda: solo se valida
// una firma hecha con una llave privada que vive en el hardware del teléfono.

class WebAuthnService
{
    public const ALG_ES256 = -7;
    public const ALG_RS256 = -257;

    // Identificador del "relying party": debe coincidir entre opciones y
    // verificación. Se configura en .env (WEBAUTHN_RP_ID).
    public function rpId(): string
    {
        return env('WEBAUTHN_RP_ID', 'senaaccess.local');
    }

    // Orígenes permitidos (clientDataJSON.origin). En Android el origen es
    // "android:apk-key-hash:<sha256 del certificado de firma>"; se configura en
    // .env (WEBAUTHN_ALLOWED_ORIGINS, separado por comas).
    public function allowedOrigins(): array
    {
        $raw = env('WEBAUTHN_ALLOWED_ORIGINS', '');
        return array_values(array_filter(array_map('trim', explode(',', $raw))));
    }

    // Genera un reto aleatorio de 32 bytes en base64url sin padding.
    public function challenge(): string
    {
        return Base64UrlSafe::encodeUnpadded(random_bytes(32));
    }

    // Serializador de la librería: convierte el JSON que devuelve el dispositivo
    // (Credential Manager de Android) en objetos WebAuthn.
    public function serializer(): SerializerInterface
    {
        $asm = new AttestationStatementSupportManager([new NoneAttestationStatementSupport()]);
        return (new WebauthnSerializerFactory($asm))->create();
    }

    // Gestor de los pasos de verificación de una ceremonia (registro o login).
    private function ceremony(bool $creation): CeremonyStepManager
    {
        $factory = new CeremonyStepManagerFactory();
        $origins = $this->allowedOrigins();
        if (count($origins) > 0) {
            $factory->setAllowedOrigins($origins);
        }
        return $creation ? $factory->creationCeremony() : $factory->requestCeremony();
    }

    // Opciones de registro de una llave nueva (JSON listo para Credential Manager).
    public function creationOptions(User $user): array
    {
        $rp = PublicKeyCredentialRpEntity::create('Sena Access', $this->rpId());
        $userEntity = PublicKeyCredentialUserEntity::create(
            $user->user_email,
            (string) $user->id_usuario,
            trim($user->user_name . ' ' . $user->user_lastname)
        );

        return [
            'rp' => ['id' => $rp->id, 'name' => $rp->name],
            'user' => [
                'id' => Base64UrlSafe::encodeUnpadded($userEntity->id),
                'name' => $userEntity->name,
                'displayName' => $userEntity->displayName,
            ],
            'challenge' => $this->challenge(),
            'pubKeyCredParams' => [
                ['type' => 'public-key', 'alg' => self::ALG_ES256],
                ['type' => 'public-key', 'alg' => self::ALG_RS256],
            ],
            'timeout' => 60000,
            'attestation' => 'none',
            'authenticatorSelection' => [
                'authenticatorAttachment' => 'platform',
                'residentKey' => 'required',
                'userVerification' => 'required',
            ],
        ];
    }

    // Opciones de inicio de sesión. Si se pasa el usuario, filtra por sus llaves
    // registradas; si no, deja la lista vacía (descubrimiento de passkeys).
    public function requestOptions(?User $user = null): array
    {
        $allow = [];
        if ($user !== null) {
            $allow = $user->passkeys
                ->map(fn (Passkey $p) => ['type' => 'public-key', 'id' => $p->credential_id])
                ->values()
                ->all();
        }

        return [
            'challenge' => $this->challenge(),
            'rpId' => $this->rpId(),
            'allowCredentials' => $allow,
            'userVerification' => 'required',
            'timeout' => 60000,
        ];
    }

    // Verifica la respuesta de registro del dispositivo y devuelve el
    // CredentialRecord con la llave pública lista para guardar.
    public function verifyRegistration(User $user, string $challenge, string $responseJson): CredentialRecord
    {
        /** @var PublicKeyCredential $publicKeyCredential */
        $publicKeyCredential = $this->serializer()->deserialize($responseJson, PublicKeyCredential::class, 'json');
        $response = $publicKeyCredential->response;

        if (! $response instanceof AuthenticatorAttestationResponse) {
            throw new \InvalidArgumentException('La respuesta no es de registro.');
        }

        $rp = PublicKeyCredentialRpEntity::create('Sena Access', $this->rpId());
        $userEntity = PublicKeyCredentialUserEntity::create(
            $user->user_email,
            (string) $user->id_usuario,
            trim($user->user_name . ' ' . $user->user_lastname)
        );
        $options = PublicKeyCredentialCreationOptions::create(
            $rp,
            $userEntity,
            $challenge,
            [
                PublicKeyCredentialParameters::createPk(self::ALG_ES256),
                PublicKeyCredentialParameters::createPk(self::ALG_RS256),
            ],
            AuthenticatorSelectionCriteria::create('platform', 'required', 'required'),
            attestation: 'none'
        );

        $validator = AuthenticatorAttestationResponseValidator::create($this->ceremony(creation: true));

        return $validator->check($response, $options, $this->rpId());
    }

    // Verifica la firma del inicio de sesión y devuelve el Passkey asociado
    // (ya con el contador actualizado).
    public function verifyLogin(string $challenge, string $responseJson): Passkey
    {
        /** @var PublicKeyCredential $publicKeyCredential */
        $publicKeyCredential = $this->serializer()->deserialize($responseJson, PublicKeyCredential::class, 'json');
        $response = $publicKeyCredential->response;

        if (! $response instanceof AuthenticatorAssertionResponse) {
            throw new \InvalidArgumentException('La respuesta no es de autenticación.');
        }

        $passkey = Passkey::where('credential_id', Base64UrlSafe::encodeUnpadded($publicKeyCredential->rawId))
            ->first();

        if (! $passkey) {
            throw new \InvalidArgumentException('La credencial no está registrada.');
        }

        $options = PublicKeyCredentialRequestOptions::create($challenge, $this->rpId(), [], 'required');
        $validator = AuthenticatorAssertionResponseValidator::create($this->ceremony(creation: false));

        $record = $validator->check($passkey->toCredentialRecord(), $response, $options, $this->rpId(), null);

        $passkey->update([
            'counter' => $record->counter,
            'backup_eligible' => $record->backupEligible,
            'backup_status' => $record->backupStatus,
            'uv_initialized' => $record->uvInitialized,
        ]);

        return $passkey;
    }
}