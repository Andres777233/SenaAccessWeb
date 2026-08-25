<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Credenciales WebAuthn (passkeys) por usuario: se guarda SOLO la llave
        // pública y metadatos, nunca la huella. La huella vive en el hardware del
        // dispositivo y firma los retos que este servidor verifica.
        Schema::create('passkeys', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('fk_id_user');
            $table->string('credential_id', 512)->unique();
            $table->text('public_key');
            $table->string('aaguid', 64)->default('00000000-0000-0000-0000-000000000000');
            $table->string('attestation_type', 32)->default('none');
            $table->text('transports')->nullable();
            $table->string('user_handle', 128);
            $table->unsignedBigInteger('counter')->default(0);
            $table->boolean('backup_eligible')->nullable();
            $table->boolean('backup_status')->nullable();
            $table->boolean('uv_initialized')->nullable();
            $table->timestamps();
            $table->foreign('fk_id_user')->references('id_usuario')->on('usuarios')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('passkeys');
    }
};