<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use ParagonIE\ConstantTime\Base64UrlSafe;
use Symfony\Component\Uid\Uuid;
use Webauthn\CredentialRecord;
use Webauthn\TrustPath\EmptyTrustPath;

class Passkey extends Model
{
    use HasFactory;

    protected $table = 'passkeys';

    protected $fillable = [
        'fk_id_user',
        'credential_id',
        'public_key',
        'aaguid',
        'attestation_type',
        'transports',
        'user_handle',
        'counter',
        'backup_eligible',
        'backup_status',
        'uv_initialized',
    ];

    protected $casts = [
        'counter' => 'integer',
        'backup_eligible' => 'boolean',
        'backup_status' => 'boolean',
        'uv_initialized' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'fk_id_user', 'id_usuario');
    }

    // Convierte el registro de BD en el CredentialRecord que usa la librería
    // WebAuthn para verificar las firmas de las autenticaciones.
    public function toCredentialRecord(): CredentialRecord
    {
        return CredentialRecord::create(
            publicKeyCredentialId: Base64UrlSafe::decodeNoPadding($this->credential_id),
            type: 'public-key',
            transports: $this->transports ? json_decode($this->transports, true) : [],
            attestationType: $this->attestation_type,
            trustPath: new EmptyTrustPath(),
            aaguid: Uuid::fromString($this->aaguid),
            credentialPublicKey: Base64UrlSafe::decodeNoPadding($this->public_key),
            userHandle: Base64UrlSafe::decodeNoPadding($this->user_handle),
            counter: $this->counter,
            backupEligible: $this->backup_eligible,
            backupStatus: $this->backup_status,
            uvInitialized: $this->uv_initialized,
        );
    }
}